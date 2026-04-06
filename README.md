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
- **Orders** use a string field **`dateKey`** in `YYYY-MM-DD` (calendar date for the order). One order per user per day: saving again **replaces** that day’s order (upsert on `userId` + `dateKey`).

## Run locally

Terminal 1 — MongoDB (example with Docker):

```bash
docker run -d --name tiffin-mongo -p 27017:27017 mongo:7
```

Terminal 2 — API:

```bash
cd server
npm install
npm run dev
```

Terminal 3 — frontend:

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
| `POST` | `/api/orders/preview` | `{ thaliId, extraItems }` → `{ totalAmount }` (no DB write) |
| `POST` | `/api/orders` | `{ userId, thaliId, extraItems, date? }` → save/replace order for that date |
| `GET` | `/api/orders/:userId?date=YYYY-MM-DD` | Get order (defaults to today’s date if `date` omitted) |

## UI

- **Users** — list, **Add user**, **Add order** per user.
- **Add user** — name, phone, optional address.
- **Order** — pick user (URL `?userId=` or last selection in `localStorage`), date, thali or none, extras, **Calculate** (preview), **Save order**.

No authentication in this version.
