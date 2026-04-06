# Money split for Tifin/Thali ordering

Internal tool for entering daily thali orders: **React** (Vite) frontend, **Express** API (**TypeScript**, compiled to `server/dist/`), **MongoDB** database. Menu prices are fixed and calculated on the server.

## Prerequisites

- Node.js 18+
- MongoDB reachable at `MONGODB_URI` (local install, Docker, or MongoDB Atlas)

## Configuration

**Server** — copy [`server/.env.example`](server/.env.example) to `server/.env` (ignored by git via [`server/.gitignore`](server/.gitignore)).

- `MONGODB_URI` — **required**. Use e.g. `mongodb://127.0.0.1:27017/tiffin` locally. For **Atlas**, use a URI that ends with `/tiffin` so the app uses the `tiffin` database (for example `mongodb+srv://USER:PASSWORD@cluster...mongodb.net/tiffin`).
- `PORT` — optional; defaults to **5000** if unset (the process exits if `MONGODB_URI` is missing).
- **CORS** — by default: **`localhost` / `127.0.0.1`** (any port), **`https://*.onrender.com`**, and **`https://*.vercel.app`**. For any other origin (custom domain, etc.), set **`CORS_ORIGINS`** to comma-separated full origins (no trailing slash), e.g. `https://app.example.com`.

**Atlas:** Allow your client IP (or `0.0.0.0/0` for quick tests) under **Network Access**, and give the database user read/write access.

**Client** ([`client/.env.example`](client/.env.example)):

- `VITE_API_URL` — API origin; default in code `http://localhost:5000`. For a deployed API (e.g. `https://ordersplit.onrender.com`), set this **before** `npm run build` so the SPA calls the correct host.

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

(`npm run dev` runs **TypeScript** via `tsx watch`. For production, run **`npm run build`** then **`npm start`** — `start` runs **`node dist/index.js`**.)

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
