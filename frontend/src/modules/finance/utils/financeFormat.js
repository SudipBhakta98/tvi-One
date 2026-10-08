export const formatCurrency = (amount) =>
  "₹" + Math.round(Number(amount) || 0).toLocaleString("en-IN");

/** Dates from the API are already DD-MM-YYYY strings. */
export const formatDateString = (rawDate) => (rawDate ? String(rawDate) : "—");

/** Any date value (ISO / Date) shown as DD-MM-YYYY. */
export const formatDateDMY = (raw) => {
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(raw).slice(0, 10);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
};

/** Any date value (ISO / Date) shown as a local Indian date. */
export const formatDisplayDate = (raw) => {
  if (!raw) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? String(raw).slice(0, 10) : date.toLocaleDateString("en-IN");
};

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const monthEntry = (year, monthNumber) => {
  const month = String(monthNumber).padStart(2, "0");
  return { year: String(year), month, key: `${year}-${month}`, label: `${MONTH_NAMES[monthNumber - 1]} ${year}` };
};

/** Reads DD-MM-YYYY or ISO strings into { year, month, key: "YYYY-MM", label: "Aug 2026" }. */
export const parseDateString = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();

  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    const [, month, year] = str.split("-");
    return monthEntry(year, parseInt(month, 10));
  }

  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : monthEntry(parsed.getFullYear(), parsed.getMonth() + 1);
};

/** Keeps only digits and one dot, with at most two decimals (for amount inputs). */
export const decimalOnly = (value) =>
  value
    .replace(/[^0-9.]/g, "")
    .replace(/(\..*)\./g, "$1")
    .replace(/^(\d+)\.(\d{0,2}).*$/, "$1.$2");
