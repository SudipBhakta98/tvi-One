# How the Files Work Together

## 1. The layers

Every screen follows the same path. A request goes down the left column; the answer comes back up.

```
App.jsx                         picks the page (and its provider) from the URL
  └─ page          (pages/)             layout, KPI cards, filters, tables
       └─ dialog / card  (components/)  forms and detail screens
            └─ api.js                   one axios call per backend route
                 └─ routes/*.js         URL -> controller
                      └─ controllers/   validate, calculate, save
                           └─ utils/ + models/   shared rules + MongoDB collections
```

Support files used across the layers: `contexts/` (shared data), `hooks/useMultiFilter.js`, `utils/financeFormat.js`, `components/common/`, the app-wide toast.

## 2. Providers and shared state

| Provider | Used on | Holds | Read by |
|---|---|---|---|
| `PayablesProvider` | `/finance/payables` | `analyticsData` (register rows), `detailsData` (payments and debit notes of the open invoice) | `PayablesPage`, `PayablesInvoiceDialog` |
| `ReceivablesProvider` | `/finance/receivables` | `analyticsData`, `searchResults`, `detailsData` (collections of the open invoice) | `ReceivablesPage`, `ReceivablesInvoiceDialog` |

Pages without a provider (`AdvancePaymentPage`, `CreditPage`, `ApproveReceivablesPage`) keep their data in their own `useState`.

## 3. Flow: open the Payable Register

1. `App.jsx` renders `PayablesPage` inside `PayablesProvider`.
2. `PayablesPage` calls `loadAnalytics()` → `payablesApi.getAnalytics()` → `GET /getPayablesAnalytics`.
3. `getPayablesAnalytics` reads `Payable`, approved `Payment`s and `Debit`s, and returns one row per invoice (paid amount, outstanding, status, due days).
4. `PayablesPage` stores the rows with `storeAnalytics`, then `normalizeInvoice` shapes each row.
5. Search, Supplier / Month / Status filters (`useMultiFilter`) narrow the rows; `computedMetrics` builds the KPI cards and the supplier groups.
6. Clicking a row sets `activeInvoice` and opens `PayablesInvoiceDialog`, which calls `payablesApi.getDetails()` and keeps the answer with `storeDetails`.

## 4. Flow: create payable invoices

- **One invoice:** `AddPayableDialog` → `payablesApi.create(form)` → `createPayable`. On success it shows `toast.success` and the page reloads the register.
- **Bulk:** `AddPayableDialog` shows `BulkUploadWorkspace` → `parseBulkPayableFile` (uses `readBulkSheet`) previews the rows → `payablesApi.create({ invoices })` → `createPayable` saves the valid rows and returns the failed ones with reasons.

## 5. Flow: pay an invoice (one type per payment)

`PayablesInvoiceDialog` has two buttons that open `AddPaymentDialog` in different modes:

| | Pay with Advance | Add Payment |
|---|---|---|
| Money source | supplier advance(s) only | credit note only |
| Form shows | advance split (`AdvanceUsagePanel`) and date | method, credit note, transaction number, date |
| Saved as | `paymentMethod: "ADVANCE"`, `creditNoteNumber: null`, `transactionNumber` of the advance | the method the user chose |
| Status | **Approved** immediately; the advance is settled in the same request | **Pending** until approved |

Both call `paymentApi.createSinglePayment` → `createSinglePayment`, which checks the amount against `getInvoiceFinancials` and uses `reserveAdvances` / `settleAdvances` (`utils/advanceSettlement.js`) for advances.

A Pending payment can be edited or deleted from `PaymentCard` (`updatePayment`, `deletePayment`). Credit-note payments are approved or rejected from the Credit Note screen: `CreditNoteDialog` → `paymentApi.updatePaymentStatus` → `updatePaymentStatus`.

## 6. Flow: receivables (upload → collect → approve)

1. **Upload:** `AddReceivableDialog` (single) or `BulkUploadWorkspace` with `parseBulkReceivableFile` (bulk) → `receivablesApi.create` → `createReceivable`. Rule: Sub Total + GST must equal Total (within ₹1); Invoice Number + GRN must be unique.
2. **Collect:** open an invoice in `ReceivablesPage` → `ReceivablesInvoiceDialog` → **Add Collection** (`AddCollectionDialog`) → `collectionApi.createCollection` → `createCollection`. It is saved as **Pending** and rejected if Received + TDS is more than what is still open.
3. **Approve:** `ApproveReceivablesPage` → `collectionApi.getCollections("Pending")` → `getCollections`. **Approve** / **Reject** call `collectionApi.updateCollectionStatus` → `updateCollectionStatus` (Super User role only).
4. **Result:** only Approved collections change the register: `getReceivablesAnalytics` / `searchReceivable` use `buildReceivableRows` (`utils/receivableRows.js`) to add collected amount, TDS, outstanding and status.
5. A Pending or Rejected collection can be edited (it returns to Pending) or deleted from `CollectionCard`; an Approved one is locked.

## 7. Formulas

| Payables (`getPayablesAnalytics`, `getInvoiceFinancials`) | |
|---|---|
| Gross payable | Total − TDS |
| Actual payable | Gross payable − debit notes |
| Outstanding | Actual payable − approved payments |
| Max next payment | Outstanding − pending payments |
| Status | `paid` when paid ≥ actual payable, `partial` when paid > 0, else `unpaid` |
| Due days | `PAYMENT_TERM_DAYS` (45) − days since invoice date; negative = overdue |

| Receivables (`receivableRows`, `receivableFinancials`) | |
|---|---|
| Settled by one collection | Received Amount + TDS Amount |
| Outstanding | Total − approved (Received + TDS) |
| Max next collection | Outstanding − pending (Received + TDS) |
| Status | `collected` when settled ≥ total, `partial` when settled > 0, else `uncollected` |
| KPI Total Collection | approved Received Amount only |
| KPI Total TDS Deduction | approved TDS Amount only |
| Due days | `PAYMENT_TERM_DAYS` (45) − days since invoice date |

## 8. Access rules

| Where | Rule |
|---|---|
| `financeRoles.js` | `RECEIVABLE_APPROVER_ROLES` = Admin, Super User, Finance Manager |
| `AppLayout.jsx` | `filterChildrenByRole` hides "Approve Receivable" from other roles |
| `App.jsx` | the approve route is only created for approver roles; others are redirected to `/` |
| `server.js` | `authorizeModule` lets only Finance Manager / Finance User (plus Admin / Super User) into `/api/finance/*`; `deptWriteGuard(DEPARTMENTS.FINANCE)` applies the rule written in that file: managers edit and delete, users read and create |
| `mapFinanceUser.js` | turns Admin / Super User / Finance Manager into the role "Super User" |
| Controllers | `updateCollectionStatus`, `deleteCollection`, `updatePaymentStatus`, `deleteDebit` accept only "Super User" |

## 9. Add a new finance screen

1. Add the backend model, controller(s), route file and mount it in `server.js`.
2. Add the path to `ENDPOINTS` and one object in `api.js`.
3. Create the page in `pages/` and its dialogs in `components/<area>Components/`.
4. Reuse `formatCurrency`, `ExcelFilterDropdown`, `useMultiFilter`, `BulkUploadWorkspace` instead of copying code.
5. Use `useToast()` for messages.
6. If the page shares data between components, add a context in `contexts/` and wrap the page with `ModuleRoute` in `App.jsx`.
7. Add the route in `App.jsx` and the menu item in `AppLayout.jsx`.
8. Add the files to `FILE_GUIDE.md`.
