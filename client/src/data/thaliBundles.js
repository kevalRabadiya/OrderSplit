/**
 * Menu thali bundles: included extras per plate (must match Order page labels).
 * Prices must match server `THALI_PRICES`.
 */
function readVitePrice(key, fallback) {
  const raw = import.meta.env[key];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export const THALI_BUNDLES = [
  { id: 1, price: readVitePrice("VITE_THALI_1_PRICE", 110), roti: 5, sabji: 2, dalRice: 1 },
  { id: 2, price: readVitePrice("VITE_THALI_2_PRICE", 110), roti: 8, sabji: 2, dalRice: 0 },
  { id: 3, price: readVitePrice("VITE_THALI_3_PRICE", 90), roti: 5, sabji: 1, dalRice: 1 },
  { id: 4, price: readVitePrice("VITE_THALI_4_PRICE", 90), roti: 5, sabji: 2, dalRice: 0 },
  { id: 5, price: readVitePrice("VITE_THALI_5_PRICE", 75), roti: 5, sabji: 1, dalRice: 0 },
];

const THALI_BY_ID = new Map(THALI_BUNDLES.map((b) => [b.id, b]));

/**
 * What one plate of this thali type includes for the bundle optimizer (roti/sabji/dal-rice slots).
 * @param {number} thaliId
 */
export function describeThaliBundleCoverage(thaliId) {
  const b = THALI_BY_ID.get(Number(thaliId));
  if (!b) return "";
  const roti = `${b.roti} roti`;
  const sabji = `${b.sabji} sabji portion${b.sabji === 1 ? "" : "s"}`;
  if (b.dalRice > 0) {
    return `${roti}, ${sabji}, ${b.dalRice} dal-rice slot per plate (each Pulav, Khichdi, or Dalrice line counts as one slot).`;
  }
  return `${roti}, ${sabji} per plate; no dal-rice in this bundle — Pulav/Khichdi/Dalrice stay as separate dal-rice units in the optimizer.`;
}

/**
 * @param {Map<number, number>|undefined|null} thaliCounts
 * @returns {{ id: number; count: number; coverage: string }[]}
 */
export function listOptimizedThaliCoverage(thaliCounts) {
  if (!thaliCounts || thaliCounts.size === 0) return [];
  return [...thaliCounts.entries()]
    .map(([id, n]) => ({ id: Number(id), count: Number(n) }))
    .filter((row) => row.count > 0 && Number.isInteger(row.id))
    .sort((a, b) => a.id - b.id)
    .map((row) => ({
      ...row,
      coverage: describeThaliBundleCoverage(row.id),
    }));
}
