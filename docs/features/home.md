# Home Feature

## Purpose
- Monthly dashboard for optimized expense tracking, top users, thali-vs-optimized chart, HouseKeeper stats, and recent orders.

## Source files
- `client/src/pages/HomePage.jsx`
- `client/src/utils/dailyOptimization.js`
- `client/src/api.js`

## Last updated
- 2026-04-23

## Inputs
- Orders history for selected month.
- Orders history for recent list (last ~120 days).
- HouseKeeper attendance for selected month and selected month's year range.
- User list.
- `VITE_HOUSEKEEPER_RATE_PER_DAY`.

## Outputs
- Stat cards (orders count, optimized expense, users count, housekeeper amount).
- Charts:
  - Daily optimized expense.
  - Top users by optimized subtotal.
  - Thali subtotal vs optimized total.
  - HouseKeeper month-wise total amount (selected year derived from month picker).
  - Light bill period chart (selected year derived from month picker).

## Flow
- Fetch in parallel.
- Compute optimized day map + splits via `computeDailyOptimization` and `computeEqualSplitByDay`.
- Build chart-specific datasets.
- Single month selector controls both month-range charts and yearly chart year.

## Edge cases
- Empty month: cards/charts show zero or empty-state message.
- Missing user names: fallback label `User`.
