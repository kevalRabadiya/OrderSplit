# Client App (React + Vite)

Frontend for Flat Expense Management.

## Features in client

- Public auth routes: `/login`, `/register`.
- Protected app routes for home, order, history, invoice, utilities.
- Auth token + user persistence in `localStorage`.
- Auth-aware navbar behavior.
- Theme toggle (light/dark).

## Environment

Create `client/.env` if needed:

```bash
VITE_API_URL=http://localhost:5000
```

If not set, code defaults to localhost API.

## Run locally

```bash
cd client
npm install
npm run dev
```

## Quality checks

```bash
npm run lint
npm run build
```

## Auth integration notes

- API calls automatically include `Authorization: Bearer <token>` when token is stored.
- On login/register success, token and user are saved, and app redirects to protected routes.
- On logout, token/user are cleared and session is revoked server-side.
