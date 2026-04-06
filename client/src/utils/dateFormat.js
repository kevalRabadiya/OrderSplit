/**
 * Display a calendar date as dd-mm-yyyy (input is API/storage form yyyy-mm-dd).
 * @param {string|undefined|null} dateKey
 */
export function formatDateDDMMYYYY(dateKey) {
  if (dateKey == null || typeof dateKey !== "string") return "—";
  const m = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateKey;
  const [, y, mo, d] = m;
  return `${d}-${mo}-${y}`;
}
