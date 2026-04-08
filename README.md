# Flat-PG-Expense-Management

Internal tool for entering daily thali orders, built with a **React (Vite)** frontend, **Express + TypeScript** API, and **MongoDB**. Menu pricing is fixed and calculated on the server.

## Project overview

- Primary workflow: create users, place/update daily orders, and review totals through dashboard/history/invoice views.
- Frontend: `client/` (Vite SPA).
- Backend: `server/` (TypeScript source, compiled to `server/dist/` for production).

## Feature highlights

### 1) User management

- Add and maintain user records (`name`, `phone`, optional `address`).
- Start a new order directly from user context.
- View user-specific history and invoice totals through shared filtering.

### 2) Order lifecycle

- Create orders per user and date using multiple thali selections plus optional extras.
- Preview total before saving (`Calculate` uses pricing logic without DB write).
- Save as upsert for that user/date, update existing orders, or soft-delete.

### 3) Reporting and analytics

- Home dashboard shows previous month totals and visual breakdowns.
- History supports date-range and user filtering for tabular review.
- Invoice groups monthly totals by user with subtotal and grand total views.

### 4) Theme and preferences

- System/Light/Dark theme toggle in header.
- Last selected user is remembered for faster order entry.

## Feature-wise behavior (UI to API mapping)

### User management

- **UI routes:** `/users`, `/users/new`.
- **Actions:** create user, list users, open order flow per user.
- **API support:** `POST /api/users`, `GET /api/users`, `GET /api/users/:id`.

### Order lifecycle

- **UI route:** Order page (supports `?userId=` and optional `?date=YYYY-MM-DD`).
- **Actions:** choose user/date, add/remove unlimited thali lines, add extras, calculate, save, update, delete.
- **API support:**
  - `POST /api/orders/preview` for calculation only.
  - `POST /api/orders` to save/replace order for the day (upsert behavior).
  - `PUT /api/orders/:userId` to update only when an order already exists.
  - `GET /api/orders/:userId?date=YYYY-MM-DD` to load a single order.
  - `DELETE /api/orders/:userId?date=YYYY-MM-DD` for soft delete (`deletedAt`).

### Reporting and analytics

- **UI routes:** `/` (home), history page (navbar), invoice page (navbar).
- **Actions:**
  - Home: previous month order count and expense, daily expense chart, top users chart, recent orders, and quick links.
  - History: `from/to` range with optional user filter.
  - Invoice: month + optional user filter; per-user subtotals plus grand total.
- **API support:** `GET /api/orders?from=&to=&userId=` for list/filter data powering history and invoice.

### Theme and preferences

- **UI behavior:** theme stored in `localStorage` under `tiffin_theme`.
- **User convenience:** last selected order user can be reused from `localStorage`.

## API summary

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/users` | Create user `{ name, phone, address? }`. |
| `GET` | `/api/users` | List users. |
| `GET` | `/api/users/:id` | Get one user. |
| `POST` | `/api/orders/preview` | Calculate `{ totalAmount }` from `{ thaliIds, extraItems }` without DB write. Legacy `thaliId` is accepted as a single selection. |
| `GET` | `/api/orders?from=&to=&userId=` | List orders by date range (`YYYY-MM-DD`) with optional `userId`. Defaults: `from=today`, `to=from`. Requires `from <= to`. Rows include merged `thaliIds` and user snapshot (`name`, `phone`). |
| `POST` | `/api/orders` | Save/replace order for date using `{ userId, thaliIds, extraItems, date? }`. |
| `PUT` | `/api/orders/:userId` | Update existing order for date using `{ thaliIds, extraItems, date? }`; returns `404` if none exists. |
| `DELETE` | `/api/orders/:userId?date=YYYY-MM-DD` | Soft-delete order (`deletedAt` set); returns `404` if missing/already deleted and `204` on success. |
| `GET` | `/api/orders/:userId?date=YYYY-MM-DD` | Get order for user/date (defaults to today if omitted), always returning merged `thaliIds`. |
| `GET` | `/api/light-bill?year=YYYY` | List light-bill periods overlapping that calendar year (`fromMonthKey` / `toMonthKey` inclusive, `amount`). |
| `PUT` | `/api/light-bill` | Upsert period `{ fromMonthKey, toMonthKey, amount }` (`YYYY-MM` keys, `from` ≤ `to`). |

## Data model and rules

- **Users collection (`users`):** `name`, `phone`, `address`, `createdAt`.
- **Orders collection (`orders`):**
  - `dateKey` is a `YYYY-MM-DD` string used as calendar-date key.
  - Uniqueness behavior is one order per user per day (`userId + dateKey` upsert semantics).
  - Delete behavior is soft delete (`deletedAt`), hidden from lists/single GET until saved again.
- **Thali selections:**
  - `thaliIds` is an unbounded array of integers `1` to `5`.
  - Total thali amount is the sum of selected menu prices (duplicates allowed).
  - Legacy docs with single `thaliId` are merged into `thaliIds` on read.
- **Date format rule:**
  - API and `<input type="date">` use `YYYY-MM-DD`.
  - UI display uses `DD-MM-YYYY`.

## Prerequisites

- Node.js 18+
- MongoDB reachable through `MONGODB_URI` (local, Docker, or Atlas)

## Configuration

### Server

Copy [`server/.env.example`](server/.env.example) to `server/.env`.

- `MONGODB_URI` (**required**): local example `mongodb://127.0.0.1:27017/tiffin`; for Atlas, use a URI ending with `/tiffin`.
- `PORT` (optional): defaults to `5000`.
- `CORS_ORIGINS` (optional): comma-separated full origins (no trailing slash) for custom domains, for example `https://app.example.com`.

Default allowed origins include:

- `localhost` and `127.0.0.1` (any port)
- `https://*.onrender.com`
- `https://*.vercel.app`

Atlas note: allow your client IP (or `0.0.0.0/0` for quick testing) in Network Access, and ensure DB user has read/write permissions.

### Client

Copy [`client/.env.example`](client/.env.example) to `client/.env` if overrides are needed.

- `VITE_API_URL`: API origin (default in code is `http://localhost:5000`). For deployed API, set this before `npm run build`.

## Run locally

Terminal 1 (API):

```bash
cd server
npm install
npm run dev
```

`npm run dev` runs TypeScript via `tsx watch`. For production:

```bash
cd server
npm run build
npm start
```

Terminal 2 (frontend):

```bash
cd client
npm install
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`).

## Current limitation

- Authentication/authorization is not implemented in this version.
