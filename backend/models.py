from flask_sqlalchemy import SQLAlchemy
 
from werkzeug.security import generate_password_hash, check_password_hash
 
USER_ROLES = ["admin", "cashier", "kitchen"]

db = SQLAlchemy()



class User(db.Model):
    __tablename__ = "users"
 
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="cashier")
    is_active = db.Column(db.Boolean, nullable=False, default=True)
 
    def set_password(self, raw_password):
        self.password_hash = generate_password_hash(raw_password)
 
    def check_password(self, raw_password):
        return check_password_hash(self.password_hash, raw_password)
 
    def to_dict(self):
        return {"id": self.id, "username": self.username, "name": self.name, "role": self.role}


class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    slug = db.Column(db.String(50), unique=True, nullable=False)

    products = db.relationship("Product", backref="category", lazy=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "slug": self.slug}


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False)

    ingredients = db.relationship(
        "ProductIngredient", backref="product", lazy=True, cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "price": self.price,
            "category_id": self.category_id,
        }


# ---------- Inventory & ingredient control ----------


class Ingredient(db.Model):
    __tablename__ = "ingredients"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    unit = db.Column(db.String(20), nullable=False, default="pcs")  # kg, g, l, ml, pcs...
    stock_quantity = db.Column(db.Float, nullable=False, default=0)
    reorder_level = db.Column(db.Float, nullable=False, default=0)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "unit": self.unit,
            "stock_quantity": self.stock_quantity,
            "reorder_level": self.reorder_level,
            "low_stock": self.stock_quantity <= self.reorder_level,
        }


class ProductIngredient(db.Model):
    """How much of an ingredient a single unit of a product consumes."""

    __tablename__ = "product_ingredients"

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    ingredient_id = db.Column(db.Integer, db.ForeignKey("ingredients.id"), nullable=False)
    quantity_required = db.Column(db.Float, nullable=False, default=0)

    ingredient = db.relationship("Ingredient")

    def to_dict(self):
        return {
            "id": self.id,
            "product_id": self.product_id,
            "ingredient_id": self.ingredient_id,
            "ingredient_name": self.ingredient.name if self.ingredient else None,
            "quantity_required": self.quantity_required,
        }


# ---------- Orders / kitchen / payments ----------

ORDER_STATUSES = ["pending", "preparing", "ready", "completed"]
PAYMENT_METHODS = ["cash"]


class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(db.Integer, primary_key=True)
    order_number = db.Column(db.String(30), unique=True, nullable=False)
    subtotal = db.Column(db.Float, nullable=False)
    total = db.Column(db.Float, nullable=False)
    payment_method = db.Column(db.String(20), nullable=False, default="cash")
    cash_tendered = db.Column(db.Float, nullable=True)
    change = db.Column(db.Float, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="pending")
    customer_email = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    items = db.relationship(
        "OrderItem", backref="order", lazy=True, cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "order_number": self.order_number,
            "subtotal": self.subtotal,
            "total": self.total,
            "payment_method": self.payment_method,
            "cash_tendered": self.cash_tendered,
            "change": self.change,
            "status": self.status,
            "customer_email": self.customer_email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "items": [item.to_dict() for item in self.items],
        }


class OrderItem(db.Model):
    __tablename__ = "order_items"

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False)
    product_name = db.Column(db.String(100), nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    line_total = db.Column(db.Float, nullable=False)
    modifiers = db.Column(db.String(255), nullable=True)  # e.g. "Rice: Java, Egg: Sunny Side Up"
    notes = db.Column(db.String(255), nullable=True)  # e.g. "less spicy, no onions"

    def to_dict(self):
        return {
            "id": self.id,
            "product_name": self.product_name,
            "unit_price": self.unit_price,
            "quantity": self.quantity,
            "line_total": self.line_total,
            "modifiers": self.modifiers,
            "notes": self.notes,
        }


# ---------- Shift management ----------


class Shift(db.Model):
    __tablename__ = "shifts"

    id = db.Column(db.Integer, primary_key=True)
    opened_at = db.Column(db.DateTime, server_default=db.func.now())
    closed_at = db.Column(db.DateTime, nullable=True)
    opening_float = db.Column(db.Float, nullable=False, default=0)
    counted_cash = db.Column(db.Float, nullable=True)
    expected_cash = db.Column(db.Float, nullable=True)
    variance = db.Column(db.Float, nullable=True)
    notes = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="open")  # open | closed

    def to_dict(self):
        return {
            "id": self.id,
            "opened_at": self.opened_at.isoformat() if self.opened_at else None,
            "closed_at": self.closed_at.isoformat() if self.closed_at else None,
            "opening_float": self.opening_float,
            "counted_cash": self.counted_cash,
            "expected_cash": self.expected_cash,
            "variance": self.variance,
            "notes": self.notes,
            "status": self.status,
        }


# ---------- Store settings ----------


class StoreSettings(db.Model):
    __tablename__ = "store_settings"

    id = db.Column(db.Integer, primary_key=True)
    store_name = db.Column(db.String(120), nullable=False, default="JoMa's Arroz Frito")
    address = db.Column(db.String(255), nullable=True, default="")
    phone = db.Column(db.String(50), nullable=True, default="")
    email = db.Column(db.String(120), nullable=True, default="")
    receipt_header = db.Column(db.String(255), nullable=True, default="The Best Fried Rice in Town!")
    receipt_footer = db.Column(
        db.String(255), nullable=True, default="Thank you for dining with us!"
    )
    currency = db.Column(db.String(10), nullable=False, default="PHP")

    def to_dict(self):
        return {
            "id": self.id,
            "store_name": self.store_name,
            "address": self.address,
            "phone": self.phone,
            "email": self.email,
            "receipt_header": self.receipt_header,
            "receipt_footer": self.receipt_footer,
            "currency": self.currency,
        }
