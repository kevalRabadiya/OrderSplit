import { aggregateHistorySummary } from "./aggregateHistorySummary.js";
import { optimizeExtrasForRange } from "./optimizeExtrasBundles.js";

/**
 * @typedef {Object} DayOptimization
 * @property {number} currentTotal Sum of row.totalAmount for the day
 * @property {number} optimizedTotal Re-optimized total for the day
 * @property {number} thaliSubtotal Optimizer thali-only subtotal for the day
 * @property {Set<string>} userIds Users who have any order that day
 * @property {number} share Rounded equal split share for the day
 * @property {number} roundingDelta share*userCount - optimizedTotal
 */

/**
 * @param {Array<Record<string, any>>|null|undefined} rows getOrdersHistory rows
 * @returns {Map<string, Array<Record<string, any>>>} dateKey -> rows
 */
function groupRowsByDate(rows) {
  const byDay = new Map();
  if (!Array.isArray(rows)) return byDay;
  for (const r of rows) {
    const dk = typeof r?.dateKey === "string" ? r.dateKey : "";
    if (!dk) continue;
    if (!byDay.has(dk)) byDay.set(dk, []);
    byDay.get(dk).push(r);
  }
  return byDay;
}

/**
 * Compute per-day optimization metrics for a set of orders (typically a month range).
 *
 * Optimization scope: full order quantities (ordered thalis + extras), plus rice.
 *
 * @param {Array<Record<string, any>>|null|undefined} rows
 * @returns {Map<string, DayOptimization>} dateKey -> metrics
 */
export function computeDailyOptimization(rows) {
  const byDay = groupRowsByDate(rows);
  /** @type {Map<string, DayOptimization>} */
  const out = new Map();

  for (const [dateKey, dayRows] of byDay.entries()) {
    const userIds = new Set(
      dayRows
        .map((r) => (r?.userId != null ? String(r.userId) : ""))
        .filter(Boolean)
    );

    const currentTotal = dayRows.reduce(
      (s, r) => s + (Number(r?.totalAmount) || 0),
      0
    );

    const summary = aggregateHistorySummary(dayRows);
    const opt = optimizeExtrasForRange(summary, { includeOrderedThalis: true });

    const optimizedTotal = Number(opt?.totalOptimized) || 0;
    const thaliSubtotal = Number(opt?.thaliOnlyCost) || 0;

    const userCount = userIds.size || 1;
    const share = Math.round(optimizedTotal / userCount);
    const roundingDelta = share * userCount - optimizedTotal;

    out.set(dateKey, {
      currentTotal,
      optimizedTotal,
      thaliSubtotal,
      userIds,
      share,
      roundingDelta,
    });
  }

  return out;
}

/**
 * Equal-split the per-day optimized totals across users.
 *
 * @param {Array<Record<string, any>>|null|undefined} rows
 */
export function computeEqualSplitByDay(rows) {
  const dayMap = computeDailyOptimization(rows);

  /** @type {Map<string, Map<string, number>>} */
  const userDayShare = new Map(); // userId -> (dateKey -> share)

  for (const [dateKey, m] of dayMap.entries()) {
    for (const uid of m.userIds) {
      if (!userDayShare.has(uid)) userDayShare.set(uid, new Map());
      userDayShare.get(uid).set(dateKey, m.share);
    }
  }

  return {
    dayMap,
    userDayShare,
  };
}

