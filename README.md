# RestaurantOS

An all-in-one restaurant business management system — QR ordering, table management, a kitchen display system, POS billing, and an owner/manager dashboard, built as a single Next.js app.

This is a **Phase 1 MVP** (auth & roles, menu management, QR ordering, kitchen display, POS, billing, table management, live dashboard analytics) plus **inventory & recipe costing**, **purchase management** (suppliers, purchase orders, invoices, payments/dues), **CRM & loyalty** (customer profiles, points, membership tiers, referrals, coupons), **reservation management** (staff and public table bookings, day-agenda view, table assignment/seating), **multi-branch support** (one account operating several restaurant locations, with a shared customer/loyalty base and an owner-level branch switcher), and **SaaS billing** (subscription plans that gate how many branches/staff an account can have). It's the foundation for the larger vision (AI features) described in the original spec — those are not yet built.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Hand-rolled shadcn/ui-style components (the shadcn CLI's registry host is blocked in this environment, so components under `src/components/ui` were written by hand to match shadcn conventions)
- Prisma ORM + SQLite (swap the `DATABASE_URL` and `provider` in `prisma/schema.prisma` for Postgres in production)
- Auth.js (NextAuth v5) with credentials login + JWT sessions, role-based middleware
- TanStack Query for client-side data fetching/polling (used in place of WebSockets for "live" updates — KDS/tables/dashboard poll every few seconds)
- Recharts for the dashboard revenue graph, qrcode.react for table QR codes

## Getting started

```bash
npm install
cp .env.example .env      # already present with local defaults
npx prisma db push        # create the SQLite database
npm run db:seed           # seed a demo restaurant, users, tables and menu
npm run dev
```

Visit `http://localhost:3000/login`. Demo accounts (password `demo1234` for all):

| Role    | Email                     | Lands on   |
|---------|---------------------------|------------|
| Owner   | owner@restaurantos.dev    | /dashboard |
| Manager (Indiranagar branch) | manager@restaurantos.dev  | /dashboard |
| Manager (Whitefield branch) | manager.whitefield@restaurantos.dev | /dashboard |
| Cashier | cashier@restaurantos.dev  | /pos       |
| Waiter  | waiter@restaurantos.dev   | /waiter    |
| Chef    | chef@restaurantos.dev     | /kitchen   |
| Inventory Manager | inventory@restaurantos.dev | /inventory |

The Owner account belongs to both seeded branches — use the branch switcher in the sidebar (or `/dashboard/branches`) to move between them.

To try the customer QR ordering flow, open `/dashboard/tables` as the owner, click the QR icon on any table, and open the printed link (`/order/<table-code>`) — no login required.

## What's implemented

- **Auth & RBAC** — credentials login, JWT sessions, middleware restricting `/dashboard` to Owner/Manager, `/pos` to Cashier, `/waiter` to Waiter, `/kitchen` to Chef (Owner/Manager can reach all operational screens).
- **Dashboard** (`/dashboard`) — today's revenue, orders, table occupancy, kitchen pending/ready/cancelled, online orders, AOV, top-selling items, peak hour, hourly revenue graph.
- **Menu management** (`/dashboard/menu`) — categories and items with price, veg/non-veg, spicy level, prep time, calories, bestseller flag, availability toggle.
- **Table management** (`/dashboard/tables`) — CRUD, status (available/occupied/reserved/cleaning/disabled), per-table QR code linking to the public ordering page.
- **QR ordering** (`/order/[code]`) — no-login digital menu with search, categories, veg/non-veg + spicy + prep-time badges, cart with per-item notes, "pay at counter" checkout, and a live order-status tracking page (`/order/track/[orderId]`).
- **Kitchen Display System** (`/kitchen`) — New / Preparing / Ready / Served / Cancelled columns, per-order timers with color-coded aging, accept/reject/ready actions, optional sound alert for new orders.
- **Waiter panel** (`/waiter`) — table grid, add items to a table's order (creates or appends to the active order), transfer table, mark served, collect payment.
- **POS** (`/pos`) — quick-sale item grid for walk-ins/takeaway plus an "open bills" tab for existing dine-in orders, discount/tax/service-charge calculation, payment method selection, printable receipt.
- **Staff** (`/dashboard/staff`) — add staff accounts per role, activate/deactivate.
- **Orders** (`/dashboard/orders`) — recent order log across dine-in/takeaway/online.
- **Inventory & recipe costing** (`/dashboard/inventory` for Owner/Manager, `/inventory` for the Inventory Manager role) — raw material stock levels, low-stock/out-of-stock/expiring alerts, purchase & waste logging with a full stock-movement ledger per ingredient, and a recipe builder on each menu item (`/dashboard/menu`) that computes food cost and profit margin live. Stock is auto-deducted the moment an order's status moves to **Preparing** — whether that's the kitchen accepting it or a waiter appending items to an order already in progress.
- **Purchase management** (`/dashboard/purchase-orders` + `/dashboard/suppliers` for Owner/Manager, mirrored under `/inventory/purchase-orders` + `/inventory/suppliers` for the Inventory Manager role) — supplier directory, purchase orders against existing ingredients, a "Receive Goods" action that posts entries into the same stock-movement ledger as the rest of Inventory (full or partial receipt, no separate GRN model needed), supplier invoices (auto-populated from what was received, editable), payments against an invoice or on account, and a per-supplier ledger with a running due-amount balance.
- **CRM & loyalty** (`/dashboard/customers`, `/dashboard/coupons`) — customer profiles (visit history, favorite items computed from past orders, birthday/anniversary, points balance, auto-computed membership tier from lifetime points earned), an append-only loyalty ledger, referral codes with an automatic bonus credited to the referrer on the referred customer's first paid order, and coupons (percent/flat, min order, max discount, usage limits, validity window). Phone lookup, coupon codes, and point redemption are wired into checkout in three places: POS, the Waiter payment-collection dialog, and self-service in the QR ordering cart (with its own public, no-login lookup/validate endpoints).
- **Reservation management** (`/dashboard/reservations` for Owner/Manager) — a day-agenda view (date picker, bookings sorted by time, an overdue flag on unconfirmed bookings past their slot) with confirm/seat/cancel/no-show status actions and a table-assignment picker on seating (which flips the assigned table to Occupied). Staff can create a reservation directly (auto-confirmed) or a customer can self-book with no login at `/reserve/[restaurantId]` (lands as Pending, awaiting staff confirmation). Both paths reuse the CRM customer record (phone lookup/creation) so a reservation's history rolls up into the same customer profile as their orders.
- **Multi-branch support** — an `Account` sits above `Restaurant` (now a "branch"): one login can operate several locations. Customers and their loyalty ledger live at the account level, so a phone number is recognized — and points/tier/referral history follow — at any branch; everything else (menu, inventory, staff, suppliers, coupons, reservations, tables) stays independent per branch. Only the Owner role can operate across branches: a switcher in the sidebar (and a full `/dashboard/branches` page to create new branches) changes the Owner's active branch without a full re-login, and the dashboard gains an "All Branches" aggregate view alongside the existing single-branch one. Every other role (Manager, Cashier, Waiter, Chef, Inventory Manager) stays tied to the one branch they were created under, same as before.
- **SaaS billing** (`/dashboard/billing`, Owner only) — three subscription tiers (Starter/Growth/Enterprise) that gate how many branches and staff accounts an `Account` can have, a plan comparison with an instant simulated switch (no real payment processor — an invoice is generated but nothing is actually charged), and an invoice history. Limits are enforced server-side on the two places that grow an account: creating a new branch and adding a new staff member both return a clear 403 once a plan's limit is hit. Downgrading never touches what already exists — only new creation going forward is blocked.

## Notable simplifications (documented, not hidden)

- Kitchen tickets move through status as a whole order rather than per line item.
- No payment gateway integration — "Pay at Counter" only; the POS/waiter "collect payment" flow marks an order paid and generates an invoice record.
- "Real-time" updates are short-interval polling (TanStack Query `refetchInterval`), not WebSockets.
- Purchase order line items must reference an existing `Ingredient` — no untracked/free-text line items, so every receipt stays wired into the stock ledger. The old "Record Purchase" quick action in Inventory still exists as an informal, no-PO restock path.
- Expiry tracking is a single date per ingredient, not batch/lot-level FIFO.
- Points/coupon discounts are applied and locked in at checkout time (order creation for QR orders, payment confirmation for POS/Waiter) — there's no separate "preview" step showing the discount before that, and cancelling an order afterward doesn't reverse redeemed points or the referral bonus.
- Membership tier thresholds and the points-earn-rate/redemption-value/referral-bonus amounts are configurable per restaurant in the schema, but there's no settings UI to edit them yet — same gap as the existing tax/service-charge rates.
- A reservation only softly holds a table: assigning/seating sets the table to Occupied, but nothing prevents double-booking the same table/slot or blocks a walk-in from being seated at a table that has a pending reservation.
- Creating a new branch starts it completely empty (no menu/tables/inventory copied over) — there's no "clone from an existing branch" tooling yet, so a new branch needs to be built out by hand the same way the first one was.
- Only the Owner role can belong to more than one branch at a time (via the active-branch switcher); every other role is created under a single branch and stays there — there's no "transfer a staff member to a different branch" UI, though an Owner can still see and act on a branch's data by switching into it.
- Billing is entirely simulated — there's no real payment processor, no card capture, no dunning/retry logic, and no automatic monthly renewal (each "invoice" is generated the moment a plan is switched, not on a recurring schedule). It exists to demonstrate plan-based limits, not to actually collect money.
- Plan limits gate branches and staff seats only — there's no per-feature gating (e.g. reservations or CRM available only on higher tiers) and no proration when switching plans mid-cycle.
- AI features are not implemented yet.

## Useful scripts

```bash
npm run dev        # start dev server
npm run build       # production build
npm run lint         # eslint
npm run db:seed     # re-run the demo seed (safe to re-run, upserts)
npm run db:studio   # Prisma Studio to browse the local database
```
