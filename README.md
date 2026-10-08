# TVI One — Manufacturing ERP

TVI One is a modular manufacturing ERP foundation for the complete **RFQ → NPD → Pilot → SCM → Purchase → Production → Warehouse → Dispatch** lifecycle. The design intentionally keeps future **Attendance, Finance and Customer** departments as independent modules.

> This repository is a runnable application foundation. MongoDB is used as the system of record; the included seed command creates the first administrator.

## 1. Quick start

### Prerequisites

- Node.js 20+ recommended
- npm 10+
- MongoDB 7+ locally or a MongoDB Atlas connection

### Install

```bash
npm i
```

### Configure

Copy `backend/.env.example` to `backend/.env` and set a strong `JWT_SECRET` and your MongoDB URI.

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/tviOne
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=8h
FRONTEND_URL=http://localhost:5173
ADMIN_NAME=TVI One Admin
ADMIN_EMAIL=admin@tvione.local
ADMIN_PASSWORD=ChangeMe123!
```

### Create the first administrator

```bash
npm run seed:admin
```

### Run frontend + backend

```bash
npm run dev
```

Frontend: `http://localhost:5173`  
API: `http://localhost:5000/api/health`

Demo administrator:
- Email: `admin@tvione.local`
- Password: `ChangeMe123!`

**Change the demo password immediately in a real environment.**

---

## 2. Architecture

```text
TVI One
├── frontend
│   └── React + Vite
│       ├── layout
│       ├── pages
│       └── services
│
└── backend
    ├── config
    ├── constants
    ├── middleware
    ├── modules
    │   ├── auth
    │   ├── admin
    │   ├── rfq
    │   ├── project
    │   ├── purchase
    │   ├── production
    │   ├── warehouse
    │   ├── dispatch
    │   └── dashboard
    └── server.js
```

### Department boundaries

| Module | Responsibility |
|---|---|
| Auth | Login, JWT validation, sessions |
| Admin | User lifecycle, roles, audit logs |
| RFQ / NPD | RFQ intake, stage gates, prototype and pilot lifecycle |
| Project | Mass-production handover and delivery schedules |
| Purchase / SCM | Supplier allocation and purchase orders |
| Production | Manufacturing output and QC |
| Warehouse | GRN, receipts and inspection |
| Dispatch | Finished-goods movement |
| Dashboard | Cross-functional KPIs |

Future modules can be added without changing the existing domain folders:

```text
modules/attendance
modules/finance
modules/customer
```

---

## 3. Security

### JWT

1. User posts credentials to `POST /api/auth/login`.
2. Server verifies the bcrypt password hash.
3. Server creates a signed JWT containing:
   - `sub` — user id
   - `role`
   - `tokenId`
4. A session record is stored in MongoDB.
5. The frontend sends the token as:
   `Authorization: Bearer <token>`.
6. `authenticate` verifies the token and loads the active user.
7. `requireRoles` checks the user's department role before protected routes execute.

### Password security

Passwords are never stored in plain text. They are hashed with bcrypt using a work factor of 12.

### RBAC matrix

| Area | ADMIN | NPD | SCM | PRODUCTION | WAREHOUSE | DISPATCH |
|---|---:|---:|---:|---:|---:|---:|
| Admin | ✓ | | | | | |
| RFQ / NPD | ✓ | ✓ | | | | |
| Components | ✓ | ✓ | ✓ | | | |
| Projects | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Purchase | ✓ | | ✓ | | | |
| Production | ✓ | | ✓ | ✓ | | |
| Warehouse | ✓ | | ✓ | | ✓ | |
| Dispatch | ✓ | | ✓ | | | ✓ |
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 4. Business workflow

### Phase A — RFQ and prototyping

1. Customer RFQ received.
2. Technical Review — target within **3 days**.
3. DFM Review.
4. Commercial Review.
5. RFQ Awarded.
6. Prototype build.
7. Prototype/sample submitted.
8. Capex execution and pilot-build component list.
9. Pilot build.
10. Pilot submitted and customer approval.
11. Mass-production handover.

The stage-gate service prevents updates from jumping over incomplete predecessor stages.

### Phase B — Mass production

After customer approval:

1. NPD hands the project to SCM.
2. Project owner defines one or more delivery schedules.
3. Each schedule can carry quantity, BOM/component mapping and per-unit/total quantities.
4. SCM allocates suppliers and creates POs.
5. Production records manufacturing output.
6. QC status controls dispatch availability.
7. Dispatch records finished-goods movement.
8. Warehouse records PO-linked GRN and received quantities.
9. Dashboard aggregates the cross-functional state.

### Prototype purchasing isolation

Prototype/RFQ purchases use `purchase_type = RFQ_NPD` and remain associated with `rfq_item`.

Mass-production purchases use `purchase_type = PRODUCTION` and are associated with a `project`.

This prevents pilot/prototype purchasing from being mixed into mass-production inventory.

---

## 5. API conventions

Successful responses use either:

```json
{
  "success": true,
  "data": {}
}
```

or, in legacy business controllers retained from the original TVI One implementation, a direct array/object with an `error` property on failure.

Authentication failures:

```json
{
  "success": false,
  "message": "Authentication required"
}
```

Authorization failures:

```json
{
  "success": false,
  "message": "You do not have permission for this operation"
}
```

---

# 6. API contracts

## Health

### `GET /api/health`

Response:

```json
{
  "success": true,
  "service": "TVI One ERP API",
  "timestamp": "2026-09-07T08:00:00.000Z"
}
```

---

# Auth module

## `POST /api/auth/login`

Request:

```json
{
  "email": "admin@tvione.local",
  "password": "ChangeMe123!"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "ObjectId",
      "name": "TVI One Admin",
      "email": "admin@tvione.local",
      "role": "ADMIN",
      "department": "ADMIN",
      "isActive": true
    }
  }
}
```

## `GET /api/auth/me`

Bearer token required.

Response:

```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "name": "User",
    "email": "user@company.com",
    "role": "SCM_MANAGER",
    "department": "SCM",
    "isActive": true
  }
}
```

## `POST /api/auth/logout`

Bearer token required.

Response:

```json
{
  "success": true,
  "message": "Logged out"
}
```

---

# Admin module — ADMIN only

## `POST /api/admin/users`

Request:

```json
{
  "name": "Production User",
  "email": "production@company.com",
  "password": "StrongPassword123!",
  "role": "PRODUCTION_USER",
  "department": "PRODUCTION"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "name": "Production User",
    "email": "production@company.com",
    "role": "PRODUCTION_USER",
    "department": "PRODUCTION",
    "isActive": true
  }
}
```

## `GET /api/admin/users`

Response:

```json
{
  "success": true,
  "data": [
    {
      "_id": "ObjectId",
      "name": "User",
      "email": "user@company.com",
      "role": "NPD_MANAGER",
      "department": "NPD",
      "isActive": true,
      "createdAt": "ISO date"
    }
  ]
}
```

## `PATCH /api/admin/users/:userId`

Request:

```json
{
  "role": "SCM_MANAGER",
  "department": "SCM",
  "isActive": true,
  "name": "Updated User"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "_id": "ObjectId",
    "name": "Updated User",
    "email": "user@company.com",
    "role": "SCM_MANAGER",
    "department": "SCM",
    "isActive": true
  }
}
```

## `GET /api/admin/sessions`

Response:

```json
{
  "success": true,
  "data": [
    {
      "_id": "ObjectId",
      "user": {
        "name": "User",
        "email": "user@company.com",
        "role": "SCM_MANAGER"
      },
      "tokenId": "uuid",
      "ipAddress": "::1",
      "userAgent": "browser",
      "expiresAt": "ISO date",
      "createdAt": "ISO date"
    }
  ]
}
```

## `DELETE /api/admin/sessions/:sessionId`

Response:

```json
{
  "success": true,
  "data": {
    "_id": "ObjectId",
    "revokedAt": "ISO date"
  }
}
```

## `GET /api/admin/logs`

Response:

```json
{
  "success": true,
  "data": [
    {
      "_id": "ObjectId",
      "user": {
        "name": "Admin",
        "email": "admin@company.com",
        "role": "ADMIN"
      },
      "action": "USER_CREATED",
      "resource": "User",
      "resourceId": "ObjectId",
      "method": "POST",
      "path": "/api/admin/users",
      "ipAddress": "::1",
      "metadata": {},
      "createdAt": "ISO date"
    }
  ]
}
```

---

# RFQ module

### `POST /api/rfq`

Creates an RFQ item.

Typical request:

```json
{
  "rfq_number": "RFQ_RF_01",
  "customer": "ANDREW",
  "rfq_dated": "2026-07-02",
  "project_lead": "HARIPRUDVI",
  "project_name": "Mounting Bracket",
  "main_part_no": "631743-1",
  "description": "P4 mounting bracket",
  "annual_volume": 1000
}
```

Response:

```json
{
  "message": "RFQ item created",
  "rfqItem": {}
}
```

### `GET /api/rfq`

Query filters:

`rfq_status`, `customer`, `project_lead`

Response:

```json
[
  {
    "_id": "ObjectId",
    "rfq_number": "RFQ_RF_01",
    "customer": "ANDREW",
    "rfq_status": "ACTIVE",
    "current_stage": "TECHNICAL_REVIEW"
  }
]
```

### `GET /api/rfq/:rfqItemID`

Returns one RFQ item.

### `PUT /api/rfq/:rfqItemID`

Updates an RFQ after passing the stage gate. If the mass-production status changes to `HANDED_OVER`, the RFQ is automatically converted to a project.

Response:

```json
{
  "message": "RFQ item updated and mass production approved — project created",
  "rfqItem": {},
  "project": {}
}
```

### `DELETE /api/rfq/:rfqItemID`

Deletes the RFQ item.

---

# Component / BOM module

### `POST /api/components`

A component belongs to **either** an RFQ prototype or a production project, never both.

Request:

```json
{
  "rfq_item": "ObjectId",
  "component_name": "Bracket",
  "component_description": "Steel bracket",
  "per_unit_qty": 2,
  "total_qty": 100
}
```

or:

```json
{
  "project": "ObjectId",
  "component_name": "Bracket",
  "per_unit_qty": 2,
  "total_qty": 2000
}
```

Response:

```json
{
  "message": "Component added",
  "component": {}
}
```

### `GET /api/components/project/:projectID`

Returns production BOM/components.

### `GET /api/components/rfq/:rfqItemID`

Returns prototype/pilot components.

### `GET /api/components/:componentID`

Returns one component.

### `PUT /api/components/:componentID`

Updates a component.

### `DELETE /api/components/:componentID`

Deletes a component.

---

# Project module

### `POST /api/projects`

Request:

```json
{
  "project_name": "Project Alpha",
  "order_qty": 10000,
  "project_owner": "Owner",
  "customer": "Customer",
  "delivery_schedule": [
    {
      "date": "2026-10-15",
      "quantity": 3000
    }
  ]
}
```

Response:

```json
{
  "message": "Project created",
  "project": {}
}
```

### `GET /api/projects`

Query filters:

`status`, `customer`, `project_owner`, `project_name`, `from_date`, `to_date`

Returns an array of projects.

### `GET /api/projects/:projectID`

Returns one project.

### `PUT /api/projects/:projectID`

Updates a project and returns:

```json
{
  "message": "Project updated",
  "project": {}
}
```

### `DELETE /api/projects/:projectID`

Deletes a project.

---

# Purchase module

### `POST /api/purchases`

`purchase_type` must be `RFQ_NPD` or `PRODUCTION`.

Production request:

```json
{
  "purchase_type": "PRODUCTION",
  "project": "ObjectId",
  "component": "ObjectId",
  "supplier": "ABC Supplier",
  "quantity": 500,
  "unit_price": 42,
  "po_number": "PO-1001"
}
```

Prototype request:

```json
{
  "purchase_type": "RFQ_NPD",
  "rfq_item": "ObjectId",
  "item_name": "Prototype material",
  "supplier": "ABC Supplier",
  "quantity": 10,
  "unit_price": 100
}
```

Response:

```json
{
  "message": "Purchase order created",
  "purchaseOrder": {}
}
```

### `GET /api/purchases`

Filters:

`purchase_type`, `status`, `supplier`, `po_number`, `project`, `rfq_item`

Returns purchase orders.

### `GET /api/purchases/project/:projectID`

Returns production POs for a project.

### `GET /api/purchases/rfq/:rfqItemID`

Returns prototype/NPD POs for an RFQ.

### `GET /api/purchases/:purchaseOrderID`

Returns one PO.

### `PUT /api/purchases/:purchaseOrderID`

Updates a PO.

### `DELETE /api/purchases/:purchaseOrderID`

Deletes a PO.

---

# Production module

Production output is now logged against a **stage** (a process step) or a **machine**, by the operator who ran it, with a start/end time. `run_minutes` and `pieces_per_hour` are derived virtuals, not stored — they're computed from `start_time`/`end_time`/`finished_qty` on every read.

### `POST /api/production`

Request:

```json
{
  "project": "ObjectId",
  "date": "2026-09-07",
  "finished_qty": 500,
  "stage": "ObjectId",
  "machine": "ObjectId",
  "operator_name": "Ravi Kumar",
  "start_time": "2026-09-07T09:00:00.000Z",
  "end_time": "2026-09-07T11:30:00.000Z"
}
```

Either `stage` or `machine` is required (at least one). `operator_name`, `start_time` and `end_time` are required.

Response:

```json
{
  "success": true,
  "production": {
    "run_minutes": 150,
    "pieces_per_hour": 200
  }
}
```

### `GET /api/production`

Returns every production entry, with `project`, `stage` and `machine` populated.

### `GET /api/production/project/:projectID`

Returns production entries for one project.

### `PATCH /api/production/:productionID/qc`

Request:

```json
{
  "qc_status": "PASSED"
}
```

Allowed values: `PASSED`, `FAILED`.

Only QC-passed finished quantity is eligible for dispatch.

---

# Stage module

Master data for production process stages (e.g. Laser Cutting, Bending, Welding). Managed by ADMIN / SCM_MANAGER; readable by anyone with production access.

### `GET /api/stages`

Returns active stages. Pass `?includeInactive=true` to include deactivated ones.

### `POST /api/stages` — ADMIN, SCM_MANAGER

Request: `{ "name": "Laser Cutting", "code": "LSR", "description": "" }`

### `PATCH /api/stages/:stageID` — ADMIN, SCM_MANAGER

Request: `{ "name": "...", "code": "...", "description": "...", "isActive": false }`

---

# Machine module

Master data for shop-floor machines. Same shape and permissions as the Stage module.

### `GET /api/machines`

### `POST /api/machines` — ADMIN, SCM_MANAGER

Request: `{ "name": "CNC-04", "code": "CNC04", "description": "" }`

### `PATCH /api/machines/:machineID` — ADMIN, SCM_MANAGER

---

# Warehouse module

### `POST /api/warehouse`

Request:

```json
{
  "purchase_order": "ObjectId",
  "received_qty": 500,
  "received_date": "2026-09-07",
  "invoice_number": "INV-1001",
  "grn_number": "GRN-1001"
}
```

Response:

```json
{
  "message": "GRN recorded",
  "grn": {}
}
```

### `GET /api/warehouse/project/:projectID`

Returns GRNs for production POs belonging to a project.

### `GET /api/warehouse/rfq/:rfqItemID`

Returns GRNs for NPD/prototype POs.

---

# Dispatch module

### `POST /api/dispatch`

Request:

```json
{
  "project": "ObjectId",
  "dispatched_qty": 250,
  "date": "2026-09-07"
}
```

The controller verifies that the requested quantity does not exceed cumulative QC-passed production minus previously dispatched quantity.

Response:

```json
{
  "message": "Dispatch entry recorded",
  "dispatch": {}
}
```

### `GET /api/dispatch/project/:projectID`

Returns project dispatch entries.

---

# Dashboard module

## `GET /api/dashboard/rfq`

Optional filters:

`rfq_status`, `current_stage`, `customer`, `project_lead`, `rfq_number`, `main_part_no`, `project_status`, `from_date`, `to_date`

Response:

```json
{
  "filters": {},
  "summary": {
    "total": 25,
    "by_stage": {
      "TECHNICAL_REVIEW": 4,
      "DFM_REVIEW": 3,
      "PILOT_BUILD": 2
    },
    "by_status": {
      "ACTIVE": 15,
      "AWARDED": 10
    },
    "awarded": 10
  },
  "data": []
}
```

## `GET /api/dashboard/projects`

Optional filters:

`status`, `customer`, `project_owner`, `project_name`, `from_date`, `to_date`

Returns project KPI summary and project rows.

## `GET /api/dashboard/project/:projectID`

Returns operational project KPIs combining project, purchase, production, dispatch, warehouse and component data.

## `GET /api/dashboard/production`

Production KPIs grouped by stage and by machine. Optional filters: `project`, `stage`, `machine`, `from_date`, `to_date`.

Response:

```json
{
  "filters": {},
  "summary": {
    "total_entries": 42,
    "total_qty": 8600,
    "qc_passed_qty": 8100,
    "qc_pending": 3,
    "qc_failed": 1
  },
  "by_stage": [
    { "id": "ObjectId", "name": "Laser Cutting", "code": "LSR", "qty": 3200, "entries": 14, "run_minutes": 980, "pieces_per_hour": 196 }
  ],
  "by_machine": [
    { "id": "ObjectId", "name": "CNC-04", "code": "CNC04", "qty": 2100, "entries": 9, "run_minutes": 610, "pieces_per_hour": 206 }
  ]
}
```

Every active stage/machine is included even at zero output, so the dashboard can show idle stages/machines, not just active ones.

---

# 7. Frontend pages

The frontend includes:

- `LoginPage.jsx` — centered dark auth card
- `dashboard/DashboardPage.jsx` — tabbed RFQ / Project / Production dashboards
  - `dashboard/RfqDashboardTab.jsx`
  - `dashboard/ProjectDashboardTab.jsx`
  - `dashboard/ProductionDashboardTab.jsx`
  - `dashboard/kpiComponents.jsx` — dashboard-specific stat cards, section cards, progress bars, loading/error states
- `RfqPage.jsx` — RFQ register, stage-gate action panel, prototype BOM
- `ProjectsPage.jsx` — project register with a non-destructive name filter
- `PurchasePage.jsx`
- `ProductionPage.jsx` — captures stage/machine, operator name and start/end time per entry, plus inline Stage/Machine master-data management for ADMIN/SCM_MANAGER
- `WarehousePage.jsx`
- `DispatchPage.jsx`
- `AdminUserManagementPage.jsx`
- `components/ui.jsx` — shared design-system primitives (`Panel`, `PageHeader`, form fields, buttons, `StatusBadge`, `Table`, `DataTable`, `Alert`, `EmptyState`) used across every page above

The navigation is role-aware. Administration is only exposed to `ADMIN`.

---

# 8. UI system

TVI One's UI is aligned with the company's other internal app (the finance/payables client) so both look and feel like one product family.

- **Tailwind CSS only — no DaisyUI, no custom CSS classes.** Every page is built from the shared primitives in `components/ui.jsx`; `index.css` is just `@import "tailwindcss"` plus a minimal reset.
- **Dark theme**: `slate-950` page background, `slate-900` panels/sidebar/topbar, `slate-800` borders and dividers.
- **Accent**: `blue-600` for primary actions, active nav state, and links (`shadow-blue-600/30` glow on primary buttons and the active nav pill).
- **Status color language** (used consistently in `StatusBadge` — pill badges, `/10` background + `/20` border + solid-400 text): emerald = positive/passed/active, amber = pending/on-hold, red = failed/rejected/cancelled, blue = completed/informational.
- **Tables** follow the reference app's pattern: `slate-950` uppercase header row, `divide-y divide-slate-800/50` rows, `hover:bg-slate-800/40`, mono font for IDs/reference numbers.
- Fixed dark sidebar navigation (role-aware links, active state uses the same blue-600 pill as buttons), responsive down to a scrollable layout on small screens.

---

# 9. Data model principles

### RFQ

Stores customer RFQ metadata and the current stage/status.

### Component

Enforced ownership:

```text
RFQ prototype component
        OR
Project production component
```

Never both.

### PurchaseOrder

Enforced purchase isolation:

```text
RFQ_NPD → rfq_item
PRODUCTION → project + component
```

### Production

Tracks project output and QC state — now also KPI data: which stage or machine the run happened on, the operator, and start/end time. `run_minutes` and `pieces_per_hour` are computed on read, never stored.

### Stage

Master data for a production process step (e.g. Laser Cutting, Bending). A Production entry references a Stage or a Machine (or both).

### Machine

Master data for a shop-floor machine.

### GRN

Links receipts to the purchase order, allowing warehouse traceability.

### Dispatch

Checks production availability before recording movement.

### Session

Stores token identity and revocation state.

### AuditLog

Captures security/admin actions and can be expanded to cover every transactional mutation.

---

# 10. Development log / chronological changelog

## 2026-09-07 — v1.2.0

- Rebuilt the entire frontend UI to align with the company's other internal app (finance/payables client): dark `slate-950`/`slate-900` theme, `blue-600` accent, pill status badges, mono-styled IDs.
- Dropped DaisyUI in favor of plain Tailwind CSS across the whole app — added `components/ui.jsx` with shared primitives (`Panel`, `PageHeader`, form fields, buttons, `StatusBadge`, `Table`, `Alert`, `EmptyState`) used by every page.
- Restyled every page: Login, sidebar/topbar layout, RFQ, Projects, Purchase, Production, Warehouse, Dispatch, Admin, and all three dashboard tabs.
- Fixed a real bug on the Projects page: the name filter permanently narrowed the loaded record list on every keystroke with no way to recover the hidden rows; replaced with a non-destructive `useMemo` filter.
- Cleaned up a few outstanding lint issues (`react-hooks/set-state-in-effect`, an unused import) surfaced while touching Admin, Purchase and `main.jsx`.

## 2026-09-07 — v1.1.0

- Added `Stage` and `Machine` master-data models with CRUD APIs (`/api/stages`, `/api/machines`), managed by ADMIN/SCM_MANAGER.
- Extended the `Production` model with `stage`, `machine`, `operator_name`, `start_time`, `end_time`; added derived `run_minutes`/`pieces_per_hour` virtuals.
- `POST /api/production` now requires a stage or machine, operator name, and start/end time.
- Added `GET /api/dashboard/production` — KPI aggregation by stage and by machine (qty, entries, run time, pieces/hour), including idle stages/machines at zero output.
- Rebuilt the dashboard as three tabs — RFQ, Project, Production — in `pages/dashboard/`, styled with Tailwind CSS + DaisyUI only (lime-600 / white / blue-600 palette).
- Fixed Tailwind never being imported into `index.css` despite being installed and configured in Vite — Tailwind utility classes had no effect anywhere in the app until this fix.
- Updated `ProductionPage.jsx` to capture stage/machine/operator/time per entry and added inline Stage/Machine management for ADMIN/SCM_MANAGER.

## 2026-09-07 — v1.0.0

- Consolidated TVI One into a root npm workspace.
- Added backend/frontend independent modules.
- Added JWT authentication.
- Added bcrypt password hashing.
- Added active session tracking.
- Added ADMIN-only user administration.
- Added role creation/update/deactivation.
- Added audit-log storage.
- Added RBAC middleware.
- Protected departmental API modules.
- Added RFQ stage-gate workflow.
- Preserved prototype-vs-production purchase isolation.
- Preserved QC-based dispatch validation.
- Added responsive enterprise UI.
- Added standards-mode HTML document.
- Added first-admin seed command.
- Added complete API contract documentation.
- Added root `npm run dev` orchestration.

## Planned v1.1

- Multiple Main Parts per RFQ/Project, each with multiple Sub Parts (replacing the current flat `main_part_no`/`sub_part_no` strings).
- Refresh-token rotation.
- Password reset / forced password change.
- Fine-grained action-level permissions.
- Persistent frontend auth context.
- Transactional forms for every department.
- Pagination and server-side filtering.
- Notification center.
- File/document attachments.
- Approval history and immutable workflow events.

## Planned v2

- Attendance.
- Finance.
- Customer portal.
- Supplier portal.
- Advanced procurement.
- Inventory ledger.
- Costing and profitability.
- BI/analytics.

---

# 11. Production hardening checklist

Before deploying to production:

- Replace `JWT_SECRET` with a long random secret.
- Replace the seeded admin password.
- Use MongoDB Atlas/private networking or secured MongoDB.
- Set a production `FRONTEND_URL`.
- Use HTTPS.
- Add rate limiting to login.
- Add refresh-token rotation.
- Add password reset.
- Add request validation with a schema library.
- Add database indexes for high-volume queries.
- Add pagination to list endpoints.
- Add structured logging.
- Add automated tests and CI.
- Configure backups and retention.
- Do not commit `.env`.

---

## License

Internal enterprise software foundation for TVI One.

## End-to-end RFQ → Dispatch workflow

The transactional workflow is now enforced server-side. The browser hides unavailable menus/actions for convenience, but the API is the authoritative RBAC boundary.

1. **NPD/Admin creates RFQ** — RFQ number, customer, project, part, annual volume and dates.
2. **Technical Review** — Admin/NPD completes the review.
3. **DFM Review** — unlocked only after Technical Review.
4. **Commercial Review** — unlocked only after DFM.
5. **Costing** — unlocked only after Commercial; costing must be submitted to customer.
6. **RFQ Award** — unlocked only after costing submission.
7. **Prototype Build** — unlocked after award.
8. **Prototype Components/BOM** — components are created against the RFQ and remain isolated from mass-production components until handover.
9. **Prototype Submitted** — requires at least one prototype component.
10. **Capex/Pilot Component approval** — separate gate for pilot readiness.
11. **Pilot Build** → **Pilot Submitted**.
12. **Customer Approval** — explicit approval action.
13. **Mass Production Handover** — converts the approved RFQ into a Project and transfers prototype components to the project's actual BOM.
14. **SCM Production PO** — SCM/Admin creates production POs against Project + Component.
15. **Production** — Production/SCM/Admin records output.
16. **Production QC** — Production/Admin marks output PASSED or FAILED.
17. **Warehouse GRN** — Warehouse/SCM/Admin receives material against a PO, captures invoice and performs quality inspection.
18. **Dispatch** — Dispatch/SCM/Admin can dispatch only QC-passed production quantity; the API prevents over-dispatch.

### RBAC action matrix

| Action | ADMIN | NPD_MANAGER | SCM_MANAGER | PRODUCTION_USER | WAREHOUSE_INSPECTOR | DISPATCH_USER |
|---|---|---|---|---|---|---|
| Create RFQ | ✓ | ✓ | | | | |
| Technical / DFM / Commercial / Costing | ✓ | ✓ | | | | |
| Award / Prototype / Pilot / Customer approval / Handover | ✓ | ✓ | | | | |
| Pilot component gate | ✓ | ✓ | ✓ | | | |
| Create production PO | ✓ | | ✓ | | | |
| Record production | ✓ | | ✓ | ✓ | | |
| Production QC | ✓ | | | ✓ | | |
| Create GRN / inspect | ✓ | | ✓ | | ✓ | |
| Dispatch | ✓ | | ✓ | | | ✓ |

### Important API endpoints

- `POST /api/rfq`
- `GET /api/rfq`
- `GET /api/rfq/:rfqItemID/workflow`
- `POST /api/rfq/:rfqItemID/transition`
- `POST /api/components`
- `POST /api/purchases`
- `POST /api/production`
- `PATCH /api/production/:productionID/qc`
- `POST /api/warehouse`
- `PATCH /api/warehouse/:grnID/inspection`
- `POST /api/dispatch`

The frontend pages now expose these transactional actions instead of only showing placeholder workspaces.
