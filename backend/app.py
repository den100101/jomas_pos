from datetime import datetime, timedelta

from flask import Flask, jsonify, request
from flask_cors import CORS

from config import Config
from models import (
    ORDER_STATUSES,
    PAYMENT_METHODS,
    Category,
    Ingredient,
    Order,
    OrderItem,
    Product,
    ProductIngredient,
    Shift,
    StoreSettings,
    db,
)

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)
db.init_app(app)


# ================= Auth (demo) =================


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if username and password:
        return jsonify({"success": True, "user": {"name": "Admin User", "role": "Admin"}})
    return jsonify({"success": False, "message": "Invalid credentials"}), 401


# ================= Menu =================


@app.route("/api/categories", methods=["GET"])
def get_categories():
    categories = Category.query.order_by(Category.id).all()
    return jsonify([c.to_dict() for c in categories])


@app.route("/api/products", methods=["GET"])
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
def list_orders():
    """Supports ?status=pending,preparing for the kitchen board and ?limit=N for reports."""
    query = Order.query

    status_param = request.args.get("status")
    if status_param:
        statuses = [s.strip() for s in status_param.split(",")]
        query = query.filter(Order.status.in_(statuses))

    limit = int(request.args.get("limit", 100))
    orders = query.order_by(Order.id.desc()).limit(limit).all()
    return jsonify([o.to_dict() for o in orders])


@app.route("/api/orders/<int:order_id>", methods=["GET"])
def get_order(order_id):
    order = Order.query.get_or_404(order_id)
    return jsonify(order.to_dict())


@app.route("/api/orders", methods=["POST"])
def create_order():
    data = request.get_json() or {}
    cart = data.get("items", [])
    payment_method = data.get("payment_method", "cash")
    cash_tendered = data.get("cash_tendered")

    if not cart:
        return jsonify({"error": "Cart is empty"}), 400

    if payment_method not in PAYMENT_METHODS:
        return jsonify({"error": "Invalid payment method"}), 400

    subtotal = round(sum(item["price"] * item["quantity"] for item in cart), 2)
    total = subtotal  # no VAT/tax applied

    change = None
    if payment_method == "cash" and cash_tendered is not None:
        change = round(cash_tendered - total, 2)

    order = Order(
        order_number="JF-" + datetime.now().strftime("%Y%m%d%H%M%S"),
        subtotal=subtotal,
        total=total,
        payment_method=payment_method,
        cash_tendered=cash_tendered,
        change=change,
        status="pending",  # enters the kitchen queue
    )
    db.session.add(order)
    db.session.flush()  # get order.id before commit

    for item in cart:
        db.session.add(
            OrderItem(
                order_id=order.id,
                product_name=item["name"],
                unit_price=item["price"],
                quantity=item["quantity"],
                line_total=round(item["price"] * item["quantity"], 2),
                modifiers=item.get("modifiers"),
                notes=item.get("notes"),
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
def update_order_status(order_id):
    """Kitchen & operations management: advance an order through the queue."""
    order = Order.query.get_or_404(order_id)
    data = request.get_json() or {}
    new_status = data.get("status")

    if new_status not in ORDER_STATUSES:
        return jsonify({"error": f"Status must be one of {ORDER_STATUSES}"}), 400

    order.status = new_status
    db.session.commit()
    return jsonify(order.to_dict())


@app.route("/api/orders/<int:order_id>/email-receipt", methods=["POST"])
def email_receipt(order_id):
    """Digital e-receipt. Stubbed: stores the email and reports success.
    Swap in a real mail provider (e.g. Flask-Mail) when ready."""
    order = Order.query.get_or_404(order_id)
    data = request.get_json() or {}
    email = data.get("email", "").strip()

    if not email:
        return jsonify({"error": "Email is required"}), 400

    order.customer_email = email
    db.session.commit()
    return jsonify({"success": True, "message": f"Receipt sent to {email}"})


# ================= Real-time sales tracking =================


@app.route("/api/sales/live", methods=["GET"])
def live_sales():
    """Polled by the POS ticker every few seconds for a live revenue/order count."""
    today_start = datetime.combine(datetime.today(), datetime.min.time())
    todays_orders = Order.query.filter(Order.created_at >= today_start).all()

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


# ================= Reporting & analytics =================


@app.route("/api/reports/summary", methods=["GET"])
def reports_summary():
    range_param = request.args.get("range", "today")  # today | 7d | 30d
    days = {"today": 1, "7d": 7, "30d": 30}.get(range_param, 1)
    since = datetime.now() - timedelta(days=days)

    orders = Order.query.filter(Order.created_at >= since).all()

    total_revenue = round(sum(o.total for o in orders), 2)
    total_transactions = len(orders)
    average_ticket = round(total_revenue / total_transactions, 2) if total_transactions else 0

    payment_split = {}
    for o in orders:
        payment_split[o.payment_method] = payment_split.get(o.payment_method, 0) + o.total
    payment_split = {k: round(v, 2) for k, v in payment_split.items()}

    item_totals = {}
    for o in orders:
        for item in o.items:
            entry = item_totals.setdefault(item.product_name, {"quantity": 0, "revenue": 0})
            entry["quantity"] += item.quantity
            entry["revenue"] += item.line_total

    top_items = sorted(
        [{"name": k, **v} for k, v in item_totals.items()],
        key=lambda x: x["revenue"],
        reverse=True,
    )[:10]

    return jsonify(
        {
            "range": range_param,
            "total_revenue": total_revenue,
            "total_transactions": total_transactions,
            "average_ticket": average_ticket,
            "payment_split": payment_split,
            "top_items": top_items,
        }
    )


# ================= Advanced inventory & ingredient control =================


@app.route("/api/ingredients", methods=["GET"])
def list_ingredients():
    ingredients = Ingredient.query.order_by(Ingredient.name).all()
    return jsonify([i.to_dict() for i in ingredients])


@app.route("/api/ingredients", methods=["POST"])
def create_ingredient():
    data = request.get_json() or {}
    ingredient = Ingredient(
        name=data.get("name"),
        unit=data.get("unit", "pcs"),
        stock_quantity=data.get("stock_quantity", 0),
        reorder_level=data.get("reorder_level", 0),
    )
    db.session.add(ingredient)
    db.session.commit()
    return jsonify(ingredient.to_dict()), 201


@app.route("/api/ingredients/<int:ingredient_id>", methods=["PATCH"])
def update_ingredient(ingredient_id):
    ingredient = Ingredient.query.get_or_404(ingredient_id)
    data = request.get_json() or {}

    for field in ["name", "unit", "stock_quantity", "reorder_level"]:
        if field in data:
            setattr(ingredient, field, data[field])

    db.session.commit()
    return jsonify(ingredient.to_dict())


@app.route("/api/ingredients/<int:ingredient_id>/restock", methods=["POST"])
def restock_ingredient(ingredient_id):
    ingredient = Ingredient.query.get_or_404(ingredient_id)
    data = request.get_json() or {}
    amount = float(data.get("amount", 0))

    ingredient.stock_quantity += amount
    db.session.commit()
    return jsonify(ingredient.to_dict())


# ================= Shift management =================


@app.route("/api/shifts/current", methods=["GET"])
def current_shift():
    """Returns the open shift (if any) plus live stats: cash sales, total sales,
    transaction count since it opened."""
    shift = Shift.query.filter_by(status="open").order_by(Shift.id.desc()).first()
    if not shift:
        return jsonify(None)

    orders_since = Order.query.filter(Order.created_at >= shift.opened_at).all()
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
def shift_history():
    shifts = Shift.query.order_by(Shift.id.desc()).limit(20).all()
    return jsonify([s.to_dict() for s in shifts])


@app.route("/api/shifts/open", methods=["POST"])
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
def close_shift(shift_id):
    shift = Shift.query.get_or_404(shift_id)
    if shift.status == "closed":
        return jsonify({"error": "Shift is already closed"}), 400

    data = request.get_json() or {}
    counted_cash = float(data.get("counted_cash", 0))

    orders_since = Order.query.filter(Order.created_at >= shift.opened_at).all()
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
def get_settings():
    settings = StoreSettings.query.first()
    if not settings:
        settings = StoreSettings()
        db.session.add(settings)
        db.session.commit()
    return jsonify(settings.to_dict())


@app.route("/api/settings", methods=["PUT"])
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
    app.run(debug=True, port=5000)
