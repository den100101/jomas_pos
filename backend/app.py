import csv
import io
import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from flask_mail import Mail, Message
from flask_jwt_extended import (
    JWTManager, jwt_required, create_access_token, get_jwt, get_jwt_identity
)

load_dotenv()

from config import Config
from auth_utils import roles_required
from models import (
    LOW_STOCK_MINIMUM,
    ORDER_STATUSES,
    PAYMENT_METHODS,
    STORE_UTC_OFFSET,
    Category,
    Ingredient,
    Order,
    OrderItem,
    Product,
    ProductIngredient,
    Shift,
    StoreSettings,
    User,
    db,
)

app = Flask(__name__)
app.config.from_object(Config)
CORS(app, resources={r"/api/*": {"origins": Config.CORS_ORIGINS}}, supports_credentials=True)
db.init_app(app)
mail = Mail(app)
jwt = JWTManager(app)

# Who can do what:
#   admin   - everything
#   cashier - POS only: menu, taking orders, receipts, live sales ticker
#   kitchen - kitchen board only: see orders and move them through the queue


# ================= Error handling (never leak stack traces) =================


@jwt.unauthorized_loader
def unauthorized(_reason):
    return jsonify({"error": "Authentication required"}), 401


@jwt.invalid_token_loader
def invalid_token(_reason):
    return jsonify({"error": "Invalid or expired token"}), 401


# ================= Auth =================


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not username or not password:
        return jsonify({"success": False, "message": "Username and password are required"}), 400

    user = User.query.filter_by(username=username, is_active=True).first()

    # Same response whether the user exists or not, so we don't leak
    # which usernames are valid.
    if not user or not user.check_password(password):
        return jsonify({"success": False, "message": "Invalid credentials"}), 401

    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "name": user.name},
    )
    return jsonify({"success": True, "access_token": token, "user": user.to_dict()})


@app.route("/api/me", methods=["GET"])
@jwt_required()
def me():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({"error": "Not found"}), 404
    return jsonify(user.to_dict())


# ================= Menu (admin + cashier) =================


@app.route("/api/categories", methods=["GET"])
@roles_required("admin", "cashier")
def get_categories():
    categories = Category.query.order_by(Category.id).all()
    return jsonify([c.to_dict() for c in categories])


@app.route("/api/products", methods=["GET"])
@roles_required("admin", "cashier")
def get_products():
    slug = request.args.get("category")
    query = Product.query

    if slug:
        category = Category.query.filter_by(slug=slug).first()
        if not category:
            return jsonify([])
        query = query.filter_by(category_id=category.id)

    products = query.order_by(Product.name).all()
    return jsonify([p.to_dict() for p in products])


# ================= Orders (with customization + payment options, no VAT) =================


@app.route("/api/orders", methods=["GET"])
@roles_required("admin", "cashier", "kitchen")
def list_orders():
    """Supports ?status=pending,preparing for the kitchen board and ?limit=N for reports."""
    query = Order.query

    status_param = request.args.get("status")
    if status_param:
        statuses = [s.strip() for s in status_param.split(",")]
        query = query.filter(Order.status.in_(statuses))

    limit = max(1, min(request.args.get("limit", 100, type=int), 500))
    orders = query.order_by(Order.id.desc()).limit(limit).all()
    return jsonify([o.to_dict() for o in orders])


@app.route("/api/orders/<int:order_id>", methods=["GET"])
@roles_required("admin", "cashier")
def get_order(order_id):
    order = Order.query.get_or_404(order_id)
    return jsonify(order.to_dict())


@app.route("/api/orders", methods=["POST"])
@roles_required("admin", "cashier")
def create_order():
    data = request.get_json() or {}
    cart = data.get("items", [])
    payment_method = data.get("payment_method", "cash")
    cash_tendered = data.get("cash_tendered")

    if not cart:
        return jsonify({"error": "Cart is empty"}), 400

    if payment_method not in PAYMENT_METHODS:
        return jsonify({"error": "Invalid payment method"}), 400

    # Validate every cart line up front so bad data can never reach the
    # reports (e.g. a negative quantity would show up as negative revenue).
    clean_items = []
    for item in cart:
        try:
            line = {
                "id": int(item["id"]),
                "name": str(item["name"])[:100],
                "price": float(item["price"]),
                "quantity": int(item["quantity"]),
                "modifiers": str(item["modifiers"])[:255] if item.get("modifiers") else None,
                "notes": str(item["notes"])[:255] if item.get("notes") else None,
            }
        except (KeyError, TypeError, ValueError):
            return jsonify({"error": "Each cart item needs id, name, price and quantity"}), 400
        if line["quantity"] < 1 or line["price"] < 0:
            return jsonify({"error": "Quantity must be at least 1 and price cannot be negative"}), 400
        clean_items.append(line)

    subtotal = round(sum(i["price"] * i["quantity"] for i in clean_items), 2)
    total = subtotal  # no VAT/tax applied

    change = None
    if payment_method == "cash" and cash_tendered is not None:
        try:
            cash_tendered = float(cash_tendered)
        except (TypeError, ValueError):
            return jsonify({"error": "Cash tendered must be a number"}), 400
        change = round(cash_tendered - total, 2)

    order = Order(
        order_number="JF-" + (datetime.utcnow() + STORE_UTC_OFFSET).strftime("%Y%m%d%H%M%S"),
        subtotal=subtotal,
        total=total,
        payment_method=payment_method,
        cash_tendered=cash_tendered,
        change=change,
        status="pending",  # enters the kitchen queue
    )
    db.session.add(order)
    db.session.flush()  # get order.id before commit

    for item in clean_items:
        db.session.add(
            OrderItem(
                order_id=order.id,
                product_id=item["id"],
                product_name=item["name"],
                unit_price=item["price"],
                quantity=item["quantity"],
                line_total=round(item["price"] * item["quantity"], 2),
                modifiers=item["modifiers"],
                notes=item["notes"],
            )
        )

        # Advanced ingredient control: deduct stock for any recipe linked to this product
        recipe_rows = ProductIngredient.query.filter_by(product_id=item["id"]).all()
        for row in recipe_rows:
            ingredient = Ingredient.query.get(row.ingredient_id)
            if ingredient:
                ingredient.stock_quantity = max(
                    0, ingredient.stock_quantity - row.quantity_required * item["quantity"]
                )

    db.session.commit()
    return jsonify(order.to_dict()), 201


@app.route("/api/orders/<int:order_id>/status", methods=["PATCH"])
@roles_required("admin", "kitchen")
def update_order_status(order_id):
    """Kitchen & operations management: advance an order through the queue."""
    order = Order.query.get_or_404(order_id)
    if order.status == "cancelled":
        return jsonify({"error": "This order was cancelled"}), 400
    data = request.get_json() or {}
    new_status = data.get("status")

    if new_status not in ORDER_STATUSES:
        return jsonify({"error": f"Status must be one of {ORDER_STATUSES}"}), 400

    order.status = new_status
    db.session.commit()
    return jsonify(order.to_dict())


@app.route("/api/orders/<int:order_id>/cancel", methods=["POST"])
@roles_required("admin", "cashier")
def cancel_order(order_id):
    """Reverses an order that was punched in by mistake: marks it cancelled, puts the
    ingredients back in stock, and keeps who cancelled it and why. Cancelled orders
    are left out of sales, the dashboard and the cash drawer."""
    order = Order.query.get_or_404(order_id)
    claims = get_jwt()

    if order.status == "cancelled":
        return jsonify({"error": "This order is already cancelled"}), 400
    if order.status == "completed" and claims.get("role") != "admin":
        return jsonify({"error": "Only an admin can cancel a completed order"}), 403

    data = request.get_json() or {}
    reason = str(data.get("reason") or "").strip()[:255]
    if not reason:
        return jsonify({"error": "Please give a reason for cancelling"}), 400

    # Put back the ingredients that were used when the order was placed.
    # (Orders made before this feature have no product_id, so they are skipped.)
    for item in order.items:
        if not item.product_id:
            continue
        for row in ProductIngredient.query.filter_by(product_id=item.product_id).all():
            ingredient = Ingredient.query.get(row.ingredient_id)
            if ingredient:
                ingredient.stock_quantity += row.quantity_required * item.quantity

    order.status = "cancelled"
    order.cancelled_at = datetime.utcnow()
    order.cancelled_by = claims.get("name")
    order.cancel_reason = reason
    db.session.commit()
    return jsonify(order.to_dict())


def build_receipt_email_body(order, settings):
    """Plain-text receipt body used in the e-receipt email."""
    lines = [
        settings.store_name,
        settings.receipt_header or "",
        "",
        f"Order #: {order.order_number}",
        f"Date: {(order.created_at + STORE_UTC_OFFSET).strftime('%Y-%m-%d %I:%M %p')}",
        f"Payment: {order.payment_method.upper()}",
        "",
        "-" * 32,
    ]
    for item in order.items:
        line = f"{item.quantity}x {item.product_name}"
        lines.append(f"{line:<24}P{item.line_total:.2f}")
        if item.modifiers:
            lines.append(f"    {item.modifiers}")
        if item.notes:
            lines.append(f"    Note: {item.notes}")
    lines += ["-" * 32, f"{'TOTAL':<24}P{order.total:.2f}"]

    if order.payment_method == "cash" and order.cash_tendered is not None:
        lines.append(f"{'Cash Tendered':<24}P{order.cash_tendered:.2f}")
        lines.append(f"{'Change':<24}P{order.change:.2f}")

    lines += ["", settings.receipt_footer or ""]
    return "\n".join(lines)


@app.route("/api/orders/<int:order_id>/email-receipt", methods=["POST"])
@roles_required("admin", "cashier")
def email_receipt(order_id):
    """Sends the receipt to the customer's email via Gmail SMTP (Flask-Mail)."""
    order = Order.query.get_or_404(order_id)
    if order.status == "cancelled":
        return jsonify({"error": "This order was cancelled"}), 400
    data = request.get_json() or {}
    email = data.get("email", "").strip()

    if not email:
        return jsonify({"error": "Email is required"}), 400

    if not app.config.get("MAIL_USERNAME") or not app.config.get("MAIL_PASSWORD"):
        return jsonify({
            "error": "Email is not configured on the server. Set GMAIL_USER and "
                     "GMAIL_APP_PASSWORD environment variables."
        }), 500

    settings = StoreSettings.query.first()
    if not settings:
        settings = StoreSettings()
        db.session.add(settings)
        db.session.commit()

    try:
        message = Message(
            subject=f"Your Receipt - {settings.store_name} (Order #{order.order_number})",
            recipients=[email],
            body=build_receipt_email_body(order, settings),
        )
        mail.send(message)
    except Exception as exc:
        return jsonify({"error": f"Could not send email: {exc}"}), 502

    order.customer_email = email
    db.session.commit()
    return jsonify({"success": True, "message": f"Receipt sent to {email}"})


# ================= Reporting helpers =================

# The database stores UTC, but the shop runs on Philippine time (UTC+8, no
# daylight saving). "Today" and "hour of day" must follow shop time, so every
# report converts with this offset. Override with STORE_UTC_OFFSET_HOURS.
MAX_REPORT_DAYS = 366
GROUP_OPTIONS = ("day", "hour", "product", "payment")


def local_today():
    return (datetime.utcnow() + STORE_UTC_OFFSET).date()


def local_midnight_as_utc(day):
    """Start of a shop-time calendar day, as the UTC datetime stored in the DB."""
    return datetime.combine(day, datetime.min.time()) - STORE_UTC_OFFSET


def resolve_range(range_key, start_str=None, end_str=None):
    """Turns today / 7d / 30d / custom into (start_date, end_date, since_utc, until_utc)."""
    today = local_today()
    if range_key == "custom":
        try:
            start = datetime.strptime(start_str or "", "%Y-%m-%d").date()
            end = datetime.strptime(end_str or "", "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("Custom range needs start and end dates as YYYY-MM-DD")
        if end < start:
            raise ValueError("End date cannot be before the start date")
        if (end - start).days >= MAX_REPORT_DAYS:
            raise ValueError(f"Date range cannot be longer than {MAX_REPORT_DAYS} days")
    elif range_key == "7d":
        start, end = today - timedelta(days=6), today
    elif range_key == "30d":
        start, end = today - timedelta(days=29), today
    else:
        start = end = today

    since = local_midnight_as_utc(start)
    until = local_midnight_as_utc(end + timedelta(days=1))
    return start, end, since, until


def orders_between(since, until):
    return Order.query.filter(
        Order.created_at >= since, Order.created_at < until, Order.status != "cancelled"
    ).all()


def summarize(orders):
    revenue = round(sum(o.total for o in orders), 2)
    count = len(orders)
    return {
        "revenue": revenue,
        "orders": count,
        "items_sold": sum(i.quantity for o in orders for i in o.items),
        "avg_ticket": round(revenue / count, 2) if count else 0,
    }


def group_orders(orders, group_by, start, end, top=10):
    """Builds the rows for the bar graph / table. Each row has a label plus
    revenue, orders, items_sold and avg_ticket so the screen can chart any metric."""
    buckets = {}

    def bucket(label):
        return buckets.setdefault(
            label, {"label": label, "revenue": 0.0, "orders": 0, "items_sold": 0}
        )

    def finish(rows):
        for row in rows:
            row["revenue"] = round(row["revenue"], 2)
            row["avg_ticket"] = round(row["revenue"] / row["orders"], 2) if row["orders"] else 0
        return rows

    if group_by == "product":
        for order in orders:
            counted = set()
            for item in order.items:
                row = bucket(item.product_name)
                row["revenue"] += item.line_total
                row["items_sold"] += item.quantity
                if item.product_name not in counted:  # count each order once per product
                    row["orders"] += 1
                    counted.add(item.product_name)
        ranked = sorted(buckets.values(), key=lambda r: r["revenue"], reverse=True)
        return finish(ranked[:top])

    for order in orders:
        local = order.created_at + STORE_UTC_OFFSET
        if group_by == "day":
            label = local.date().isoformat()
        elif group_by == "hour":
            label = f"{local.hour:02d}:00"
        else:
            label = order.payment_method
        row = bucket(label)
        row["revenue"] += order.total
        row["orders"] += 1
        row["items_sold"] += sum(i.quantity for i in order.items)

    if group_by == "day":
        day = start
        while day <= end:  # show quiet days as empty bars instead of skipping them
            bucket(day.isoformat())
            day += timedelta(days=1)
        rows = [buckets[key] for key in sorted(buckets)]
    elif group_by == "hour":
        if buckets:
            hours = sorted(int(key[:2]) for key in buckets)
            for hour in range(hours[0], hours[-1] + 1):
                bucket(f"{hour:02d}:00")
        rows = [buckets[key] for key in sorted(buckets)]
    else:
        rows = sorted(buckets.values(), key=lambda r: r["revenue"], reverse=True)
    return finish(rows)


def cancelled_summary(since, until):
    """How many orders were cancelled in the period, and their value (shown on the dashboard)."""
    cancelled = Order.query.filter(
        Order.created_at >= since, Order.created_at < until, Order.status == "cancelled"
    ).all()
    return {"orders": len(cancelled), "amount": round(sum(o.total for o in cancelled), 2)}


def csv_safe(value):
    """Stops spreadsheet apps from running cell text that starts with = + - @ as a formula."""
    text = str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@") else text


def csv_response(rows, totals, group_by, start, end):
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([group_by.title(), "Revenue", "Orders", "Items Sold", "Avg Ticket"])
    for row in rows:
        writer.writerow([csv_safe(row["label"]), row["revenue"], row["orders"],
                         row["items_sold"], row["avg_ticket"]])
    writer.writerow([])
    writer.writerow(["TOTAL (all orders in range)", totals["revenue"], totals["orders"],
                     totals["items_sold"], totals["avg_ticket"]])
    filename = f"sales-by-{group_by}-{start}-to-{end}.csv"
    return Response(
        buffer.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ================= Real-time sales tracking (admin + cashier) =================


@app.route("/api/sales/live", methods=["GET"])
@roles_required("admin", "cashier")
def live_sales():
    """Polled by the POS ticker every few seconds for a live revenue/order count."""
    today_start = local_midnight_as_utc(local_today())
    todays_orders = Order.query.filter(
        Order.created_at >= today_start, Order.status != "cancelled"
    ).all()

    revenue_today = round(sum(o.total for o in todays_orders), 2)
    pending_in_kitchen = Order.query.filter(
        Order.status.in_(["pending", "preparing"])
    ).count()

    return jsonify(
        {
            "revenue_today": revenue_today,
            "orders_today": len(todays_orders),
            "pending_in_kitchen": pending_in_kitchen,
        }
    )


# ================= Reporting & analytics (admin only) =================


@app.route("/api/reports/custom", methods=["GET"])
@roles_required("admin")
def custom_report():
    """Customizable report. Query params:
      range     today | 7d | 30d | custom   (custom also needs start and end, YYYY-MM-DD)
      group_by  day | hour | product | payment
      top       how many products to keep when group_by=product (1-50)
      format    csv to download the same report as a spreadsheet file
    """
    group_by = request.args.get("group_by", "day")
    if group_by not in GROUP_OPTIONS:
        return jsonify({"error": f"group_by must be one of {list(GROUP_OPTIONS)}"}), 400

    try:
        start, end, since, until = resolve_range(
            request.args.get("range", "today"),
            request.args.get("start"),
            request.args.get("end"),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    top = max(1, min(request.args.get("top", 10, type=int), 50))

    orders = orders_between(since, until)
    rows = group_orders(orders, group_by, start, end, top)
    totals = summarize(orders)

    if request.args.get("format") == "csv":
        return csv_response(rows, totals, group_by, start, end)

    return jsonify(
        {
            "range": {"start": start.isoformat(), "end": end.isoformat()},
            "group_by": group_by,
            "rows": rows,
            "totals": totals,
            "cancelled": cancelled_summary(since, until),
        }
    )


@app.route("/api/reports/summary", methods=["GET"])
@roles_required("admin")
def reports_summary():
    try:
        start, end, since, until = resolve_range(
            request.args.get("range", "today"),
            request.args.get("start"),
            request.args.get("end"),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    orders = orders_between(since, until)
    totals = summarize(orders)
    payments = group_orders(orders, "payment", start, end)
    products = group_orders(orders, "product", start, end, 10)

    return jsonify(
        {
            "range": request.args.get("range", "today"),
            "total_revenue": totals["revenue"],
            "total_transactions": totals["orders"],
            "average_ticket": totals["avg_ticket"],
            "payment_split": {p["label"]: p["revenue"] for p in payments},
            "top_items": [
                {"name": p["label"], "quantity": p["items_sold"], "revenue": p["revenue"]}
                for p in products
            ],
        }
    )


# ================= Advanced inventory & ingredient control (admin only) =================


@app.route("/api/ingredients", methods=["GET"])
@roles_required("admin")
def list_ingredients():
    ingredients = Ingredient.query.order_by(Ingredient.name).all()
    return jsonify([i.to_dict() for i in ingredients])


@app.route("/api/ingredients/low-stock", methods=["GET"])
@roles_required("admin")
def low_stock():
    """Ingredients at or below their reorder level - feeds the notification bell."""
    items = [i for i in Ingredient.query.order_by(Ingredient.name).all() if i.is_low()]
    return jsonify({"count": len(items), "items": [i.to_dict() for i in items]})


@app.route("/api/ingredients", methods=["POST"])
@roles_required("admin")
def create_ingredient():
    data = request.get_json() or {}
    ingredient = Ingredient(
        name=data.get("name"),
        unit=data.get("unit", "pcs"),
        stock_quantity=data.get("stock_quantity", 0),
        reorder_level=data.get("reorder_level", LOW_STOCK_MINIMUM),
    )
    db.session.add(ingredient)
    db.session.commit()
    return jsonify(ingredient.to_dict()), 201


@app.route("/api/ingredients/<int:ingredient_id>", methods=["PATCH"])
@roles_required("admin")
def update_ingredient(ingredient_id):
    ingredient = Ingredient.query.get_or_404(ingredient_id)
    data = request.get_json() or {}

    for field in ["name", "unit", "stock_quantity", "reorder_level"]:
        if field in data:
            setattr(ingredient, field, data[field])

    db.session.commit()
    return jsonify(ingredient.to_dict())


@app.route("/api/ingredients/<int:ingredient_id>/restock", methods=["POST"])
@roles_required("admin")
def restock_ingredient(ingredient_id):
    ingredient = Ingredient.query.get_or_404(ingredient_id)
    data = request.get_json() or {}
    amount = float(data.get("amount", 0))

    ingredient.stock_quantity += amount
    db.session.commit()
    return jsonify(ingredient.to_dict())


# ================= Shift management =================


@app.route("/api/shifts/current", methods=["GET"])
@roles_required("admin", "cashier")
def current_shift():
    """Returns the open shift (if any) plus live stats: cash sales, total sales,
    transaction count since it opened."""
    shift = Shift.query.filter_by(status="open").order_by(Shift.id.desc()).first()
    if not shift:
        return jsonify(None)

    orders_since = Order.query.filter(
        Order.created_at >= shift.opened_at, Order.status != "cancelled"
    ).all()
    cash_sales = round(sum(o.total for o in orders_since if o.payment_method == "cash"), 2)
    total_sales = round(sum(o.total for o in orders_since), 2)

    data = shift.to_dict()
    data.update(
        {
            "cash_sales": cash_sales,
            "total_sales": total_sales,
            "transaction_count": len(orders_since),
            "expected_cash_in_drawer": round(shift.opening_float + cash_sales, 2),
        }
    )
    return jsonify(data)


@app.route("/api/shifts", methods=["GET"])
@roles_required("admin")
def shift_history():
    shifts = Shift.query.order_by(Shift.id.desc()).limit(20).all()
    return jsonify([s.to_dict() for s in shifts])


@app.route("/api/shifts/open", methods=["POST"])
@roles_required("admin")
def open_shift():
    existing = Shift.query.filter_by(status="open").first()
    if existing:
        return jsonify({"error": "A shift is already open"}), 400

    data = request.get_json() or {}
    shift = Shift(opening_float=float(data.get("opening_float", 0)), status="open")
    db.session.add(shift)
    db.session.commit()
    return jsonify(shift.to_dict()), 201


@app.route("/api/shifts/<int:shift_id>/close", methods=["POST"])
@roles_required("admin")
def close_shift(shift_id):
    shift = Shift.query.get_or_404(shift_id)
    if shift.status == "closed":
        return jsonify({"error": "Shift is already closed"}), 400

    data = request.get_json() or {}
    counted_cash = float(data.get("counted_cash", 0))

    orders_since = Order.query.filter(
        Order.created_at >= shift.opened_at, Order.status != "cancelled"
    ).all()
    cash_sales = sum(o.total for o in orders_since if o.payment_method == "cash")
    expected_cash = round(shift.opening_float + cash_sales, 2)

    shift.counted_cash = counted_cash
    shift.expected_cash = expected_cash
    shift.variance = round(counted_cash - expected_cash, 2)
    shift.notes = data.get("notes")
    shift.status = "closed"
    shift.closed_at = datetime.now()

    db.session.commit()
    return jsonify(shift.to_dict())


# ================= Store settings =================


@app.route("/api/settings", methods=["GET"])
@roles_required("admin", "cashier")
def get_settings():
    settings = StoreSettings.query.first()
    if not settings:
        settings = StoreSettings()
        db.session.add(settings)
        db.session.commit()
    return jsonify(settings.to_dict())


@app.route("/api/settings", methods=["PUT"])
@roles_required("admin")
def update_settings():
    settings = StoreSettings.query.first()
    if not settings:
        settings = StoreSettings()
        db.session.add(settings)

    data = request.get_json() or {}
    for field in ["store_name", "address", "phone", "email", "receipt_header", "receipt_footer"]:
        if field in data:
            setattr(settings, field, data[field])

    db.session.commit()
    return jsonify(settings.to_dict())


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)