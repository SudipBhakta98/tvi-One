# Finance Module – File Guide

Every file, what it does, why it exists, the functions inside it, and which other files it works with.
Function names, imports, "Used by", API calls and routes in this guide are **generated from the code**, so they match it exactly.

- Frontend lives in `src/modules/finance/` (paths below are relative to it).
- Backend lives in `backend/modules/finance/` (paths below are relative to it).

> Two folder names contain old spellings: `creditComponets` and `paymentComponets`. They are kept as they are because renaming them would break imports.

---

# Part 1 – Frontend

## Entry points and shared setup

### `api.js`
- **What it does:** One object per backend area (`payablesApi`, `paymentApi`, `receivablesApi`, ...). Each method is a single axios call to one backend route.
- **Why it exists:** Screens never write URLs. If a route changes, only this file changes.
- **Functions / exports:** `payablesApi`, `supplierAdvanceApi`, `paymentApi`, `debitApi`, `creditApi`, `receivablesApi`, `collectionApi`
  - `payablesApi`: `getAnalytics`, `search`, `getDetails`, `create`, `update`, `delete`
  - `supplierAdvanceApi`: `list`, `details`, `balance`, `create`, `updateStatus`
  - `paymentApi`: `getSupplierAdvances`, `getSupplierAdvanceBalance`, `createSupplierAdvance`, `updateSupplierAdvanceStatus`, `getPayments`, `getPendingPayments`, `searchPayment`, `createSinglePayment`, `updatePayment`, `updatePaymentStatus`, `deletePayment`
  - `debitApi`: `createDebit`, `updateDebit`, `deleteDebit`
  - `creditApi`: `getCreditNotes`, `createCredit`, `updateCredit`, `deleteCredit`, `creditDetails`, `pendingAndPartialCredits`
  - `receivablesApi`: `getAnalytics`, `search`, `getDetails`, `create`, `update`, `delete`
  - `collectionApi`: `getCollections`, `createCollection`, `updateCollection`, `updateCollectionStatus`, `deleteCollection`
- **Not called by any screen in this module yet:** `payablesApi.search`, `supplierAdvanceApi.list`, `supplierAdvanceApi.balance`, `supplierAdvanceApi.create`, `paymentApi.updateSupplierAdvanceStatus`, `paymentApi.getPayments`, `paymentApi.getPendingPayments`, `paymentApi.searchPayment`
- **Imports (finance files):** —
- **Used by:** `components/advanceComponents/AdvanceDetailDialog.jsx`, `components/advanceComponents/MakeAdvanceDialog.jsx`, `components/collectionComponents/AddCollectionDialog.jsx`, `components/collectionComponents/CollectionCard.jsx`, `components/creditComponets/CreateCreditDialog.jsx`, `components/creditComponets/CreditNoteDialog.jsx`, `components/debitComponents/AddDebitDialog.jsx`, `components/debitComponents/DebitCard.jsx`, `components/payableComponents/AddPayableDialog.jsx`, `components/payableComponents/EditPayableDialog.jsx`, `components/payableComponents/PayablesInvoiceDialog.jsx`, `components/paymentComponets/AddPaymentDialog.jsx`, `components/paymentComponets/PaymentCard.jsx`, `components/receivableComponents/AddReceivableDialog.jsx`, `components/receivableComponents/EditReceivableDialog.jsx`, `components/receivableComponents/ReceivablesInvoiceDialog.jsx`, `pages/AdvancePaymentPage.jsx`, `pages/ApproveReceivablesPage.jsx`, `pages/CreditPage.jsx`, `pages/PayablesPage.jsx`, `pages/ReceivablesPage.jsx`

### `constants/financeRoles.js`
- **What it does:** Exports `RECEIVABLE_APPROVER_ROLES` (Admin, Super User, Finance Manager).
- **Why it exists:** One list shared by the sidebar link and the route guard, so the menu and the page can never disagree.
- **Functions / exports:** `RECEIVABLE_APPROVER_ROLES`
- **Imports (finance files):** —
- **Used by:** imported from `App.jsx` and `AppLayout.jsx`

## Pages (one per route)

### `pages/AdvancePaymentPage.jsx`
- **What it does:** Register of supplier advances with search, status and month filters, an "only available" toggle, and the Make Advance button. Opens `AdvanceDetailDialog`.
- **Why it exists:** Advances are paid before an invoice exists, so they have their own screen.
- **Functions / exports:** `AdvancePaymentPage`, `monthKey`
- **Imports (finance files):** `api.js`, `components/advanceComponents/AdvanceDetailDialog.jsx`, `components/advanceComponents/MakeAdvanceDialog.jsx`, `utils/financeFormat.js`
- **Used by:** routed from `App.jsx`
- **Backend calls:** `paymentApi.getSupplierAdvances`

### `pages/ApproveReceivablesPage.jsx`
- **What it does:** Lists collections by status (Pending / Approved / Rejected). Approve or Reject buttons appear on the Pending tab.
- **Why it exists:** Second step of the receivable workflow; only approver roles can open it.
- **Functions / exports:** `ApproveReceivablesPage`, `sumOf`
- **Imports (finance files):** `api.js`, `components/common/ExcelFilterDropdown.jsx`, `components/receivableComponents/ReceivableBadges.jsx`, `utils/financeFormat.js`
- **Used by:** routed from `App.jsx`
- **Backend calls:** `collectionApi.getCollections`, `collectionApi.updateCollectionStatus`

### `pages/CreditPage.jsx`
- **What it does:** Register of supplier credit notes with status filters; opens `CreditNoteDialog` and `CreateCreditDialog`.
- **Why it exists:** Credit notes are separate from invoices and are used later when paying.
- **Functions / exports:** `CreditStatusBadge`, `CreditPage`, `getMonthYearLabel`, `getCreditStatus`
- **Imports (finance files):** `api.js`, `components/creditComponets/CreateCreditDialog.jsx`, `components/creditComponets/CreditNoteDialog.jsx`, `utils/financeFormat.js`
- **Used by:** routed from `App.jsx`
- **Backend calls:** `creditApi.getCreditNotes`

### `pages/PayablesPage.jsx`
- **What it does:** Payable Register: 6 KPI cards, search + Supplier / Month / Status filters, ledger grouped by supplier. Opens `PayablesInvoiceDialog` on row click and `AddPayableDialog` when the URL has `?create=1`.
- **Why it exists:** Entry screen of the Payables module.
- **Functions / exports:** `StatusBadge`, `DueDaysBadge`, `PayablesPage`, `normalizeInvoice`
- **Imports (finance files):** `api.js`, `components/common/ExcelFilterDropdown.jsx`, `components/payableComponents/AddPayableDialog.jsx`, `components/payableComponents/PayablesInvoiceDialog.jsx`, `contexts/PayableContext.jsx`, `hooks/useMultiFilter.js`, `utils/financeFormat.js`
- **Used by:** routed from `App.jsx`
- **Backend calls:** `payablesApi.getAnalytics`

### `pages/ReceivablesPage.jsx`
- **What it does:** Receivable Register: 7 KPI cards, search (server side) + Customer / Month / Status filters, ledger grouped by customer. Opens `ReceivablesInvoiceDialog` and `AddReceivableDialog`.
- **Why it exists:** Entry screen of the Receivables module.
- **Functions / exports:** `ReceivablesPage`, `normalizeInvoice`, `percentOf`, `sumOf`, `countOf`
- **Imports (finance files):** `api.js`, `components/common/ExcelFilterDropdown.jsx`, `components/receivableComponents/AddReceivableDialog.jsx`, `components/receivableComponents/ReceivableBadges.jsx`, `components/receivableComponents/ReceivablesInvoiceDialog.jsx`, `contexts/ReceivableContext.jsx`, `hooks/useMultiFilter.js`, `utils/financeFormat.js`
- **Used by:** routed from `App.jsx`
- **Backend calls:** `receivablesApi.getAnalytics`, `receivablesApi.search`

## Contexts and hooks

### `contexts/PayableContext.jsx`
- **What it does:** Holds the invoices of the Payable Register (`analyticsData`) and the payments / debit notes of the invoice that is open (`detailsData`).
- **Why it exists:** The register and the invoice dialog need the same data; a context avoids passing it down through props. Provided only on the Payables route.
- **Functions / exports:** `sumPaymentsWithStatus`, `PayablesProvider`, `usePayables`
- **Imports (finance files):** —
- **Used by:** `components/payableComponents/PayablesInvoiceDialog.jsx`, `pages/PayablesPage.jsx`

### `contexts/ReceivableContext.jsx`
- **What it does:** Same idea as PayableContext, for receivables: `analyticsData`, `searchResults`, `detailsData` (collections of the open invoice).
- **Why it exists:** Shares data between the Receivable Register and its invoice dialog. Provided only on the Receivables route.
- **Functions / exports:** `sumBy`, `ReceivablesProvider`, `useReceivables`
- **Imports (finance files):** —
- **Used by:** `components/receivableComponents/ReceivablesInvoiceDialog.jsx`, `pages/ReceivablesPage.jsx`

### `hooks/useMultiFilter.js`
- **What it does:** State for one Excel-style filter. Empty selection = no filter, so every option is shown ticked.
- **Why it exists:** Payables and Receivables both have three filters; this removes the repeated state code.
- **Functions / exports:** `useMultiFilter`
- **Imports (finance files):** —
- **Used by:** `pages/PayablesPage.jsx`, `pages/ReceivablesPage.jsx`

## Shared components

### `components/common/BulkUploadWorkspace.jsx`
- **What it does:** The full-screen bulk upload: choose file, preview rows, download a CSV template, upload, show per-row failures. Wording and the save call come in as props.
- **Why it exists:** Add Payable and Add Receivable had two identical copies; one component serves both.
- **Functions / exports:** `DownloadTemplate`, `BulkUploadWorkspace`
- **Imports (finance files):** —
- **Used by:** `components/payableComponents/AddPayableDialog.jsx`, `components/receivableComponents/AddReceivableDialog.jsx`

### `components/common/ExcelFilterDropdown.jsx`
- **What it does:** A dropdown with tick boxes, search, Select All and Clear.
- **Why it exists:** Used by the Payables, Receivables and Approve Receivables pages so every filter looks and behaves the same.
- **Functions / exports:** `ExcelFilterDropdown`
- **Imports (finance files):** —
- **Used by:** `pages/ApproveReceivablesPage.jsx`, `pages/PayablesPage.jsx`, `pages/ReceivablesPage.jsx`

## Payable components

### `components/debitComponents/AddDebitDialog.jsx`
- **What it does:** Form to add a debit note to an invoice (limited to what is still open).
- **Why it exists:** Debit notes reduce what we owe the supplier.
- **Functions / exports:** `AddDebitDialog`
- **Imports (finance files):** `api.js`
- **Used by:** `components/payableComponents/PayablesInvoiceDialog.jsx`
- **Backend calls:** `debitApi.createDebit`

### `components/debitComponents/DebitCard.jsx`
- **What it does:** Shows one debit note with edit and delete.
- **Why it exists:** Debit note life cycle on the invoice screen.
- **Functions / exports:** `DebitCard`
- **Imports (finance files):** `api.js`, `utils/financeFormat.js`
- **Used by:** `components/payableComponents/PayablesInvoiceDialog.jsx`
- **Backend calls:** `debitApi.deleteDebit`, `debitApi.updateDebit`

### `components/payableComponents/AddPayableDialog.jsx`
- **What it does:** Create Payable page (single invoice form with live GST / TDS / total preview) and a switch to bulk upload.
- **Why it exists:** Creating invoices from the Payable Register.
- **Functions / exports:** `AddPayableDialog`, `formatMoney`
- **Imports (finance files):** `api.js`, `components/common/BulkUploadWorkspace.jsx`, `utils/bulkPayableParser.js`
- **Used by:** `pages/PayablesPage.jsx`
- **Backend calls:** `payablesApi.create`

### `components/payableComponents/EditPayableDialog.jsx`
- **What it does:** Edit form for an invoice. A remark is required and is saved in the invoice's update history.
- **Why it exists:** Keeps edits traceable.
- **Functions / exports:** `EditPayableDialog`
- **Imports (finance files):** `api.js`
- **Used by:** `components/payableComponents/PayablesInvoiceDialog.jsx`
- **Backend calls:** `payablesApi.update`

### `components/payableComponents/PayablesInvoiceDialog.jsx`
- **What it does:** The invoice screen: breakdown, payment and debit summary, list of payments (`PaymentCard`) and debit notes (`DebitCard`), buttons to pay, add debit, edit and delete.
- **Why it exists:** Single place where everything about one payable invoice is handled.
- **Functions / exports:** `StatusBadge`, `DueDaysBadge`, `PayablesInvoiceDialog`
- **Imports (finance files):** `api.js`, `components/debitComponents/AddDebitDialog.jsx`, `components/debitComponents/DebitCard.jsx`, `components/payableComponents/EditPayableDialog.jsx`, `components/paymentComponets/AddPaymentDialog.jsx`, `components/paymentComponets/PaymentCard.jsx`, `contexts/PayableContext.jsx`, `utils/financeFormat.js`
- **Used by:** `pages/PayablesPage.jsx`
- **Backend calls:** `payablesApi.delete`, `payablesApi.getDetails`

### `components/paymentComponets/AddPaymentDialog.jsx`
- **What it does:** Pay an invoice. Two separate modes: **Pay with Advance** (advance only, auto-approved) and **Add Payment** (credit note only, goes to approval).
- **Why it exists:** Keeps the advance and credit-note rules in one form.
- **Functions / exports:** `AddPaymentDialog`
- **Imports (finance files):** `api.js`, `components/advanceComponents/AdvanceUsagePanel.jsx`
- **Used by:** `components/payableComponents/PayablesInvoiceDialog.jsx`
- **Backend calls:** `creditApi.pendingAndPartialCredits`, `paymentApi.createSinglePayment`, `paymentApi.getSupplierAdvanceBalance`

### `components/paymentComponets/PaymentCard.jsx`
- **What it does:** Shows one payment with edit and delete while it is not approved. (Credit-note payments are approved or rejected from the Credit Note screen, see `CreditNoteDialog`.)
- **Why it exists:** A payment has its own life cycle after it is created.
- **Functions / exports:** `MethodBadge`, `PaymentStatusBadge`, `PaymentCard`, `formatDateForInput`, `getUserDisplayName`
- **Imports (finance files):** `api.js`, `components/advanceComponents/AdvanceUsagePanel.jsx`, `utils/financeFormat.js`
- **Used by:** `components/payableComponents/PayablesInvoiceDialog.jsx`
- **Backend calls:** `creditApi.pendingAndPartialCredits`, `paymentApi.deletePayment`, `paymentApi.getSupplierAdvanceBalance`, `paymentApi.updatePayment`

## Advance and credit components

### `components/advanceComponents/AdvanceDetailDialog.jsx`
- **What it does:** Details of one advance: balance, adjustments, approve / reject.
- **Why it exists:** Review and approval of an advance.
- **Functions / exports:** `AdvanceStatusBadge`, `AdvanceDetailDialog`, `inr`, `fmtDate`, `Stat`, `advanceStatusStyle`
- **Imports (finance files):** `api.js`
- **Used by:** `pages/AdvancePaymentPage.jsx`
- **Backend calls:** `supplierAdvanceApi.details`, `supplierAdvanceApi.updateStatus`

### `components/advanceComponents/AdvanceUsagePanel.jsx`
- **What it does:** Lets the user split a payment across the supplier's advances; exports `buildAdvancePayload` and `validateAdvanceUsage`.
- **Why it exists:** Used by AddPaymentDialog and PaymentCard so advance rules are written once.
- **Functions / exports:** `AdvanceUsagePanel`, `inr`, `buildAdvancePayload`, `validateAdvanceUsage`
- **Imports (finance files):** —
- **Used by:** `components/paymentComponets/AddPaymentDialog.jsx`, `components/paymentComponets/PaymentCard.jsx`

### `components/advanceComponents/MakeAdvanceDialog.jsx`
- **What it does:** Form to record an advance paid to a supplier; suggests supplier names from payables.
- **Why it exists:** Starts the advance life cycle.
- **Functions / exports:** `MakeAdvanceDialog`, `today`
- **Imports (finance files):** `api.js`
- **Used by:** `pages/AdvancePaymentPage.jsx`
- **Backend calls:** `paymentApi.createSupplierAdvance`

### `components/creditComponets/CreateCreditDialog.jsx`
- **What it does:** Form to create a credit note.
- **Why it exists:** Starts the credit note life cycle.
- **Functions / exports:** `CreateCreditDialog`
- **Imports (finance files):** `api.js`
- **Used by:** `pages/CreditPage.jsx`
- **Backend calls:** `creditApi.createCredit`

### `components/creditComponets/CreditNoteDialog.jsx`
- **What it does:** Details of one credit note: its allocation requests, with Approve / Reject of the payments waiting on it (`paymentApi.updatePaymentStatus`), plus edit and delete.
- **Why it exists:** Review and maintenance of a credit note.
- **Functions / exports:** `CreditStatusBadge`, `CreditNoteDialog`, `resolveUserName`, `getCalculatedStatus`
- **Imports (finance files):** `api.js`, `utils/financeFormat.js`
- **Used by:** `pages/CreditPage.jsx`
- **Backend calls:** `creditApi.creditDetails`, `creditApi.deleteCredit`, `creditApi.updateCredit`, `paymentApi.updatePaymentStatus`

## Receivable components

### `components/collectionComponents/AddCollectionDialog.jsx`
- **What it does:** Form to record money received: Received Amount, TDS Amount, date. Blocks amounts above the allowed limit.
- **Why it exists:** Step one of the receivable workflow.
- **Functions / exports:** `AddCollectionDialog`
- **Imports (finance files):** `api.js`, `utils/financeFormat.js`
- **Used by:** `components/receivableComponents/ReceivablesInvoiceDialog.jsx`
- **Backend calls:** `collectionApi.createCollection`

### `components/collectionComponents/CollectionCard.jsx`
- **What it does:** Shows one collection with edit (back to Pending) and delete while it is not approved.
- **Why it exists:** A collection has its own life cycle after it is created.
- **Functions / exports:** `CollectionCard`, `toDateInput`
- **Imports (finance files):** `api.js`, `components/receivableComponents/ReceivableBadges.jsx`, `utils/financeFormat.js`
- **Used by:** `components/receivableComponents/ReceivablesInvoiceDialog.jsx`
- **Backend calls:** `collectionApi.deleteCollection`, `collectionApi.updateCollection`

### `components/receivableComponents/AddReceivableDialog.jsx`
- **What it does:** Create Receivable page (invoice form with Sub Total + GST = Total) and a switch to bulk upload.
- **Why it exists:** Creating receivable invoices.
- **Functions / exports:** `AddReceivableDialog`, `formatMoney`
- **Imports (finance files):** `api.js`, `components/common/BulkUploadWorkspace.jsx`, `utils/bulkReceivableParser.js`
- **Used by:** `pages/ReceivablesPage.jsx`
- **Backend calls:** `receivablesApi.create`

### `components/receivableComponents/EditReceivableDialog.jsx`
- **What it does:** Edit form for a receivable invoice; a remark is required.
- **Why it exists:** Keeps edits traceable.
- **Functions / exports:** `EditReceivableDialog`
- **Imports (finance files):** `api.js`
- **Used by:** `components/receivableComponents/ReceivablesInvoiceDialog.jsx`
- **Backend calls:** `receivablesApi.update`

### `components/receivableComponents/ReceivableBadges.jsx`
- **What it does:** Small coloured labels: `StatusBadge`, `DueDaysBadge`, `CollectionStatusBadge`.
- **Why it exists:** Used by the receivable register, invoice dialog and approve page.
- **Functions / exports:** `StatusBadge`, `DueDaysBadge`, `CollectionStatusBadge`
- **Imports (finance files):** —
- **Used by:** `components/collectionComponents/CollectionCard.jsx`, `components/receivableComponents/ReceivablesInvoiceDialog.jsx`, `pages/ApproveReceivablesPage.jsx`, `pages/ReceivablesPage.jsx`

### `components/receivableComponents/ReceivablesInvoiceDialog.jsx`
- **What it does:** The receivable invoice screen: breakdown, collection summary (collected, TDS, pending approval, outstanding), list of collections, Add Collection, edit and delete.
- **Why it exists:** Single place for everything about one receivable invoice.
- **Functions / exports:** `ReceivablesInvoiceDialog`, `SummaryTile`, `BreakdownTile`
- **Imports (finance files):** `api.js`, `components/collectionComponents/AddCollectionDialog.jsx`, `components/collectionComponents/CollectionCard.jsx`, `components/receivableComponents/EditReceivableDialog.jsx`, `components/receivableComponents/ReceivableBadges.jsx`, `contexts/ReceivableContext.jsx`, `utils/financeFormat.js`
- **Used by:** `pages/ReceivablesPage.jsx`
- **Backend calls:** `receivablesApi.delete`, `receivablesApi.getDetails`

## Utilities

### `utils/bulkPayableParser.js`
- **What it does:** Describes the Payable upload columns (`BULK_PAYABLE_COLUMN_GUIDE`) and turns sheet rows into payable invoice objects (`parseBulkPayableFile`).
- **Why it exists:** Keeps Payable-specific column names and cleanup out of the shared reader.
- **Functions / exports:** `parseBulkPayableFile`, `BULK_PAYABLE_COLUMN_GUIDE`
- **Imports (finance files):** `utils/bulkSheetReader.js`
- **Used by:** `components/payableComponents/AddPayableDialog.jsx`
- **Backend calls:** `payablesApi.create`

### `utils/bulkReceivableParser.js`
- **What it does:** Same as the payable parser but for receivable columns (GST as an amount, `customerName`).
- **Why it exists:** Keeps Receivable-specific column names and cleanup out of the shared reader.
- **Functions / exports:** `parseBulkReceivableFile`, `BULK_RECEIVABLE_COLUMN_GUIDE`
- **Imports (finance files):** `utils/bulkSheetReader.js`
- **Used by:** `components/receivableComponents/AddReceivableDialog.jsx`
- **Backend calls:** `receivablesApi.create`

### `utils/bulkSheetReader.js`
- **What it does:** Reads an Excel / CSV file in the browser: checks file type, matches header names, checks required columns, returns the rows. Also `toIsoDate` and `toAmount`.
- **Why it exists:** The payable and receivable parsers shared about 90 identical lines; they now live here once.
- **Functions / exports:** `cleanHeader`, `pad`, `isoOf`, `toIsoDate`, `toAmount`, `readBulkSheet`
- **Imports (finance files):** —
- **Used by:** `utils/bulkPayableParser.js`, `utils/bulkReceivableParser.js`

### `utils/financeFormat.js`
- **What it does:** Money and date helpers: `formatCurrency` (₹ Indian format), `formatDateDMY`, `formatDisplayDate`, `parseDateString` (month key + label for the Month filter), `decimalOnly` (amount input cleaner).
- **Why it exists:** The same formatting was copied into many files before; now every screen formats numbers and dates the same way.
- **Functions / exports:** `formatCurrency`, `formatDateString`, `formatDateDMY`, `formatDisplayDate`, `monthEntry`, `parseDateString`, `decimalOnly`, `MONTH_NAMES`
- **Imports (finance files):** —
- **Used by:** `components/collectionComponents/AddCollectionDialog.jsx`, `components/collectionComponents/CollectionCard.jsx`, `components/creditComponets/CreditNoteDialog.jsx`, `components/debitComponents/DebitCard.jsx`, `components/payableComponents/PayablesInvoiceDialog.jsx`, `components/paymentComponets/PaymentCard.jsx`, `components/receivableComponents/ReceivablesInvoiceDialog.jsx`, `pages/AdvancePaymentPage.jsx`, `pages/ApproveReceivablesPage.jsx`, `pages/CreditPage.jsx`, `pages/PayablesPage.jsx`, `pages/ReceivablesPage.jsx`

---

# Part 2 – Backend

## Routes: URL → controller

Mounted in `server.js`: `/api/finance/payable`, `/payment`, `/debit`, `/credit`, `/receivable`, `/collection` (prefix depends on your server).

| Route file | Method | Path | Controller |
|---|---|---|---|
| `routes/collectionRoutes.js` | POST | `/createCollection` | `createCollection` |
| `routes/collectionRoutes.js` | DELETE | `/deleteCollection/:collectionId` | `deleteCollection` |
| `routes/collectionRoutes.js` | GET | `/getCollections` | `getCollections` |
| `routes/collectionRoutes.js` | PUT | `/updateCollection/:collectionId` | `updateCollection` |
| `routes/collectionRoutes.js` | PATCH | `/updateCollectionStatus/:collectionId` | `updateCollectionStatus` |
| `routes/creditRoutes.js` | POST | `/createCredit` | `createCredit` |
| `routes/creditRoutes.js` | DELETE | `/deleteCredit/:creditNoteNumber` | `deleteCredit` |
| `routes/creditRoutes.js` | GET | `/getCreditDetails/:creditNoteNumber` | `getCreditDetails` |
| `routes/creditRoutes.js` | GET | `/getCreditNotes` | `getCreditNotes` |
| `routes/creditRoutes.js` | GET | `/getPendingAndPartialCredits` | `getPendingAndPartialCredits` |
| `routes/creditRoutes.js` | PUT | `/updateCredit/:creditNoteNumber` | `updateCredit` |
| `routes/debitRoutes.js` | POST | `/createDebit` | `createDebit` |
| `routes/debitRoutes.js` | DELETE | `/deleteDebit/:debitId` | `deleteDebit` |
| `routes/debitRoutes.js` | PUT | `/editDebit/:id` | `editDebit` |
| `routes/payableRoutes.js` | POST | `/createPayable` | `createPayable` |
| `routes/payableRoutes.js` | DELETE | `/deletePayable/:id` | `deletePayable` |
| `routes/payableRoutes.js` | GET | `/getPayableDetails` | `getPayableDetails` |
| `routes/payableRoutes.js` | GET | `/getPayablesAnalytics` | `getPayablesAnalytics` |
| `routes/payableRoutes.js` | GET | `/getSearchPayable` | `getSearchPayable` |
| `routes/payableRoutes.js` | PUT | `/updatePayable/:id` | `updatePayable` |
| `routes/paymentRoutes.js` | POST | `/createSinglePayment` | `createSinglePayment` |
| `routes/paymentRoutes.js` | POST | `/createSupplierAdvance` | `createSupplierAdvance` |
| `routes/paymentRoutes.js` | DELETE | `/deletePayment/:paymentId` | `deletePayment` |
| `routes/paymentRoutes.js` | GET | `/getPayments` | `getPayments` |
| `routes/paymentRoutes.js` | GET | `/getPendingPayments` | `getPendingPayments` |
| `routes/paymentRoutes.js` | GET | `/getSupplierAdvanceBalance` | `getSupplierAdvanceBalance` |
| `routes/paymentRoutes.js` | GET | `/getSupplierAdvanceDetails/:id` | `getSupplierAdvanceDetails` |
| `routes/paymentRoutes.js` | GET | `/getSupplierAdvances` | `getSupplierAdvances` |
| `routes/paymentRoutes.js` | GET | `/searchPayment` | `getSearchPayment` |
| `routes/paymentRoutes.js` | PUT | `/updatePayment/:paymentId` | `updatePayment` |
| `routes/paymentRoutes.js` | PATCH | `/updatePaymentStatus/:paymentId` | `updatePaymentStatus` |
| `routes/paymentRoutes.js` | PATCH | `/updateSupplierAdvanceStatus/:id` | `updateSupplierAdvanceStatus` |
| `routes/receivableRoutes.js` | POST | `/createReceivable` | `createReceivable` |
| `routes/receivableRoutes.js` | DELETE | `/deleteReceivable/:id` | `deleteReceivable` |
| `routes/receivableRoutes.js` | GET | `/getReceivableDetails` | `getReceivableDetails` |
| `routes/receivableRoutes.js` | GET | `/getReceivablesAnalytics` | `getReceivablesAnalytics` |
| `routes/receivableRoutes.js` | GET | `/getSearchReceivable` | `getSearchReceivable` |
| `routes/receivableRoutes.js` | PUT | `/updateReceivable/:id` | `updateReceivable` |

## Models

### `models/collectionModel.js`
- **What it does:** Collection schema: received amount, TDS amount, status (Pending / Approved / Rejected), approver.
- **Why it exists:** Stores money received against a receivable invoice.
- **Imports:** —
- **Used by:** `controllers/collectionController/createCollection.js`, `controllers/collectionController/deleteCollection.js`, `controllers/collectionController/getCollections.js`, `controllers/collectionController/updateCollection.js`, `controllers/collectionController/updateCollectionStatus.js`, `controllers/receivablesController/deleteReceivable.js`, `controllers/receivablesController/getReceivableDetails.js`, `utils/receivableFinancials.js`, `utils/receivableRows.js`

### `models/creditModel.js`
- **What it does:** Credit note schema with allocation requests and allocations.
- **Why it exists:** Stores supplier credit notes and how they were used.
- **Imports:** —
- **Used by:** `controllers/creditController/createCredit.js`, `controllers/creditController/deleteCredit.js`, `controllers/creditController/getCreditDetails.js`, `controllers/creditController/getCreditNotes.js`, `controllers/creditController/getPendingAndPartialCredits.js`, `controllers/creditController/updateCredit.js`, `controllers/paymentController/createSinglePayment.js`, `controllers/paymentController/deletePayment.js`, `controllers/paymentController/updatePayment.js`, `controllers/paymentController/updatePaymentStatus.js`

### `models/debitModel.js`
- **What it does:** Debit note schema.
- **Why it exists:** Stores reductions of what is payable.
- **Imports:** —
- **Used by:** `controllers/debitController/createDebit.js`, `controllers/debitController/deleteDebit.js`, `controllers/debitController/updateDebit.js`, `controllers/payablesController/deletePayable.js`, `controllers/payablesController/getPayableDetails.js`, `controllers/payablesController/getPayablesAnalytics.js`

### `models/payableModel.js`
- **What it does:** Payable invoice schema (supplier, amounts, GST / TDS, update history). Unique on invoice number + GRN.
- **Why it exists:** Stores supplier invoices.
- **Imports:** —
- **Used by:** `controllers/payablesController/createPayable.js`, `controllers/payablesController/deletePayable.js`, `controllers/payablesController/getPayablesAnalytics.js`, `controllers/payablesController/searchPayable.js`, `controllers/payablesController/updatePayable.js`, `utils/invoiceFinancials.js`

### `models/paymentModel.js`
- **What it does:** Payment schema: method (CASH, BANK, CHEQUE, ONLINE, UPI, ADVANCE), status, credit note and advance allocations.
- **Why it exists:** Stores every payment made against an invoice.
- **Imports:** —
- **Used by:** `controllers/payablesController/deletePayable.js`, `controllers/payablesController/getPayableDetails.js`, `controllers/payablesController/getPayablesAnalytics.js`, `controllers/paymentController/createSinglePayment.js`, `controllers/paymentController/createSupplierAdvance.js`, `controllers/paymentController/deletePayment.js`, `controllers/paymentController/getPayments.js`, `controllers/paymentController/getPendingPayments.js`, `controllers/paymentController/searchPayment.js`, `controllers/paymentController/updatePayment.js`, `controllers/paymentController/updatePaymentStatus.js`, `controllers/paymentController/updateSupplierAdvanceStatus.js`, `utils/invoiceFinancials.js`

### `models/receivableModel.js`
- **What it does:** Receivable invoice schema (customer, sub total, GST amount, total). Unique on invoice number + GRN.
- **Why it exists:** Stores customer invoices.
- **Imports:** —
- **Used by:** `controllers/receivablesController/createReceivable.js`, `controllers/receivablesController/deleteReceivable.js`, `controllers/receivablesController/getReceivablesAnalytics.js`, `controllers/receivablesController/searchReceivable.js`, `controllers/receivablesController/updateReceivable.js`, `utils/receivableFinancials.js`

### `models/supplierAdvanceModel.js`
- **What it does:** Supplier advance schema with its balance and adjustments.
- **Why it exists:** Stores advances paid before invoices.
- **Imports:** —
- **Used by:** `controllers/paymentController/createSinglePayment.js`, `controllers/paymentController/createSupplierAdvance.js`, `controllers/paymentController/getSupplierAdvanceBalance.js`, `controllers/paymentController/getSupplierAdvanceDetails.js`, `controllers/paymentController/getSupplierAdvances.js`, `controllers/paymentController/updatePaymentStatus.js`, `controllers/paymentController/updateSupplierAdvanceStatus.js`, `utils/advanceSettlement.js`

## Middleware

### `middleware/mapFinanceUser.js`
- **What it does:** Maps Admin, Super User and Finance Manager to the role "Super User" for finance routes.
- **Why it exists:** Controllers only check one role name.
- **Functions:** `mapFinanceUser`
- **Imports:** —
- **Used by:** applied in `server.js` before the finance routes

## Utilities

### `utils/advanceSettlement.js`
- **What it does:** Reserve, release, settle and restore supplier advances.
- **Why it exists:** Keeps advance balance rules in one place.
- **Functions:** `round2`, `escapeRegex`, `supplierNameFilter`, `getAdvanceStatus`, `availableOf`, `normalizeAdvanceInput`, `reserveAdvances`, `releaseAdvances`, `settleAdvances`, `restoreAdjustedAdvances`, `findUsableAdvances`, `advanceErrorResponse`
- **Imports:** `models/supplierAdvanceModel.js`
- **Used by:** `controllers/payablesController/deletePayable.js`, `controllers/paymentController/createSinglePayment.js`, `controllers/paymentController/deletePayment.js`, `controllers/paymentController/getSupplierAdvanceBalance.js`, `controllers/paymentController/updatePayment.js`, `controllers/paymentController/updatePaymentStatus.js`

### `utils/invoiceFinancials.js`
- **What it does:** Calculates outstanding, pending and the maximum next payment of a payable invoice.
- **Why it exists:** Payments, debits and the invoice dialog all need the same numbers.
- **Functions:** `getInvoiceFinancials`
- **Imports:** `models/payableModel.js`, `models/paymentModel.js`
- **Used by:** `controllers/debitController/createDebit.js`, `controllers/debitController/updateDebit.js`, `controllers/paymentController/createSinglePayment.js`, `controllers/paymentController/updatePayment.js`

### `utils/receivableFinancials.js`
- **What it does:** Same as invoiceFinancials but for receivables: outstanding = total - approved (received + TDS).
- **Why it exists:** Collections and invoice edits need the same numbers.
- **Functions:** `round2`, `getReceivableFinancials`
- **Imports:** `models/collectionModel.js`, `models/receivableModel.js`
- **Used by:** `controllers/collectionController/createCollection.js`, `controllers/collectionController/updateCollection.js`, `controllers/receivablesController/createReceivable.js`, `controllers/receivablesController/updateReceivable.js`, `utils/receivableRows.js`

### `utils/receivableRows.js`
- **What it does:** Builds register rows (collected, TDS, outstanding, status, due days) from invoices.
- **Why it exists:** Analytics and search return identical rows.
- **Functions:** `formatDate`, `buildReceivableRows`
- **Imports:** `models/collectionModel.js`, `utils/receivableFinancials.js`
- **Used by:** `controllers/receivablesController/getReceivablesAnalytics.js`, `controllers/receivablesController/searchReceivable.js`

## Payable controllers

### `controllers/payablesController/createPayable.js`
- **What it does:** Creates one invoice or a bulk list; returns per-row errors for bulk.
- **Why it exists:** Backs Add Payable and bulk upload.
- **Functions:** `parseFlexibleDate`, `createPayable`
- **Route:** POST `/createPayable`
- **Imports:** `models/payableModel.js`
- **Used by:** `routes/payableRoutes.js`

### `controllers/payablesController/deletePayable.js`
- **What it does:** Deletes an invoice with its payments and debit notes, giving back advances.
- **Why it exists:** Backs Delete Payable.
- **Functions:** `deletePayable`
- **Route:** DELETE `/deletePayable/:id`
- **Imports:** `models/debitModel.js`, `models/payableModel.js`, `models/paymentModel.js`, `utils/advanceSettlement.js`
- **Used by:** `routes/payableRoutes.js`

### `controllers/payablesController/getPayableDetails.js`
- **What it does:** Returns payments and debit notes of one invoice.
- **Why it exists:** Fills the invoice dialog.
- **Functions:** `getPayableDetails`
- **Route:** GET `/getPayableDetails`
- **Imports:** `models/debitModel.js`, `models/paymentModel.js`
- **Used by:** `routes/payableRoutes.js`

### `controllers/payablesController/getPayablesAnalytics.js`
- **What it does:** Returns register rows plus the list of months for the chosen periods.
- **Why it exists:** Fills the Payable Register and KPI cards.
- **Functions:** `getPayablesAnalytics`
- **Route:** GET `/getPayablesAnalytics`
- **Imports:** `models/debitModel.js`, `models/payableModel.js`, `models/paymentModel.js`
- **Used by:** `routes/payableRoutes.js`

### `controllers/payablesController/searchPayable.js`
- **What it does:** Searches invoices by invoice number, GRN or supplier. Returns raw invoices (no paid / outstanding). **Not used by the UI yet.**
- **Why it exists:** Available for a future server-side search.
- **Functions:** `getSearchPayable`
- **Route:** GET `/getSearchPayable`
- **Imports:** `models/payableModel.js`
- **Used by:** `routes/payableRoutes.js`

### `controllers/payablesController/updatePayable.js`
- **What it does:** Edits an invoice (remark required).
- **Why it exists:** Backs Edit Payable.
- **Functions:** `updatePayable`
- **Route:** PUT `/updatePayable/:id`
- **Imports:** `models/payableModel.js`
- **Used by:** `routes/payableRoutes.js`

## Payment and advance controllers

### `controllers/paymentController/createSinglePayment.js`
- **What it does:** Creates a payment. With advance allocations it pays from advance only and is Approved at once (method ADVANCE); otherwise credit note only and Pending.
- **Why it exists:** Backs Pay with Advance and Add Payment.
- **Functions:** `getCreditStatus`, `createSinglePayment`
- **Route:** POST `/createSinglePayment`
- **Imports:** `models/creditModel.js`, `models/paymentModel.js`, `models/supplierAdvanceModel.js`, `utils/advanceSettlement.js`, `utils/invoiceFinancials.js`
- **Used by:** `routes/paymentRoutes.js`

### `controllers/paymentController/createSupplierAdvance.js`
- **What it does:** Records an advance paid to a supplier.
- **Why it exists:** Backs Make Advance.
- **Functions:** `createSupplierAdvance`
- **Route:** POST `/createSupplierAdvance`
- **Imports:** `models/paymentModel.js`, `models/supplierAdvanceModel.js`
- **Used by:** `routes/paymentRoutes.js`

### `controllers/paymentController/deletePayment.js`
- **What it does:** Deletes a payment that is not approved and gives back reserved advance.
- **Why it exists:** Backs Delete Payment.
- **Functions:** `deletePayment`
- **Route:** DELETE `/deletePayment/:paymentId`
- **Imports:** `models/creditModel.js`, `models/paymentModel.js`, `utils/advanceSettlement.js`
- **Used by:** `routes/paymentRoutes.js`

### `controllers/paymentController/getPayments.js`
- **What it does:** Lists payments for chosen periods.
- **Why it exists:** Payment listing.
- **Functions:** `getPayments`
- **Route:** GET `/getPayments`
- **Imports:** `models/paymentModel.js`
- **Used by:** `routes/paymentRoutes.js`

### `controllers/paymentController/getPendingPayments.js`
- **What it does:** Lists payments waiting for approval.
- **Why it exists:** Approval listing.
- **Functions:** `getPendingPayments`
- **Route:** GET `/getPendingPayments`
- **Imports:** `models/paymentModel.js`
- **Used by:** `routes/paymentRoutes.js`

### `controllers/paymentController/getSupplierAdvanceBalance.js`
- **What it does:** Returns how much advance a supplier can still use.
- **Why it exists:** Used by the payment forms.
- **Functions:** `getSupplierAdvanceBalance`
- **Route:** GET `/getSupplierAdvanceBalance`
- **Imports:** `models/supplierAdvanceModel.js`, `utils/advanceSettlement.js`
- **Used by:** `routes/paymentRoutes.js`

### `controllers/paymentController/getSupplierAdvanceDetails.js`
- **What it does:** Returns one advance with its history.
- **Why it exists:** Fills the advance detail dialog.
- **Functions:** `getSupplierAdvanceDetails`
- **Route:** GET `/getSupplierAdvanceDetails/:id`
- **Imports:** `models/supplierAdvanceModel.js`
- **Used by:** `routes/paymentRoutes.js`

### `controllers/paymentController/getSupplierAdvances.js`
- **What it does:** Lists supplier advances.
- **Why it exists:** Fills the Advance register.
- **Functions:** `getSupplierAdvances`
- **Route:** GET `/getSupplierAdvances`
- **Imports:** `models/supplierAdvanceModel.js`
- **Used by:** `routes/paymentRoutes.js`

### `controllers/paymentController/searchPayment.js`
- **What it does:** Searches payments.
- **Why it exists:** Payment search.
- **Functions:** `getSearchPayment`
- **Route:** GET `/searchPayment`
- **Imports:** `models/paymentModel.js`
- **Used by:** `routes/paymentRoutes.js`

### `controllers/paymentController/updatePayment.js`
- **What it does:** Edits a payment that is not approved yet.
- **Why it exists:** Backs Edit Payment.
- **Functions:** `getCreditStatus`, `updatePayment`
- **Route:** PUT `/updatePayment/:paymentId`
- **Imports:** `models/creditModel.js`, `models/paymentModel.js`, `utils/advanceSettlement.js`, `utils/invoiceFinancials.js`
- **Used by:** `routes/paymentRoutes.js`

### `controllers/paymentController/updatePaymentStatus.js`
- **What it does:** Approves or rejects a pending payment (Super User role).
- **Why it exists:** Called from the Credit Note screen when an allocation request is approved or rejected.
- **Functions:** `updatePaymentStatus`
- **Route:** PATCH `/updatePaymentStatus/:paymentId`
- **Imports:** `models/creditModel.js`, `models/paymentModel.js`, `models/supplierAdvanceModel.js`, `utils/advanceSettlement.js`
- **Used by:** `routes/paymentRoutes.js`

### `controllers/paymentController/updateSupplierAdvanceStatus.js`
- **What it does:** Approves or rejects a supplier advance.
- **Why it exists:** Backs advance approval.
- **Functions:** `updateSupplierAdvanceStatus`
- **Route:** PATCH `/updateSupplierAdvanceStatus/:id`
- **Imports:** `models/paymentModel.js`, `models/supplierAdvanceModel.js`
- **Used by:** `routes/paymentRoutes.js`

## Debit controllers

### `controllers/debitController/createDebit.js`
- **What it does:** Creates a debit note within the allowed amount.
- **Why it exists:** Backs Add Debit.
- **Functions:** `createDebit`
- **Route:** POST `/createDebit`
- **Imports:** `models/debitModel.js`, `utils/invoiceFinancials.js`
- **Used by:** `routes/debitRoutes.js`

### `controllers/debitController/deleteDebit.js`
- **What it does:** Deletes a debit note (Super User).
- **Why it exists:** Backs Delete Debit.
- **Functions:** `deleteDebit`
- **Route:** DELETE `/deleteDebit/:debitId`
- **Imports:** `models/debitModel.js`
- **Used by:** `routes/debitRoutes.js`

### `controllers/debitController/updateDebit.js`
- **What it does:** Edits a debit note (`editDebit`).
- **Why it exists:** Backs Edit Debit.
- **Functions:** `editDebit`
- **Route:** PUT `/editDebit/:id`
- **Imports:** `models/debitModel.js`, `utils/invoiceFinancials.js`
- **Used by:** `routes/debitRoutes.js`

## Credit controllers

### `controllers/creditController/createCredit.js`
- **What it does:** Creates a credit note.
- **Why it exists:** Backs Create Credit.
- **Functions:** `createCredit`
- **Route:** POST `/createCredit`
- **Imports:** `models/creditModel.js`
- **Used by:** `routes/creditRoutes.js`

### `controllers/creditController/deleteCredit.js`
- **What it does:** Deletes a credit note.
- **Why it exists:** Backs Delete Credit.
- **Functions:** `deleteCredit`
- **Route:** DELETE `/deleteCredit/:creditNoteNumber`
- **Imports:** `models/creditModel.js`
- **Used by:** `routes/creditRoutes.js`

### `controllers/creditController/getCreditDetails.js`
- **What it does:** Returns one credit note with its allocations.
- **Why it exists:** Fills the credit dialog.
- **Functions:** `getCreditDetails`
- **Route:** GET `/getCreditDetails/:creditNoteNumber`
- **Imports:** `models/creditModel.js`
- **Used by:** `routes/creditRoutes.js`

### `controllers/creditController/getCreditNotes.js`
- **What it does:** Lists credit notes.
- **Why it exists:** Fills the Credit page.
- **Functions:** `getCreditNotes`
- **Route:** GET `/getCreditNotes`
- **Imports:** `models/creditModel.js`
- **Used by:** `routes/creditRoutes.js`

### `controllers/creditController/getPendingAndPartialCredits.js`
- **What it does:** Lists credit notes that still have balance.
- **Why it exists:** Credit note choices in the payment form.
- **Functions:** `getPendingAndPartialCredits`
- **Route:** GET `/getPendingAndPartialCredits`
- **Imports:** `models/creditModel.js`
- **Used by:** `routes/creditRoutes.js`

### `controllers/creditController/updateCredit.js`
- **What it does:** Edits a credit note.
- **Why it exists:** Backs Edit Credit.
- **Functions:** `updateCredit`
- **Route:** PUT `/updateCredit/:creditNoteNumber`
- **Imports:** `models/creditModel.js`
- **Used by:** `routes/creditRoutes.js`

## Receivable controllers

### `controllers/receivablesController/createReceivable.js`
- **What it does:** Creates one invoice or a bulk list; checks Sub Total + GST = Total (within ₹1).
- **Why it exists:** Backs Add Receivable and bulk upload.
- **Functions:** `parseFlexibleDate`, `text`, `createReceivable`
- **Route:** POST `/createReceivable`
- **Imports:** `models/receivableModel.js`, `utils/receivableFinancials.js`
- **Used by:** `routes/receivableRoutes.js`

### `controllers/receivablesController/deleteReceivable.js`
- **What it does:** Deletes an invoice with all its collections.
- **Why it exists:** Backs Delete Receivable.
- **Functions:** `deleteReceivable`
- **Route:** DELETE `/deleteReceivable/:id`
- **Imports:** `models/collectionModel.js`, `models/receivableModel.js`
- **Used by:** `routes/receivableRoutes.js`

### `controllers/receivablesController/getReceivableDetails.js`
- **What it does:** Returns collections of one invoice.
- **Why it exists:** Fills the invoice dialog.
- **Functions:** `getReceivableDetails`
- **Route:** GET `/getReceivableDetails`
- **Imports:** `models/collectionModel.js`
- **Used by:** `routes/receivableRoutes.js`

### `controllers/receivablesController/getReceivablesAnalytics.js`
- **What it does:** Returns register rows plus months for chosen periods.
- **Why it exists:** Fills the Receivable Register and KPI cards.
- **Functions:** `getReceivablesAnalytics`
- **Route:** GET `/getReceivablesAnalytics`
- **Imports:** `models/receivableModel.js`, `utils/receivableRows.js`
- **Used by:** `routes/receivableRoutes.js`

### `controllers/receivablesController/searchReceivable.js`
- **What it does:** Searches invoices by invoice number, GRN or customer; rows include collected / outstanding.
- **Why it exists:** Server-side search of the Receivable Register.
- **Functions:** `getSearchReceivable`
- **Route:** GET `/getSearchReceivable`
- **Imports:** `models/receivableModel.js`, `utils/receivableRows.js`
- **Used by:** `routes/receivableRoutes.js`

### `controllers/receivablesController/updateReceivable.js`
- **What it does:** Edits an invoice; the total cannot drop below collections already recorded.
- **Why it exists:** Backs Edit Receivable.
- **Functions:** `updateReceivable`
- **Route:** PUT `/updateReceivable/:id`
- **Imports:** `models/receivableModel.js`, `utils/receivableFinancials.js`
- **Used by:** `routes/receivableRoutes.js`

## Collection controllers

### `controllers/collectionController/createCollection.js`
- **What it does:** Saves a collection as Pending after checking received + TDS fits the open amount.
- **Why it exists:** Backs Add Collection.
- **Functions:** `createCollection`
- **Route:** POST `/createCollection`
- **Imports:** `models/collectionModel.js`, `utils/receivableFinancials.js`
- **Used by:** `routes/collectionRoutes.js`

### `controllers/collectionController/deleteCollection.js`
- **What it does:** Deletes a non-approved collection (Super User).
- **Why it exists:** Backs Delete Collection.
- **Functions:** `deleteCollection`
- **Route:** DELETE `/deleteCollection/:collectionId`
- **Imports:** `models/collectionModel.js`
- **Used by:** `routes/collectionRoutes.js`

### `controllers/collectionController/getCollections.js`
- **What it does:** Lists collections by status.
- **Why it exists:** Fills the Approve Receivable page.
- **Functions:** `getCollections`
- **Route:** GET `/getCollections`
- **Imports:** `models/collectionModel.js`
- **Used by:** `routes/collectionRoutes.js`

### `controllers/collectionController/updateCollection.js`
- **What it does:** Edits a non-approved collection and sends it back to Pending.
- **Why it exists:** Backs Edit Collection.
- **Functions:** `updateCollection`
- **Route:** PUT `/updateCollection/:collectionId`
- **Imports:** `models/collectionModel.js`, `utils/receivableFinancials.js`
- **Used by:** `routes/collectionRoutes.js`

### `controllers/collectionController/updateCollectionStatus.js`
- **What it does:** Approves or rejects a Pending collection (Super User).
- **Why it exists:** Backs approve / reject.
- **Functions:** `updateCollectionStatus`
- **Route:** PATCH `/updateCollectionStatus/:collectionId`
- **Imports:** `models/collectionModel.js`
- **Used by:** `routes/collectionRoutes.js`

## Route files

Each file in `routes/` only connects URL paths to controllers (see the table above): `routes/collectionRoutes.js`, `routes/creditRoutes.js`, `routes/debitRoutes.js`, `routes/payableRoutes.js`, `routes/paymentRoutes.js`, `routes/receivableRoutes.js`.
