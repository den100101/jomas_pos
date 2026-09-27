from app import app
from models import Category, Ingredient, Product, ProductIngredient, StoreSettings, User, db

MENU = {
    "Rice Meals": [
        ("Special Nasi Goreng Solo", 88),
        ("Special Nasi Goreng Sharing", 168),
        ("Beef Tapa", 105),
        ("Chicken Wing", 108),
        ("Fried Chicken", 130),
        ("Hungarian", 112),
        ("Gyoza / Siomai", 85),
        ("Liempo", 130),
        ("Pork Sisig", 135),
        ("Tofu Sisig", 90),
    ],
    "Ala Carte": [
        ("Bucket Wings", 175),
        ("Gyoza", 80),
        ("Nuggets", 110),
        ("Pork Sioma", 70),
        ("Sauteed Hotdog", 75),
        ("Shanghai Rolls", 80),
        ("Tofu (Sisig / SRI)", 75),
    ],
    "Add-ons": [
        ("Egg", 15),
        ("Bacon", 60),
        ("Gyoza / Siomai", 45),
        ("Hotdog", 45),
        ("Longganisa", 60),
        ("Nuggets", 65),
        ("Shanghai Rolls", 50),
    ],
    "Extra Rice": [
        ("Curry", 32),
        ("Egg Rice", 38),
        ("Java", 30),
        ("Nasi Goreng", 38),
        ("Yangchow", 35),
        ("Turmeric", 38),
        ("Plain Rice", 18),
    ],
    "Snacks & Sides": [
        ("Cheese Stick", 50),
        ("Cheese Stick w/ Jalapeño", 75),
        ("Chipcharap", 50),
        ("Fries (B.C.S.)", 65),
    ],
    "Drinks": [
        ("Iced Tea (Regular)", 25),
        ("Iced Tea (Large)", 35),
        ("Bottled Water", 20),
        ("Soda (Can)", 30),
    ],
}

# Starter ingredients: (name, unit, starting stock, reorder level)
INGREDIENTS = [
    ("Jasmine Rice", "kg", 50, 10),
    ("Farm Fresh Eggs", "pcs", 200, 40),
    ("Cooking Oil", "l", 20, 5),
    ("Garlic", "kg", 8, 2),
    ("Beef Tapa Cuts", "kg", 15, 3),
    ("Chicken Wings", "kg", 20, 5),
    ("Whole Chicken", "kg", 18, 4),
    ("Pork Belly (Liempo)", "kg", 15, 3),
    ("Pork Sisig Mix", "kg", 12, 3),
    ("Gyoza / Siomai Pcs", "pcs", 300, 60),
]

# Recipe links: product name -> [(ingredient name, quantity used per 1 order)]
RECIPES = {
    "Special Nasi Goreng Solo": [("Jasmine Rice", 0.3), ("Farm Fresh Eggs", 1), ("Garlic", 0.02)],
    "Beef Tapa": [("Beef Tapa Cuts", 0.2), ("Jasmine Rice", 0.25), ("Farm Fresh Eggs", 1)],
    "Chicken Wing": [("Chicken Wings", 0.25), ("Cooking Oil", 0.05)],
    "Fried Chicken": [("Whole Chicken", 0.3), ("Cooking Oil", 0.08)],
    "Liempo": [("Pork Belly (Liempo)", 0.25)],
    "Pork Sisig": [("Pork Sisig Mix", 0.25), ("Garlic", 0.01)],
    "Gyoza / Siomai": [("Gyoza / Siomai Pcs", 6)],
}

STAFF = [
    ("admin", "Admin User", "jomaz_admin!11.", "admin"),
    ("cashier", "Felix (Cashier)", "jmz_cashier.", "cashier"),
    ("kitchen", "Kitchen Staff", "kitchen_jmz23.", "kitchen"),
]

def seed_staff():
    """Creates or RESETS the default staff accounts to match the STAFF
    list above every time this script runs. Handy while you're still
    setting things up - edit a password in STAFF and re-run seed.py to
    apply it immediately.

    IMPORTANT: once you're live with real staff accounts, remove this
    function (or at least stop calling it from seed()) so a stray
    re-run of seed.py can never silently reset someone's real password
    back to a default."""
    for username, name, password, role in STAFF:
        user = User.query.filter_by(username=username).first()
        if not user:
            user = User(username=username, name=name, role=role)
            db.session.add(user)
        user.name = name
        user.role = role
        user.set_password(password)

    db.session.commit()
    print("Staff accounts created/reset to match the STAFF list. Login details:")
    for username, name, password, role in STAFF:
        print(f"  {role:8s} -> username: {username:10s} password: {password}")
    print("Remember to remove seed_staff() once you're done setting up.")

# Default staff logins. CHANGE THESE PASSWORDS after your first login.


def slugify(name):
    return name.lower().replace(" ", "-").replace("&", "and")


def seed_menu():
    if Category.query.first():
        print("Menu already seeded. Skipping.")
        return

    product_lookup = {}
    for category_name, items in MENU.items():
        category = Category(name=category_name, slug=slugify(category_name))
        db.session.add(category)
        db.session.flush()

        for item_name, price in items:
            product = Product(name=item_name, price=price, category_id=category.id)
            db.session.add(product)
            db.session.flush()
            product_lookup[item_name] = product

    ingredient_lookup = {}
    for name, unit, stock, reorder in INGREDIENTS:
        ingredient = Ingredient(name=name, unit=unit, stock_quantity=stock, reorder_level=reorder)
        db.session.add(ingredient)
        db.session.flush()
        ingredient_lookup[name] = ingredient

    for product_name, ingredients_used in RECIPES.items():
        product = product_lookup.get(product_name)
        if not product:
            continue
        for ingredient_name, qty in ingredients_used:
            ingredient = ingredient_lookup.get(ingredient_name)
            if not ingredient:
                continue
            db.session.add(
                ProductIngredient(
                    product_id=product.id, ingredient_id=ingredient.id, quantity_required=qty
                )
            )

    db.session.commit()
    print("Menu, ingredients, and recipes seeded successfully.")


def seed_store_settings():
    if StoreSettings.query.first():
        print("Store settings already exist. Skipping.")
        return

    db.session.add(
        StoreSettings(
            store_name="JoMa's Arroz Frito",
            address="123 Malakas St, Brgy. Central, Quezon City, Metro Manila",
            phone="+63 917 123 4567",
            email="hello@jomasarroz.ph",
            receipt_header="The Best Fried Rice in Town!",
            receipt_footer="Thank you for dining with us!",
        )
    )
    db.session.commit()
    print("Default store settings created.")



def seed():
    with app.app_context():
        db.create_all()
        seed_menu()
        seed_store_settings()
        seed_staff()


if __name__ == "__main__":
    seed()