# JoMa's Arroz Frito - Point of Sale

A full-stack POS app:
- **Frontend:** React (plain CSS, no UI framework)
- **Backend:** Flask + Flask-SQLAlchemy
- **Database:** MySQL

Seeded with JoMa's real menu (Rice Meals, Ala Carte, Add-ons, Extra Rice, Snacks & Sides, Drinks)
with the correct prices from the actual menu boards. **No VAT/tax is applied** — prices shown
are final prices, and order totals equal the sum of line items.

## Features

- **Real-time Sales Tracking** — a live ticker in the top bar (polls `/api/sales/live` every
  10s) showing today's revenue, order count, and orders currently in the kitchen queue.
- **Order Customization** — Rice Meal items open a customization modal (rice choice, egg
  style, special instructions) before being added to the cart; instructions travel with the
  order all the way to the kitchen board and the receipt.
- **Digital Receipt: Print & E-Receipt** — the receipt page has a Print button (browser print,
  with print-only CSS that hides everything but the ticket) and an e-receipt form that emails
  the customer via `/api/orders/<id>/email-receipt` (stubbed — wire in a real mail provider like
  Flask-Mail when ready). Receipt header/footer text comes from Settings.
- **Payment** — Cash only, with quick-cash buttons and automatic change calculation.
- **Advanced Inventory & Ingredient Control** — an `Ingredient` model with stock levels and
  reorder thresholds, plus a `ProductIngredient` recipe table. Selling a product automatically
  deducts the ingredients it consumes. The Inventory page shows low-stock alerts and lets you
  restock or add new ingredients.
- **Kitchen & Operations Management** — a Kitchen board (Pending → Preparing → Ready →
  Completed) that auto-refreshes every 8s. Staff advance orders with one click; customization
  notes are shown on each ticket.
- **Reporting & Analytics** — a Reports page with Today/7-Day/30-Day ranges, total revenue,
  transaction count, average ticket, a top-selling-items breakdown, and a sales-by-payment-method
  breakdown (plain CSS bar charts, no chart library needed).
- **Shift Management** — open a shift with a starting cash float, watch live stats (duration,
  expected cash in drawer, cash sales, transaction count), and close it with a counted-cash
  reconciliation that reports any variance. Full shift history is kept.
- **Settings** — a real, editable store profile: store name, address, phone, email, and receipt
  header/footer text — saved to the database and reflected live on printed/e-receipts.

## 1. Database setup

```sql
CREATE DATABASE jomas_pos;
```

## 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Set your MySQL credentials (edit `config.py` directly, or export env vars):

```bash
export DB_USER=root
export DB_PASSWORD=yourpassword
export DB_HOST=localhost
export DB_NAME=jomas_pos
```

Create tables and seed the menu, starter ingredients, and default store settings:

```bash
python seed.py
```

Run the API server:

```bash
python app.py
```

The API runs at `http://localhost:5000/api`.

## 3. Frontend setup

```bash
cd frontend
npm install
npm start
```

The app runs at `http://localhost:3000`.

If your backend isn't on `localhost:5000`, set:

```bash
export REACT_APP_API_URL=http://your-backend-host:5000/api
```

## 4. Using the app

1. Log in with any username/password (demo auth — swap out `/api/login` for real auth later).
2. On **Shift**, open a shift with your opening cash float before taking orders.
3. Browse the menu by category. Rice Meal items open a customization modal first.
4. Add items to the cart and complete the sale (Cash) — this deducts
   ingredient stock for any product with a recipe, and creates the order in MySQL.
5. The order lands in the **Kitchen** board as "Pending" — advance it through prep to served.
6. On the receipt screen, print it or send an e-receipt by email.
7. Check **Reports** for revenue/analytics and **Inventory** for stock levels.
8. At the end of the day, go back to **Shift**, count your drawer, and close the shift.
9. Update store name, address, and receipt text any time in **Settings**.

## Project structure

```
backend/
  app.py         Flask app + REST API (menu, orders, kitchen status, payments,
                  ingredients, live sales, reports, shifts, settings, e-receipt)
  models.py      SQLAlchemy models: Category, Product, Ingredient, ProductIngredient,
                  Order, OrderItem, Shift, StoreSettings
  config.py      MySQL connection config
  seed.py        Seeds the real menu + starter ingredients + sample recipes + default settings
  requirements.txt

frontend/
  src/
    api.js                      Axios client (plain JS, no JSX)
    App.jsx                     Routes
    index.jsx                   React entry point
    components/
      Layout.jsx                Shared top nav + sales ticker
      SalesTicker.jsx           Real-time revenue/orders widget
      CustomizeModal.jsx        Order customization popup
    pages/
      Login.jsx
      POS.jsx                   Menu, cart, customization, payment methods
      Receipt.jsx                Print + e-receipt, pulls header/footer from Settings
      Kitchen.jsx                Kitchen & operations board
      Inventory.jsx              Ingredient stock + restock + low-stock alerts
      Reports.jsx                Analytics (range filter, top items, payment split)
      Shift.jsx                  Open/close shift, live drawer stats, history
      Settings.jsx               Store profile + receipt header/footer, saved to the database
    styles/index.css            All plain CSS styling (incl. print styles)
```

Every page listed above is fully wired end-to-end from the database to the UI — there are no
placeholder pages left.
