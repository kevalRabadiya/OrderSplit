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

const IST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

/**
 * Display a date-time in IST as dd/mm/yyyy, hh:mm AM/PM.
 * @param {string|Date|undefined|null} value
 */
export function formatDateTimeIST(value) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return IST_DATE_TIME_FORMATTER.format(date);
}
