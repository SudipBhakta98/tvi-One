import * as XLSX from "xlsx";

// Reads an Excel / CSV file in the browser and returns its rows keyed by our column names.
// Shared by bulkPayableParser.js and bulkReceivableParser.js, which only add their own column list and value cleanup.

const SUPPORTED_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const HEADER_ROW_NUMBER = 1; // data starts on the next sheet row

const cleanHeader = (value) =>
  String(value ?? "").trim().toLowerCase().replace(/[\r\n]+/g, " ").replace(/\s+/g, " ");

const pad = (value) => String(value).padStart(2, "0");
const isoOf = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

/** Turns Excel date cells, Date objects and common text formats (31/08/2026, 2026-08-31, 31 Aug 2026) into YYYY-MM-DD. */
export const toIsoDate = (value) => {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isoOf(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) return isoOf(parsed.y, parsed.m, parsed.d);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // yyyy-mm-dd / yyyy/mm/dd / yyyy.mm.dd
  let match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) return isoOf(match[1], match[2], match[3]);

  // dd-mm-yyyy / dd/mm/yyyy / dd.mm.yyyy
  match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) return isoOf(match[3], match[2], match[1]);

  // 31 Aug 2026 / Aug 31 2026
  const native = new Date(raw);
  return Number.isNaN(native.getTime()) ? null : isoOf(native.getFullYear(), native.getMonth() + 1, native.getDate());
};

/** "" stays "" (so the server reports it as missing); anything else becomes a number. */
export const toAmount = (value, emptyValue) => (value === "" || value === undefined ? emptyValue : Number(value));

/**
 * @param file            the chosen File
 * @param requiredColumns our column keys that must exist, e.g. ["invoiceNumber", ...]
 * @param columnAliases   { ourKey: ["accepted header 1", "accepted header 2"] } (lower case)
 * @returns rows like { invoiceNumber: "...", grnNumber: "...", __sourceRow: 2 } holding the raw cell values
 */
export const readBulkSheet = async (file, requiredColumns, columnAliases) => {
  if (!file) throw new Error("Please select an Excel or CSV file.");

  const lowerName = file.name.toLowerCase();
  if (!SUPPORTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    throw new Error("Only .xlsx, .xls and .csv files are supported.");
  }

  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, raw: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error("The uploaded file does not contain a worksheet.");

  const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "", raw: true, blankrows: false });
  if (!matrix.length) throw new Error("The uploaded file is empty.");

  // Match each header cell to one of our column keys
  const columnKeys = matrix[0].map((header) => {
    const normalized = cleanHeader(header);
    return Object.keys(columnAliases).find((key) => columnAliases[key].includes(normalized));
  });

  const missing = requiredColumns.filter((key) => !columnKeys.includes(key));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}`);

  const rows = matrix
    .slice(1)
    .map((cells, index) => {
      const row = { __sourceRow: index + HEADER_ROW_NUMBER + 1 };
      columnKeys.forEach((key, column) => {
        if (key) row[key] = cells[column];
      });
      return row;
    })
    .filter((row) => requiredColumns.some((key) => row[key] !== "" && row[key] !== undefined && row[key] !== null));

  if (!rows.length) throw new Error("The uploaded file has no data rows.");
  return rows;
};
