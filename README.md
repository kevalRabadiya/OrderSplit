# Tiffin / Thali ordering app

Internal tool for entering daily thali orders: **React** (Vite) frontend, **Express** API, **MongoDB** database. Menu prices are fixed and calculated on the server.

## Prerequisites

- Node.js 18+
- MongoDB reachable at `MONGODB_URI` (local install, Docker, or MongoDB Atlas)

## Configuration

**Server** — copy [`server/.env.example`](server/.env.example) to `server/.env` (ignored by git via [`server/.gitignore`](server/.gitignore)).

- `MONGODB_URI` — local default in code is `mongodb://127.0.0.1:27017/tiffin`. For **Atlas**, use a URI that ends with `/tiffin` so the app uses the `tiffin` database (for example `mongodb+srv://USER:PASSWORD@cluster...mongodb.net/tiffin`).
- `PORT` — default `5000`

**Atlas:** Allow your client IP (or `0.0.0.0/0` for quick tests) under **Network Access**, and give the database user read/write access.

**Client** ([`client/.env.example`](client/.env.example)):

- `VITE_API_URL` — API origin, default in code `http://localhost:5000`

Copy to `client/.env` if you need overrides.

## Data model notes

- **Users** live in the `users` collection (`name`, `phone`, `address`, `createdAt`).
- **Orders** use a string field **`dateKey`** in `YYYY-MM-DD` (calendar date for the order). One order per user per day: saving again **replaces** that day’s order (upsert on `userId` + `dateKey`). **`DELETE`** sets **`deletedAt`** (soft delete); the row stays in the DB but is hidden from lists and GET until a new save clears it.
- **`thaliIds`** is an array of integers `1`–`5` (unbounded length); total thali cost is the **sum** of each item’s menu price (duplicates allowed). Legacy documents may only have **`thaliId`** (single number); the API merges that into `thaliIds` when reading.

## Run locally

Terminal 1 — API:

```bash
cd server
npm install
npm run dev
```

Terminal 2 — frontend:

```bash
cd client
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). The API allows CORS from that origin.

## API summary

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/users` | Create user `{ name, phone, address? }` |
| `GET` | `/api/users` | List users |
| `GET` | `/api/users/:id` | Get one user |
| `POST` | `/api/orders/preview` | `{ thaliIds: number[], extraItems }` → `{ totalAmount }` (no DB write). Legacy: `thaliId` only is accepted as a single selection. |
| `GET` | `/api/orders?from=&to=&userId=` | List orders: `from` / `to` are `YYYY-MM-DD` (default **today**; `to` defaults to `from`); optional `userId` filters one user; **`from` ≤ `to`** required. Each row includes **`user`** `{ name, phone }` and merged **`thaliIds`**. |
| `POST` | `/api/orders` | `{ userId, thaliIds, extraItems, date? }` → save/replace order for that date |
| `PUT` | `/api/orders/:userId` | `{ thaliIds, extraItems, date? }` → update existing order for that date (**404** if none) |
| `DELETE` | `/api/orders/:userId?date=YYYY-MM-DD` | **Soft-delete** order for that user/date (`deletedAt` set; **404** if none or already deleted; **204** on success) |
| `GET` | `/api/orders/:userId?date=YYYY-MM-DD` | Get order (defaults to today’s date if `date` omitted); response always includes merged **`thaliIds`**. |

## UI

- **Home** — `/` dashboard: previous calendar month **order count** and **expence**, **daily expence** and **top users** charts (Recharts), **four most recent orders** (all users, from the last 120 days), and a **user** list with last-month badges; quick links to users, new order, and history.
- **Users** — `/users`; list, **Add user**, **New order** per user.
- **Add user** — `/users/new` (from Users); name, phone, optional address.
- **History** — navbar; default **today** for all users; **from/to** date range and optional **user** filter; table of orders.
- **Invoice** — navbar; pick a **month** and optional **user** (same `userId` filter as History); orders grouped **by user** with per-user **subtotals** and a **grand total** for the month (or **Total (filtered)** when one user is selected).
- **Order** — pick user (URL `?userId=` or last selection in `localStorage`), date (optional URL `?date=YYYY-MM-DD`), **unlimited thali lines** (add/remove), extras, **Calculate** (preview), **Save order** (upsert), **Update order** (PUT, only when an order exists), **Delete order** (soft-delete). **Dates in the UI** are shown as **dd-mm-yyyy**; API and `<input type="date">` still use **yyyy-mm-dd**.
- **Theme** — header control: System / Light / Dark (stored in `localStorage` as `tiffin_theme`).

No authentication in this version.
