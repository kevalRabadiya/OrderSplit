import { THALI_BUNDLES } from "../data/thaliBundles.js";

const THALI_PRICE_BY_ID = new Map(THALI_BUNDLES.map((b) => [b.id, b.price]));

/**
 * @param {number} id
 * @returns {number}
 */
function thaliUnitPrice(id) {
  return THALI_PRICE_BY_ID.get(id) ?? 0;
}

/**
 * @param {Map<number, number>} thaliCounts
 * @returns {string}
 */
export function formatThaliCountsLine(thaliCounts) {
  if (!thaliCounts || thaliCounts.size === 0) return "";
  return [...thaliCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, n]) => {
      const unit = thaliUnitPrice(id);
      return `Thali ${id}(rs.${unit}) x ${n}`;
    })
    .join(", ");
}

/**
 * Turn a list of thali type ids (1–5, repeats allowed) into readable quantities.
 * @param {number[]|undefined|null} ids
 * @returns {string}
 */
export function formatThaliQuantities(ids) {
  if (!ids?.length) return "—";
  const counts = new Map();
  for (const raw of ids) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1 || id > 5) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  if (counts.size === 0) return "—";
  return formatThaliCountsLine(counts);
}
