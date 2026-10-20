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

