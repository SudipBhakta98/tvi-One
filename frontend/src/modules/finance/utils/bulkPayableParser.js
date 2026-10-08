import { readBulkSheet, toAmount, toIsoDate } from "./bulkSheetReader.js";

// Columns of the Payable upload. `key` is what the backend expects.
// `hint` is a short note shown next to the column in the "File format requirements" section.
export const BULK_PAYABLE_COLUMN_GUIDE = [
  { key: "invoiceNumber", label: "Invoice Number", required: true, example: "INV-2026-001", hint: "Unique together with GRN Number." },
  { key: "grnNumber", label: "GRN Number", required: true, example: "GRN-1001", hint: "Unique together with Invoice Number." },
  { key: "supplierName", label: "Supplier Name", required: true, example: "ABC Industries", hint: "Text." },
  { key: "invoiceDate", label: "Invoice Date", required: true, example: "31/08/2026", hint: "DD/MM/YYYY or YYYY-MM-DD." },
  { key: "subTotal", label: "Sub Total", required: true, example: "100000", hint: "Amount in ₹ before GST. Plain number, no commas." },
  { key: "gstRate", label: "GST Rate", required: true, percent: true, example: "18", hint: "Percent as a plain number: 18 means 18%. Do not use Excel % formatting." },
  { key: "totalAmount", label: "Total Amount", required: true, example: "118000", hint: "Must equal Sub Total + GST (±₹1)." },
  { key: "tdsRate", label: "TDS Rate", required: true, percent: true, example: "1", hint: "Percent as a plain number: 1 means 1%, 0.1 means 0.1%. Use 0 if none." },
];

// Rules listed under "File format requirements".
export const BULK_PAYABLE_FORMAT_NOTES = [
  "Upload a .xlsx, .xls or .csv file. Only the first sheet is read.",
  "Row 1 must be the header row. Use the column names from the template.",
  "GST Rate and TDS Rate are percent numbers (18 = 18%). Do not format those cells as Excel percentages.",
  "Total Amount = Sub Total + (Sub Total × GST Rate ÷ 100). Rows that do not match are rejected.",
  "Invoice Number + GRN Number must be unique, including inside the same file.",
];

// Header spellings accepted for each column (lower case).
const COLUMN_ALIASES = {
  invoiceNumber: ["invoicenumber", "invoice_number", "invoice no", "invoice number"],
  grnNumber: ["grnnumber", "grn_number", "grn no", "grn number"],
  supplierName: ["suppliername", "supplier_name", "supplier", "supplier name"],
  invoiceDate: ["invoicedate", "invoice_date", "invoice date", "date"],
  subTotal: ["subtotal", "sub_total", "sub total", "sub-total"],
  gstRate: ["gstrate", "gst_rate", "gst rate", "gst rate (%)", "gst %", "gst"],
  totalAmount: ["totalamount", "total_amount", "total amount", "invoice total"],
  tdsRate: ["tdsrate", "tds_rate", "tds rate", "tds rate (%)", "tds %", "tds"],
};

const REQUIRED_COLUMNS = BULK_PAYABLE_COLUMN_GUIDE.map((column) => column.key);

// Percent cell (18, "18", "18%") -> fraction (0.18), same as what the single form sends.
// Empty -> emptyValue. Non-numeric stays NaN so the server reports it.
const toRateFraction = (value, emptyValue) => {
  if (value === "" || value === undefined || value === null) return emptyValue;
  const text = String(value).trim().replace(/%$/, "").trim();
  if (text === "") return emptyValue;
  return Number((Number(text) / 100).toFixed(6));
};

/** Reads the chosen file and returns { rows } ready for payablesApi.create({ invoices: rows }). */
export const parseBulkPayableFile = async (file) => {
  const sheetRows = await readBulkSheet(file, REQUIRED_COLUMNS, COLUMN_ALIASES);

  const rows = sheetRows.map((row) => ({
    invoiceNumber: String(row.invoiceNumber ?? "").trim(),
    grnNumber: String(row.grnNumber ?? "").trim(),
    supplierName: String(row.supplierName ?? "").trim(),
    invoiceDate: toIsoDate(row.invoiceDate),
    subTotal: toAmount(row.subTotal, ""),
    gstRate: toRateFraction(row.gstRate, 0),
    totalAmount: toAmount(row.totalAmount, ""),
    tdsRate: toRateFraction(row.tdsRate, 0),
    __sourceRow: row.__sourceRow,
  }));

  return { rows, rowCount: rows.length };
};