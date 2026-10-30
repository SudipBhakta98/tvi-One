# Finance Module

Financial management for Technovision Industries: **Payables** (supplier invoices, payments, advances, credit and debit notes) and **Receivables** (customer invoices, collections with TDS, approval).

| Document | Read it to learn |
|---|---|
| `README.md` (this file) | Folder structure, how the module plugs into the app, setup checklist |
| `FILE_GUIDE.md` | Every file: what it does, why it exists, its functions, what it imports and what uses it |
| `HOW_FILES_WORK_TOGETHER.md` | Step-by-step flows (which file calls which), formulas, access rules |
| `BulkPayableUpload.md`, `BulkReceivableUpload.md` | Excel / CSV columns and rules for bulk upload |

## Folder structure

### Frontend

```
src/modules/finance/
├── components
│   ├── advanceComponents
│   │   ├── AdvanceDetailDialog.jsx
│   │   ├── AdvanceUsagePanel.jsx
│   │   └── MakeAdvanceDialog.jsx
│   ├── collectionComponents
│   │   ├── AddCollectionDialog.jsx
│   │   └── CollectionCard.jsx
│   ├── common
│   │   ├── BulkUploadWorkspace.jsx
│   │   └── ExcelFilterDropdown.jsx
│   ├── creditComponets
│   │   ├── CreateCreditDialog.jsx
│   │   └── CreditNoteDialog.jsx
│   ├── debitComponents
│   │   ├── AddDebitDialog.jsx
│   │   └── DebitCard.jsx
│   ├── payableComponents
│   │   ├── AddPayableDialog.jsx
│   │   ├── EditPayableDialog.jsx
│   │   └── PayablesInvoiceDialog.jsx
│   ├── paymentComponets
│   │   ├── AddPaymentDialog.jsx
│   │   └── PaymentCard.jsx
│   └── receivableComponents
│       ├── AddReceivableDialog.jsx
│       ├── EditReceivableDialog.jsx
│       ├── ReceivableBadges.jsx
│       └── ReceivablesInvoiceDialog.jsx
├── constants
│   └── financeRoles.js
├── contexts
│   ├── PayableContext.jsx
│   └── ReceivableContext.jsx
├── hooks
│   └── useMultiFilter.js
├── pages
│   ├── AdvancePaymentPage.jsx
│   ├── ApproveReceivablesPage.jsx
│   ├── CreditPage.jsx
│   ├── PayablesPage.jsx
│   └── ReceivablesPage.jsx
├── utils
│   ├── bulkPayableParser.js
│   ├── bulkReceivableParser.js
│   ├── bulkSheetReader.js
│   └── financeFormat.js
└── api.js
```

The `Documentation/` folder (not shown above) holds these guides.

### Backend

```
backend/modules/finance/
├── controllers
│   ├── collectionController
│   │   ├── createCollection.js
│   │   ├── deleteCollection.js
│   │   ├── getCollections.js
│   │   ├── updateCollection.js
│   │   └── updateCollectionStatus.js
│   ├── creditController
│   │   ├── createCredit.js
│   │   ├── deleteCredit.js
│   │   ├── getCreditDetails.js
│   │   ├── getCreditNotes.js
│   │   ├── getPendingAndPartialCredits.js
│   │   └── updateCredit.js
│   ├── debitController
│   │   ├── createDebit.js
│   │   ├── deleteDebit.js
│   │   └── updateDebit.js
│   ├── payablesController
│   │   ├── createPayable.js
│   │   ├── deletePayable.js
│   │   ├── getPayableDetails.js
│   │   ├── getPayablesAnalytics.js
│   │   ├── searchPayable.js
│   │   └── updatePayable.js
│   ├── paymentController
│   │   ├── createSinglePayment.js
│   │   ├── createSupplierAdvance.js
│   │   ├── deletePayment.js
│   │   ├── getPayments.js
│   │   ├── getPendingPayments.js
│   │   ├── getSupplierAdvanceBalance.js
│   │   ├── getSupplierAdvanceDetails.js
│   │   ├── getSupplierAdvances.js
│   │   ├── searchPayment.js
│   │   ├── updatePayment.js
│   │   ├── updatePaymentStatus.js
│   │   └── updateSupplierAdvanceStatus.js
│   └── receivablesController
│       ├── createReceivable.js
│       ├── deleteReceivable.js
│       ├── getReceivableDetails.js
│       ├── getReceivablesAnalytics.js
│       ├── searchReceivable.js
│       └── updateReceivable.js
├── middleware
│   └── mapFinanceUser.js
├── models
│   ├── collectionModel.js
│   ├── creditModel.js
│   ├── debitModel.js
│   ├── payableModel.js
│   ├── paymentModel.js
│   ├── receivableModel.js
│   └── supplierAdvanceModel.js
├── routes
│   ├── collectionRoutes.js
│   ├── creditRoutes.js
│   ├── debitRoutes.js
│   ├── payableRoutes.js
│   ├── paymentRoutes.js
│   └── receivableRoutes.js
└── utils
    ├── advanceSettlement.js
    ├── invoiceFinancials.js
    ├── receivableFinancials.js
    └── receivableRows.js
```

## How the module plugs into the app

The finance module has **no layout file of its own**. It follows the same pattern as the other modules: `App.jsx` wraps a page in its provider with `ModuleRoute`.

| Route (in `App.jsx`) | Page | Provider |
|---|---|---|
| `/finance/payables` | `PayablesPage` | `PayablesProvider` |
| `/finance/receivables` | `ReceivablesPage` | `ReceivablesProvider` |
| `/finance/receivables/approve` | `ApproveReceivablesPage` (approver roles only) | none |
| `/finance/advances` | `AdvancePaymentPage` | none |
| `/finance/credits` | `CreditPage` | none |

- **Sidebar:** `AppLayout.jsx` has Finance → Payables / Receivables / Advance Payments / Credits. "Approve Receivable" is hidden unless the role is in `RECEIVABLE_APPROVER_ROLES`.
- **Messages:** all success / error messages use the app-wide toast: `const toast = useToast()` from `core/notifications/ToastContext`, then `toast.success(...)`, `toast.error(...)`, `toast.warning(...)`.
- **API:** every request goes through `api.js`, which uses `services/api` and `services/endpoints`.

## Setup checklist

1. **Frontend:** replace `src/modules/finance/`, `src/App.jsx` and `src/layout/AppLayout.jsx` with the updated versions.
2. **Endpoints:** `src/services/endpoints.js` must contain `FINANCE.PAYABLE`, `PAYMENT`, `DEBIT`, `CREDIT`, `RECEIVABLE` (`/finance/receivable`) and `COLLECTION` (`/finance/collection`). The updated file already does.
3. **Backend:** replace `backend/modules/finance/` with the updated folder.
4. **Mount the routes** in `backend/server.js`. All six finance routes share one access chain:

```js
const financeAccess = [authorizeModule(ROLES.FINANCE_MANAGER, ROLES.FINANCE_USER), deptWriteGuard(DEPARTMENTS.FINANCE), mapFinanceUser];
app.use("/api/finance/payable", ...financeAccess, payableRoutes);
app.use("/api/finance/payment", ...financeAccess, paymentRoutes);
app.use("/api/finance/debit", ...financeAccess, debitRoutes);
app.use("/api/finance/credit", ...financeAccess, creditRoutes);
app.use("/api/finance/receivable", ...financeAccess, receivableRoutes);
app.use("/api/finance/collection", ...financeAccess, collectionRoutes);
```
5. **Packages:** `xlsx` (bulk upload) and `lucide-react` (icons) are used by the frontend.
6. The mount paths in step 4 must match the `ENDPOINTS` values in step 2 (with the `/api` prefix added by the frontend `services/api`).

## Conventions used in the code

- One page per route; dialogs live in `components/<area>Components/`.
- Anything used by more than one screen lives in `components/common`, `utils`, `hooks` or `contexts`.
- Money is shown with `formatCurrency`; dates with `formatDateDMY` (any date value) or `formatDateString` (dates already formatted by the backend).
- Amount inputs are cleaned with `decimalOnly`.
- Constants such as `PAYMENT_TERM_DAYS` have names; there are no unexplained numbers in the calculations.

## Updated Collection and Payments workflow

- `pages/CollectionPage.jsx` is the renamed collection review page. `ApproveReceivablesPage.jsx` remains as a compatibility re-export for an existing route import.
- `pages/PaymentsPage.jsx` is the supplier payment review page. It uses the existing payment API and `PaymentCard` component, with Pending / Approved / Rejected tabs and the same Super User-only approval/rejection action pattern as Collection.
- Collection status changes are Super User only. Credit Note create, edit, delete, and allocation-request approval/rejection are Super User or Admin only. Backend checks use `originalRole` preserved by `mapFinanceUser`, so the legacy Finance Manager elevation cannot bypass these rules.

### Host application route and sidebar updates

The uploaded frontend ZIP contains only `src/modules/finance/`; it does not contain the host application's `App.jsx` or `AppLayout.jsx`. Add/update these host-app entries when copying the module:

```jsx
import CollectionPage from "./modules/finance/pages/CollectionPage.jsx";
import PaymentsPage from "./modules/finance/pages/PaymentsPage.jsx";

// Register under the existing finance route/provider conventions:
<Route path="/finance/collection" element={<CollectionPage />} />
<Route path="/finance/payments" element={<PaymentsPage />} />
```

In the Finance sidebar, replace the old **Approve Receivable** label/link with **Collection** (`/finance/collection`) and add **Payments** under Payables (`/finance/payments`). Update any existing old `/finance/receivables/approve` route to redirect to `/finance/collection` if bookmarks must continue working. Use `RECEIVABLE_APPROVER_ROLES` for any Collection menu visibility check; it now contains only `SUPER_USER`.
