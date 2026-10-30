# Finance module update — 30 October 2026

## Included changes

- Added `pages/CollectionPage.jsx`; it replaces the old Approved Receivables page content and uses the Collection heading.
- Kept `pages/ApproveReceivablesPage.jsx` as a compatibility re-export so existing imports do not break immediately.
- Added `pages/PaymentsPage.jsx` with Pending / Approved / Rejected tabs, search, payment totals, payment details, and approval/rejection actions.
- Collection status can be changed only by a Super User.
- Credit Note create/edit/delete and allocation request approval/rejection are available only to Super User and Admin. The UI hides those actions for other roles, and backend routes/controllers enforce the same rule.
- Preserved the authenticated shared API client and existing payment/collection models.

## Host application integration still required

The supplied ZIP contained only the Finance module directory. It did not contain the host `App.jsx`, `AppLayout.jsx`, root role constants, or backend `server.js`. Therefore the module ZIP cannot itself rename the host sidebar item or register a new URL. Follow the route/sidebar instructions in `README.md` after replacing the Finance module folder.

## Validation performed

- All backend JavaScript files passed `node --check`.
- All frontend `.js` / `.jsx` files passed TypeScript JSX transpile syntax validation.
- No full application build or live API integration test was possible because the host app and its package manifests/configuration were not included in the supplied archives.
