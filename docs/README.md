# Flat Expense Docs

## Purpose
- Central, LLM-friendly documentation for all product features, APIs, algorithms, and config.
- Mirrors current behavior in code (client + server).

## Source files
- `client/src/pages/*`
- `client/src/utils/*`
- `client/src/api.js`
- `server/src/index.ts`
- `server/src/routes/*`
- `server/src/models/*`
- `server/src/pricing.ts`

## Last updated
- 2026-04-23

## Copy-paste summary
```text
This app manages daily tiffin orders, computes optimized bundle costs using thali bundles, splits optimized totals user-wise per day, supports monthly invoice and home charts, tracks HouseKeeper attendance/cost, provides global action toasts, uses username/password auth with protected API routes, and can send a daily Handlebars-based summary email via cron. Use docs/features for UI behavior, docs/algorithms for optimization/split logic, docs/api for endpoints, and docs/config for env setup.
```

## Production migration notes (auth rollout)

- Existing production data can be migrated without deleting orders/invoices/history.
- Auth rollout is done by backfilling `users` with `username`, `passwordHash`, and `tokenVersion`.
- Use `server/src/scripts/bootstrapAuthUsers.ts` via:
  - `cd server && AUTH_TEMP_PASSWORD=1234 npm run auth:bootstrap-users`
- Script outputs credential CSV in `server/migration-reports/`.
- Always do:
  1. full DB backup,
  2. staging dry-run on DB clone,
  3. production run during maintenance window,
  4. post-migration smoke checks for register/login/history/invoice/order flows.

## Navigation
- Architecture
  - [`docs/architecture/system-overview.md`](architecture/system-overview.md)
- Features
  - [`docs/features/home.md`](features/home.md)
  - [`docs/features/order.md`](features/order.md)
  - [`docs/features/history.md`](features/history.md)
  - [`docs/features/invoice.md`](features/invoice.md)
  - [`docs/features/housekeeper.md`](features/housekeeper.md)
  - [`docs/features/users.md`](features/users.md)
- Algorithms
  - [`docs/algorithms/order-optimized-amount.md`](algorithms/order-optimized-amount.md)
  - [`docs/algorithms/daily-split-and-rounding.md`](algorithms/daily-split-and-rounding.md)
- API + Config
  - [`docs/api/endpoints.md`](api/endpoints.md)
  - [`docs/config/env.md`](config/env.md)
- Troubleshooting
  - [`docs/troubleshooting/common-issues.md`](troubleshooting/common-issues.md)

## Glossary
- `dateKey`: `YYYY-MM-DD` normalized date identifier.
- `optimizedTotal`: minimum computed total using thali bundles + leftovers.
- `thaliOnlyCost`: cost of selected bundles only (without leftover extras/rice).
- `includeOrderedThalis`: optimizer mode that includes ordered thali-implied demand.
- `share`: per-day rounded equal split (`Math.round(optimizedTotal / userCount)`).
- `roundingDelta`: `share*userCount - optimizedTotal`.
