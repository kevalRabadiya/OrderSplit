/**
 * Aggregate extras and thali counts for History filtered rows.
 * @param {Array<Record<string, unknown>>|null|undefined} rows
 */
export function aggregateHistorySummary(rows) {
  const emptyDal = { Pulav: 0, Khichdi: 0, Dalrice: 0 };
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      rotiTotal: 0,
      riceTotal: 0,
      sabjiLegacyTotal: 0,
      sabjiNamedPortions: 0,
      sabjiNameCounts: [],
      dalRiceTypeCounts: { ...emptyDal },
      dalRiceLegacyTotal: 0,
      thaliCounts: new Map(),
    };
  }

  let rotiTotal = 0;
  let riceTotal = 0;
  let sabjiLegacyTotal = 0;
  let sabjiNamedPortions = 0;
  const sabjiNameMap = new Map();
  const dalRiceTypeCounts = { ...emptyDal };
  let dalRiceLegacyTotal = 0;
  const thaliCounts = new Map();

  for (const row of rows) {
    const e = row?.extraItems;
    if (e && typeof e === "object") {
      rotiTotal += Number(e.roti) || 0;
      riceTotal += Number(e.rice) || 0;

      const s1 = typeof e.sabji1 === "string" ? e.sabji1.trim() : "";
      const s2 = typeof e.sabji2 === "string" ? e.sabji2.trim() : "";
      const hasNewSabji = s1 || s2;
      if (hasNewSabji) {
        if (s1) {
          sabjiNamedPortions += 1;
          sabjiNameMap.set(s1, (sabjiNameMap.get(s1) || 0) + 1);
        }
        if (s2) {
          sabjiNamedPortions += 1;
          sabjiNameMap.set(s2, (sabjiNameMap.get(s2) || 0) + 1);
        }
      } else {
        sabjiLegacyTotal += Number(e.sabji) || 0;
      }

      const drt = e.dalRiceType;
      if (drt === "Pulav" || drt === "Khichdi" || drt === "Dalrice") {
        dalRiceTypeCounts[drt] += 1;
      } else {
        dalRiceLegacyTotal += Number(e.dalRice) || 0;
      }
    }

    const ids = row?.thaliIds;
    if (Array.isArray(ids)) {
      for (const raw of ids) {
        const id = Number(raw);
        if (!Number.isInteger(id) || id < 1 || id > 5) continue;
        thaliCounts.set(id, (thaliCounts.get(id) || 0) + 1);
      }
    }
  }

  const sabjiNameCounts = [...sabjiNameMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort(
      (a, b) =>
        b.count - a.count || a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );

  return {
    rotiTotal,
    riceTotal,
    sabjiLegacyTotal,
    sabjiNamedPortions,
    sabjiNameCounts,
    dalRiceTypeCounts,
    dalRiceLegacyTotal,
    thaliCounts,
  };
}

/** @param {Map<number, number>} thaliCounts */
export function formatThaliSummaryLine(thaliCounts) {
  if (!thaliCounts || thaliCounts.size === 0) return "";
  return [...thaliCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, n]) => `Thali ${id} × ${n}`)
    .join(", ");
}
