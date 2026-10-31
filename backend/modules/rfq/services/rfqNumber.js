import { incrementCounter } from "./counter.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Keep the project identifier exactly as entered, changing only its case.
// Do not reject or strip punctuation/spacing: the RFQ number should reflect
// the user's project name rather than imposing an undocumented format.
const projectCode = (value) => String(value ?? "PROJECT").toUpperCase();

/**
 * Atomic monthly sequence allocation. MongoDB's findOneAndUpdate with $inc
 * serializes concurrent allocations for the same YYYY-MM key. The unique RFQ
 * number index is the final duplicate guard; a failed create may leave a gap,
 * but can never issue the same number twice.
 */
export async function generateRfqNumber(rfqDate, projectName) {
  const date = new Date(rfqDate);
  if (!rfqDate || Number.isNaN(date.getTime())) throw new Error("A valid RFQ date is required");
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  const counter = await incrementCounter(key);
  return `T-${MONTHS[month]}-${String(counter.sequence).padStart(3, "0")}-${projectCode(projectName)}`;
}
