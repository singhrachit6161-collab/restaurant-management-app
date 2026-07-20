# RestaurantOS

An all-in-one restaurant business management system — QR ordering, table management, a kitchen display system, POS billing, and an owner/manager dashboard, built as a single Next.js app.

This is a **Phase 1 MVP** (auth & roles, menu management, QR ordering, kitchen display, POS, billing, table management, live dashboard analytics) plus **inventory & recipe costing** and **purchase management** (suppliers, purchase orders, invoices, payments/dues). It's the foundation for the larger vision (CRM, reservations, multi-branch, SaaS billing, AI features) described in the original spec — those are not yet built.

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
| Manager | manager@restaurantos.dev  | /dashboard |
| Cashier | cashier@restaurantos.dev  | /pos       |
| Waiter  | waiter@restaurantos.dev   | /waiter    |
| Chef    | chef@restaurantos.dev     | /kitchen   |
| Inventory Manager | inventory@restaurantos.dev | /inventory |

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

## Notable simplifications (documented, not hidden)

- Kitchen tickets move through status as a whole order rather than per line item.
- No payment gateway integration — "Pay at Counter" only; the POS/waiter "collect payment" flow marks an order paid and generates an invoice record.
- "Real-time" updates are short-interval polling (TanStack Query `refetchInterval`), not WebSockets.
- Single restaurant/tenant — multi-branch and the SaaS super-admin layer from the full spec are out of scope for this pass.
- Purchase order line items must reference an existing `Ingredient` — no untracked/free-text line items, so every receipt stays wired into the stock ledger. The old "Record Purchase" quick action in Inventory still exists as an informal, no-PO restock path.
- Expiry tracking is a single date per ingredient, not batch/lot-level FIFO.
- CRM/loyalty, reservations, multi-branch, and AI features are not implemented yet.

## Useful scripts

```bash
npm run dev        # start dev server
npm run build       # production build
npm run lint         # eslint
npm run db:seed     # re-run the demo seed (safe to re-run, upserts)
npm run db:studio   # Prisma Studio to browse the local database
```
