/** Format extraItems for History / Invoice tables. */
export function formatOrderExtras(e) {
  if (!e) return "—";
  const parts = [];
  if (e.roti) parts.push(`Roti ${e.roti}`);

  const sabji1 = typeof e.sabji1 === "string" ? e.sabji1.trim() : "";
  const sabji2 = typeof e.sabji2 === "string" ? e.sabji2.trim() : "";
  const hasNewSabji = sabji1 || sabji2;
  if (hasNewSabji) {
    const names = [sabji1, sabji2].filter(Boolean).join("; ");
    if (names) parts.push(`Sabji: ${names}`);
  } else if (e.sabji) {
    parts.push(`Sabji ${e.sabji}`);
  }

  if (e.dalRiceType) {
    parts.push(`Dal rice: ${e.dalRiceType}`);
  } else if (e.dalRice) {
    parts.push(`Dal ${e.dalRice}`);
  }

  if (e.rice) parts.push(`Rice ${e.rice}`);
  return parts.length ? parts.join(", ") : "—";
}
