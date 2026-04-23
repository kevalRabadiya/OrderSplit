# Invoice Feature

## Purpose
- Monthly, user-wise invoice showing original totals and optimized split totals by day.

## Source files
- `client/src/pages/InvoicePage.jsx`
- `client/src/utils/dailyOptimization.js`
- `client/src/utils/aggregateHistorySummary.js`

## Last updated
- 2026-04-23

## Inputs
- Month selector.
- Optional user filter.
- Month order rows from `/api/orders` (always fetched unfiltered for split correctness).

## Outputs
- Per-user sections:
  - Original subtotal.
  - Optimized subtotal (sum of day shares).
  - Date-wise lines with IST date-time, original total, optimized share, and description modal.
- Grand totals (original + optimized).

## Split behavior
- Daily split only among users with orders on that day.
- Share formula: `Math.round(optimizedTotal / userCount)`.
- Per-day rounding delta shown for auditability.
- Even when filtering to one user, split is still calculated from all users who ordered that day; filter only affects displayed rows.
