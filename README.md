# Flat Expense Management

Internal tool for daily tiffin order entry, tracking, and reporting. Stack is **React (Vite)** frontend, **Express + TypeScript** backend, and **MongoDB**.

## Current capabilities

- Username/password authentication with JWT tokens.
- Protected API routes with authorization middleware.
- Daily order create/update/delete (soft delete), preview pricing, and history/invoice reporting.
- Housekeeper and light-bill utility modules.
- Theme toggle and auth-aware navigation.

## Auth model

- Login uses `username` + `password`.
- Password minimum is 4 characters.
- JWT is signed without expiry, and `tokenVersion` is used for revocation on logout.
- Protected routes require `Authorization: Bearer <token>`.

## API summary

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Register user with `{ name, phone, email, address?, username, password }`. |
| `POST` | `/api/auth/login` | Login with `{ username, password }`; returns `{ token, user }`. |
| `POST` | `/api/auth/logout` | Revokes current session by incrementing `tokenVersion`; requires auth token. |

### Users

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/users` | Create user (protected). |
| `GET` | `/api/users` | List users (protected). |
| `GET` | `/api/users/:id` | Get user by id (protected). |

### Orders

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/orders/preview` | Calculate total only (protected). |
| `POST` | `/api/orders` | Save/replace order for authenticated user and date (protected). |
| `PUT` | `/api/orders/:userId` | Update existing order; only same authenticated user allowed. |
| `GET` | `/api/orders/:userId?date=YYYY-MM-DD` | Fetch single order; only same authenticated user allowed. |
| `DELETE` | `/api/orders/:userId?date=YYYY-MM-DD` | Soft-delete order; only same authenticated user allowed. |
| `GET` | `/api/orders?from=&to=&userId=` | History/invoice query endpoint (protected). |

### Utilities

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/housekeeper` | Housekeeper records (protected). |
| `PUT` | `/api/housekeeper` | Upsert housekeeper records (protected). |
| `GET` | `/api/light-bill?year=YYYY` | Get light-bill periods (protected). |
| `PUT` | `/api/light-bill` | Upsert light-bill period (protected). |
| `GET` | `/health` | Health check. |

## Data compatibility and migration (no data loss)

When auth is added to an existing production DB, existing business data (`orders`, invoice-derived history, utility data) is preserved. Migration only backfills auth fields on `users`.

### Migration runbook

1. **Take full DB backup** (required).
2. **Restore backup to staging clone** and dry-run full migration there.
3. **Deploy code with auth fields/routes** to staging.
4. **Run user bootstrap script** in staging:
   ```bash
   cd server
   AUTH_TEMP_PASSWORD=1234 npm run auth:bootstrap-users
   ```
5. Validate in staging:
   - users now have `username`, `passwordHash`, and `tokenVersion`.
   - no data loss in `orders` and reporting pages.
   - register/login/logout flow works.
6. **Repeat in production** during maintenance window.
7. Securely distribute temporary credentials from generated CSV and require password change policy.

### What the bootstrap script does

- Finds users missing `username` or `passwordHash`.
- Generates unique usernames.
- Sets a hashed temporary password.
- Initializes `tokenVersion` when missing.
- Writes CSV report to `server/migration-reports/`.

## Environment configuration

### Server (`server/.env`)

- `MONGODB_URI` (required)
- `JWT_SECRET` (required)
- `PORT` (optional, default `5000`)
- `AUTH_TEMP_PASSWORD` (optional, used by migration script; min 4 chars)

### Client (`client/.env`)

- `VITE_API_URL` (e.g. `http://localhost:5000`)

## Local development

### API

```bash
cd server
npm install
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run dev
```

## Production build commands

```bash
cd server && npm run build && npm start
cd client && npm run build
```
