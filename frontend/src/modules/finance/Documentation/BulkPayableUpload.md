# Bulk Payable Upload

## Required flow

1. User opens **Add Payable Invoice**.
2. User clicks **Bulk Payable Add**.
3. User selects `.xlsx`, `.xls`, or `.csv`.
4. The browser parses the file using `xlsx`.
5. Dates are normalized to `YYYY-MM-DD`.
6. The UI previews the parsed JSON rows.
7. The UI sends JSON to `POST /finance/payable/createPayable` as:

```json
{
  "invoices": [
    {
      "invoiceNumber": "INV-2026-001",
      "grnNumber": "GRN-1001",
      "supplierName": "ABC Industries",
      "invoiceDate": "2026-08-31",
      "subTotal": 100000,
      "gstRate": 18,
      "totalAmount": 118000,
      "tdsRate": 1
    }
  ]
}
```

## Required columns

| Order | Column | Required | Example |
|---:|---|---|---|
| 1 | `invoiceNumber` | Yes | `INV-2026-001` |
| 2 | `grnNumber` | Yes | `GRN-1001` |
| 3 | `supplierName` | Yes | `ABC Industries` |
| 4 | `invoiceDate` | Yes | `31/08/2026` |
| 5 | `subTotal` | Yes | `100000` |
| 6 | `gstRate` | Yes | `18` |
| 7 | `totalAmount` | Yes | `118000` |
| 8 | `tdsRate` | Yes | `1` |

Column order is recommended. Header matching is case-insensitive and common variants such as `invoice_number`, `Invoice Number`, and `invoiceNumber` are accepted.

## Supported date formats

- Excel date cells / serial dates
- `YYYY-MM-DD`
- `YYYY/MM/DD`
- `YYYY.MM.DD`
- `DD/MM/YYYY`
- `DD-MM-YYYY`
- `DD.MM.YYYY`
- `31 Aug 2026`
- `31 August 2026`
- `Aug 31 2026`

## Dependency

The frontend project must have the `xlsx` package:

```bash
npm install xlsx
```

## Important

The backend does not receive the original Excel/CSV file. It receives only the normalized JSON rows after browser-side parsing and preview.

## Where the code lives
- `components/payableComponents/AddPayableDialog.jsx` shows the upload screen through the shared `components/common/BulkUploadWorkspace.jsx`.
- `utils/bulkPayableParser.js` lists the columns and cleans each row; `utils/bulkSheetReader.js` reads the file.
- Messages after upload are shown with the app toast (`useToast`).

