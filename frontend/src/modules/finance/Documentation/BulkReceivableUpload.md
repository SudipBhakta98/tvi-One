# Bulk Receivable Upload

1. Open **Create Receivable** and click **Bulk Receivable Add**.
2. Choose a `.xlsx`, `.xls` or `.csv` file. It is parsed in the browser and previewed.
3. **Upload The Data** sends `POST /finance/receivable/createReceivable` with `{ "invoices": [ ... ] }`.

| Column | Required | Example | Accepted headers |
|---|---|---|---|
| `invoiceNumber` | Yes | `INV-2026-001` | Invoice Number, invoice_number |
| `grnNumber` | Yes | `GRN-1001` | GRN, GRN Number |
| `customerName` | Yes | `XYZ Motors` | Customer Name, Customer |
| `invoiceDate` | Yes | `31/08/2026` | Invoice Date, Date |
| `subTotal` | Yes | `100000` | Subtotal, Sub Total |
| `gstAmount` | Yes | `18000` | GST, GST Amount |
| `totalAmount` | Yes | `118000` | Total Amount |

- GST is an **amount** in rupees, not a rate. A blank GST cell is read as 0.
- Total Amount must equal Sub Total + GST (up to ₹1 rounding difference).
- Invoice Number + GRN must be unique; duplicates are reported per row and the valid rows are still created.
- Requires `npm install xlsx` in the frontend.

## Where the code lives
- `components/receivableComponents/AddReceivableDialog.jsx` shows the upload screen through the shared `components/common/BulkUploadWorkspace.jsx`.
- `utils/bulkReceivableParser.js` lists the columns and cleans each row; `utils/bulkSheetReader.js` reads the file.
- Messages after upload are shown with the app toast (`useToast`).

