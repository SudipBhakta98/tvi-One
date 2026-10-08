# TVI One + Finance — Integration Notes

This document explains what changed when the standalone finance application
was integrated into TVI One, and how the new role model works.

## 1. Finance module — integrated as-is

- `backend/modules/finance/{controllers,models,routes,utils}` are copied
  **unmodified** from the finance app's `server/` folder. No business logic,
  validation, calculation, or response shape was changed.
- The only two things that did NOT come along:
  - `controllers/userController/createUser.js` and `models/userModel.js` —
    the finance app's own mini user directory. TVI One already has a single,
    central user directory (`backend/modules/auth` + `backend/modules/admin`),
    so a second one would fragment login/roles and cost extra DB collections
    for no benefit. Every finance user is just a TVI One user with a
    `FINANCE_MANAGER` / `FINANCE_USER` role.
  - `server/server.js`, `server/config/dbConfig.js`, `server/.env` — replaced
    by TVI One's own `server.js` / `dbConfig.js` (see §3).
- New file `backend/modules/finance/middleware/mapFinanceUser.js` is the only
  piece of *new* code in the finance module. The finance controllers were
  written against a 2-tier identity (`role: "User" | "Super User"`); this
  adapter re-shapes `req.user` into that exact shape **after** TVI One's own
  RBAC has already authorized the request, so the untouched
  `req.user.role !== "Super User"` checks inside `createCredit`,
  `updateCredit`, `deleteCredit`, `deleteDebit`, `deletePayment` and
  `updatePaymentStatus` keep working:

  | TVI One role      | Finance sees it as |
  |--------------------|--------------------|
  | ADMIN              | "Super User"       |
  | SUPER_USER          | "Super User"       |
  | FINANCE_MANAGER    | "Super User"       |
  | FINANCE_USER       | "User"              |

- Routes are mounted at `/api/finance/payable`, `/api/finance/payment`,
  `/api/finance/debit`, `/api/finance/credit` (see `server.js`). Every
  sub-path inside those route files (`/getPayablesAnalytics`,
  `/createSinglePayment`, etc.) is exactly what the original app used.
- Frontend: `frontend/src/modules/finance/{pages,components,contexts}` are
  copied **unmodified**. The only frontend file that changed is `api.js`:
  the original created its own axios instance pointed at a hardcoded IP
  (`http://100.64.13.19:5000/api/`) with no auth handling. The integrated
  version reuses TVI One's shared, authenticated axios instance
  (`frontend/src/services/api.js`) and points at `/finance/*`. Every
  exported name (`payablesApi`, `paymentApi`, `debitApi`, `creditApi`, and
  every method) is identical, so zero page/component files needed to change.
- `FinanceLayout.jsx` reuses the finance app's own `NotificationProvider`
  and `PayablesProvider` (unmodified) and mounts them only under
  `/finance/*`, next to a small tab switcher (Payables / Credits) that
  replaces the finance app's original full-screen `Layout.jsx` — TVI One's
  `AppLayout` already provides the sidebar/header.

## 2. Roles — every department gets a Manager and a User

`backend/constants/roles.js` (mirrored in `frontend/src/constants/roles.js`):

- `ADMIN` — full access to everything, including user/session/audit
  administration.
- `SUPER_USER` — full access to every operational module, **excluded** from
  `/api/admin/*` (administration/user management is ADMIN-only).
- Six departments, each with `<DEPT>_MANAGER` / `<DEPT>_USER`:
  `NPD` (RFQ + prototype components), `SCM` (Purchase), `PRODUCTION`,
  `WAREHOUSE`, `DISPATCH`, `FINANCE`.

Rule: **only a department's Manager (or ADMIN/SUPER_USER) can edit or
delete that department's records.** A department's User role can view and
create, but not edit/delete. This is enforced centrally and non-invasively:

- `authorizeModule(...roles)` — module-level visibility; always lets
  ADMIN/SUPER_USER through, otherwise the listed roles.
- `deptWriteGuard(dept)` — write-level check: `<DEPT>_MANAGER` (or
  ADMIN/SUPER_USER) may do anything; `<DEPT>_USER` is limited to
  read + create (`GET`, `POST`); `PUT`/`PATCH`/`DELETE` are rejected.
- `anyManagerWriteGuard()` — for the cross-department `Projects` register:
  any `*_MANAGER` (or ADMIN/SUPER_USER) can write, everyone else reads.

Both middlewares are applied once per module mount in `server.js` — no
individual controller had to be rewritten to enforce this. Two pre-existing
internal checks that hardcoded `"ADMIN"` only (`deleteProject`, RFQ stage
transitions in `rfqWorkflow.js`) were updated to also accept `SUPER_USER`,
consistent with "super user can do everything except administration."

The finance module keeps its own extra internal gate for a few sensitive
actions (see §1's table) — that's the finance app's original business logic,
untouched, just now driven by the mapped role.

## 3. Cost optimization

- **One database, one connection pool.** Finance was **not** given its own
  MongoDB database/deployment — its models attach to the same shared
  `mongoose` connection TVI One already opens in `dbConfig.js`. That's one
  cluster to pay for instead of two, and `maxPoolSize` is capped (default 8,
  overridable via `MONGO_MAX_POOL_SIZE`) to fit inside small/shared-tier
  Mongo instances (e.g. Atlas M0–M5).
- **One backend process, one frontend build.** Finance is a module inside
  the existing Express app and the existing Vite/React app — not a second
  Node process or a second static site to host.
- `compression` (gzip) added to the Express stack — smaller responses, lower
  egress cost on cheap hosting.
- `helmet`, small JSON body limit (2mb) kept as-is — cheap security with no
  extra infra.
- Frontend stays on the existing lightweight stack (React Context instead
  of a state-management library, Tailwind utility classes, no extra UI kit)
  — smaller JS bundle, cheaper static hosting/CDN egress.
- React Context per module (`frontend/src/contexts/*`, generated from a
  single shared `createResourceContext` factory for the simple CRUD
  modules) — one implementation reused six times instead of six bespoke
  data-fetching implementations, keeping the bundle small.

## 4. What to check before deploying

- `backend/.env`: single `MONGO_URI` for everything (finance included).
- Create your first Finance users via `/admin` (`FINANCE_MANAGER` /
  `FINANCE_USER`) — there is no separate finance login.
- `frontend` env: `VITE_API_URL` should point at `.../api` (finance routes
  are under the same origin, at `/api/finance/...`).

## 7. Enterprise refactor additions

- The control tower now loads a single `/api/dashboard/overview` payload for the dashboard tabs. Each department is backed by MongoDB aggregation queries rather than loading whole collections into Node for KPI calculation.
- Added dashboard endpoints for Purchase, Warehouse, Dispatch and Finance plus a short-lived 10-second server-side cache for read-only dashboard GETs.
- Added `/api/dashboard/reports` with department and date-range filters. The UI exports report datasets to CSV.
- Added global frontend `ToastProvider` + Axios response interceptor. Mutation success messages and API validation/server failures are surfaced centrally.
- Added `/api/auth/change-password`. Password changes keep the current session alive and revoke other sessions.
- Admin deactivation now revokes all active sessions for the deactivated account; role changes also revoke active sessions.
- Navigation is now a compact right-aligned dropdown system. Create actions are launched from navigation query actions instead of duplicated page-level create buttons.
- RFQ stage transitions have dedicated controller modules and stage-specific endpoints while retaining the legacy `/transition` endpoint for compatibility.
- Module resource contexts now use short-lived in-memory caching and update their local state from mutation responses instead of automatically issuing a second GET after every create/update/delete.
- Added compound indexes for common dashboard/report date and status queries.
