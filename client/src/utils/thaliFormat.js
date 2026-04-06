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
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, n]) => `Thali ${id} × ${n}`)
    .join(", ");
}
