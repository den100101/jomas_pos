"""
One-time update of the existing database for the cancel-order feature.
Adds the new columns if they are missing; safe to run more than once.

Run this BEFORE pushing the new code:   python migrate.py
(It uses the same DB settings as the app, so point your .env at the live database.)
"""
from sqlalchemy import inspect, text

from app import app
from models import db

NEW_COLUMNS = {
    "order_items": [
        ("product_id", "INT NULL"),  # which menu item was sold (needed to restore stock)
    ],
    "orders": [
        ("cancelled_at", "DATETIME NULL"),
        ("cancelled_by", "VARCHAR(120) NULL"),
        ("cancel_reason", "VARCHAR(255) NULL"),
    ],
}

with app.app_context():
    inspector = inspect(db.engine)
    for table, columns in NEW_COLUMNS.items():
        existing = {col["name"] for col in inspector.get_columns(table)}
        for name, definition in columns:
            if name in existing:
                print(f"{table}.{name} already exists - skipped")
            else:
                db.session.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))
                print(f"Added {table}.{name}")
    db.session.commit()
    print("Done.")