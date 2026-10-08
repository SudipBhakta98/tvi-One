import { readBulkSheet, toAmount, toIsoDate } from "./bulkSheetReader.js";

// Columns of the Receivable upload. `key` is what the backend expects.
// `hint` is a short note shown next to the column in the "File format requirements" section.
export const BULK_RECEIVABLE_COLUMN_GUIDE = [
  { key: "invoiceNumber", label: "Invoice Number", required: true, example: "INV-2026-001", hint: "Unique together with GRN Number." },
  { key: "grnNumber", label: "GRN Number", required: true, example: "GRN-1001", hint: "Unique together with Invoice Number." },
  { key: "customerName", label: "Customer Name", required: true, example: "XYZ Motors", hint: "Text." },
  { key: "invoiceDate", label: "Invoice Date", required: true, example: "31/08/2026", hint: "DD/MM/YYYY or YYYY-MM-DD." },
  { key: "subTotal", label: "Sub Total", required: true, example: "100000", hint: "Amount in ₹ before GST. Plain number, no commas." },
  { key: "gstAmount", label: "GST Amount", required: true, example: "18000", hint: "GST in ₹ (not a percentage). The GST rate is worked out from it." },
  { key: "totalAmount", label: "Total Amount", required: true, example: "118000", hint: "Must equal Sub Total + GST Amount (±₹1)." },
];

// Rules listed under "File format requirements".
export const BULK_RECEIVABLE_FORMAT_NOTES = [
  "Upload a .xlsx, .xls or .csv file. Only the first sheet is read.",
  "Row 1 must be the header row. Use the column names from the template.",
  "GST Amount is the GST in rupees, not a percentage.",
  "Total Amount = Sub Total + GST Amount. Rows that do not match are rejected.",
  "Invoice Number + GRN Number must be unique, including inside the same file.",
];

// Header spellings accepted for each column (lower case).
const COLUMN_ALIASES = {
  invoiceNumber: ["invoicenumber", "invoice_number", "invoice no", "invoice number"],
  grnNumber: ["grnnumber", "grn_number", "grn no", "grn number", "grn"],
  customerName: ["customername", "customer_name", "customer", "customer name"],
  invoiceDate: ["invoicedate", "invoice_date", "invoice date", "date"],
  subTotal: ["subtotal", "sub_total", "sub total", "sub-total"],
  gstAmount: ["gstamount", "gst_amount", "gst amount", "gst"],
  totalAmount: ["totalamount", "total_amount", "total amount", "invoice total"],
};

const REQUIRED_COLUMNS = BULK_RECEIVABLE_COLUMN_GUIDE.map((column) => column.key);

// The sheet has a GST *amount*, the backend needs a GST *rate* (fraction, e.g. 0.18).
// The rate is deliberately NOT rounded, so subTotal * gstRate gives back the exact GST amount.
const deriveGstRate = (subTotal, gstAmount) => {
  if (typeof subTotal !== "number" || Number.isNaN(subTotal)) return ""; // server reports missing sub total
  if (subTotal === 0) return 0;
  return gstAmount / subTotal; // NaN (bad GST cell) is reported by the server
};

/** Reads the chosen file and returns { rows } ready for receivablesApi.create({ invoices: rows }). */
export const parseBulkReceivableFile = async (file) => {
  const sheetRows = await readBulkSheet(file, REQUIRED_COLUMNS, COLUMN_ALIASES);

  const rows = sheetRows.map((row) => {
    const subTotal = toAmount(row.subTotal, "");
    const gstAmount = toAmount(row.gstAmount, 0);

    return {
      invoiceNumber: String(row.invoiceNumber ?? "").trim(),
      grnNumber: String(row.grnNumber ?? "").trim(),
      customerName: String(row.customerName ?? "").trim(),
      invoiceDate: toIsoDate(row.invoiceDate),
      subTotal,
      gstAmount, // kept for the preview; the backend recomputes it from gstRate
      gstRate: deriveGstRate(subTotal, gstAmount), // fraction, same as the single form
      totalAmount: toAmount(row.totalAmount, ""),
      __sourceRow: row.__sourceRow,
    };
  });

  return { rows, rowCount: rows.length };
};