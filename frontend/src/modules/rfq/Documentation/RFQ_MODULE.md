# RFQ & NPD Module

Tracks an RFQ from customer enquiry to mass-production handover through 20 fixed stages, then converts it into a Project.

## 1. Screens

| Screen | How it opens | Purpose |
|---|---|---|
| RFQ Register | `/rfq` | KPIs, filters (search, month, customer, **project owner**, status, stage), list of RFQs |
| Create RFQ (full page) | `/rfq?create=1` (sidebar "Create RFQ" or **New RFQ**) | RFQ details, attachments, initial target dates, part structure |
| RFQ Detail (full page) | `/rfq?id=<rfqId>` (click a register row) | KPIs, 2 × 10 stage grid, part hierarchy |

Both full pages have a sticky title bar with a **Close** button that returns to the register.

## 2. Part structure

`RFQ → many Main Parts → many Sub Parts`. Sub parts always belong to a main part and are optional.

## 3. Stage grid (RFQ Detail)

Twenty cards in two columns × ten rows (stages 1–10 left, 11–20 right; single column on small screens).
Every card shows: **stage name · status · target date · submit date**, and for the open stage: **remarks, attachments, action button(s)**.

Card states: `Done`, `Done · Delayed` (submitted after target), `In Progress`, `Delayed` (target passed, still open), `Upcoming` (locked).
Only the open stage is actionable; stages complete strictly in order.

**Who can edit:** Admin, Super User and NPD Manager (all stages); SCM Manager (Capex / Tooling — Pilot Building only). Everyone else sees the grid read-only.

### Stage list

| # | Stage | Target date | Notes |
|---|---|---|---|
| 1 | Customer RFQ Received | yes | Completed automatically on create |
| 2–6 | Document Review, Technical, Feasibility, DFM, Commercial | yes | **Mark Done** |
| 7 | Costing | yes | Quoted value required |
| 8 | RFQ Submitted to Customer | yes | **Mark Done** |
| 9 | Customer Decision — Lost / Awarded | no | Attachment required. **Awarded** opens the *Target dates* dialog (stages 10–12); **Lost** closes the RFQ |
| 10 | Capex / Tooling — Prototype | yes | Optional **Add purchase items** |
| 11–12 | Prototype Building, Prototype Submission | yes | **Mark Done** |
| 13 | Customer Approval — Pilot (1st batch) | no | Attachment required. **Customer Approved** opens *Target dates* (stages 14–16) |
| 14 | Capex / Tooling — Pilot | yes | Optional **Add purchase items** |
| 15–16 | Pilot Building, Pilot Delivery | yes | **Mark Done** |
| 17 | Customer Approval — Mass Production | no | Attachment required. Opens *Target dates* (stages 19–20) |
| 18 | Receive Customer PO | no | Attachment required. **Submit** opens the *PO* dialog |
| 19 | Define Actual BOM | yes | **Add BOM** dialog; at least one line before completing |
| 20 | Mass Production Handover | yes | **Convert to Project** |

Files/links added on the Create page are saved on stage 1 (Customer RFQ Received). Initial target dates for stages 2–8 are set when starting a batch workflow. Every later phase's dates are collected in the dialog at stages 9, 13 and 17.

## 4. Attachments and remarks

- Every stage accepts attachments: choose files (Excel, PDF, Word, text, images) and/or paste a link.
- Uploaded files are stored on the configured local upload volume with persisted file paths and authenticated view/download routes; pasted links remain external links.
- Attachments are mandatory at RFQ intake, on each main/sub-part drawing field, and on every workflow stage after Stage 1.
- Remarks are optional; when added, they are stored with the stage history (who, when, note).

## 5. Dialogs

| Dialog | Opened by | Captures |
|---|---|---|
| Target dates | Awarded / Customer Approved (stages 9, 13, 17) | One date per stage of the next phase (all required) |
| Purchase items | **Add purchase items** on stages 10 and 14 | Item, quantity, remarks — fully optional |
| Customer PO | **Submit** on stage 18 | PO number, PO quantity, any number of delivery schedules (date + quantity; total may not exceed PO quantity) |
| Actual BOM | **Add BOM** on stage 19 | Component, description, per-unit qty, total qty (defaults to per-unit × PO quantity) |
| Stage details | **View details** on any completed card | Submit info, remarks, attachments, plus quoted value / decision / purchase items / PO + schedules / BOM where relevant |

## 6. API (`/api/rfq`, paths relative to the RFQ base endpoint)

| Method | Path | Purpose |
|---|---|---|
| POST | `/` | Create RFQ (`main_parts[].sub_parts[]`, `stage_schedule` with the 8 initial targets) |
| GET | `/` | Register list |
| GET | `/:id/workflow` | RFQ + schedule with statuses + components (RFQ or converted Project) |
| POST | `/:id/transition` | Complete the open stage: `{ stage, data }` |
| PUT | `/:id/purchase-items` | Replace purchase items of one capex stage: `{ stage, items:[{item_name, quantity, remarks}] }` |
| POST / PUT / DELETE | `/components`, `/components/:id` | BOM lines (`bom_stage: "FINAL_BOM"`, editable only while stage 19 is open) |

`transition` `data` fields (all stages accept `note` and `attachments[]`):

| Stage | Extra fields |
|---|---|
| Costing | `quoted_price` |
| Customer Decision | `decision: "AWARDED" \| "LOST"`, `target_dates[]` when awarded |
| Customer Approval (pilot / mass) | `approved: true`, `target_dates[]` |
| Customer PO | `po_number`, `po_qty`, `delivery_schedule[{date, quantity}]` |
| Pilot Capex | `status` (defaults to `APPROVED`) |

`target_dates` = `[{ stage, target_date }]` for **every** stage of the next phase.

## 7. Data model additions (`RfqItem`)

- `purchase_items[]` — `{ stage, item_name, quantity, remarks }`
- `purchase_order` — `{ po_number, po_qty, delivery_schedule[{date, quantity}], po_received_date }`
- `stage_attachments` — map of stage → attachment list (existing)
- On conversion to a Project, the PO's delivery schedules become the Project's delivery schedule.

## 8. UI file map (`modules/rfq`)

```
pages/       RfqPage (register + routing by query string), RfqCreatePage, RfqDetailPage
components/  RfqFullPage (title bar + Close), RfqStageGrid, RfqStageCard, StageActionPanel,
             AttachmentField, FormControls, TargetDatesDialog, PoDialog, PurchaseItemsDialog, BomDialog,
             StageDetailsDialog, RfqRegister, RfqParts, rfqConfig.js
hooks/       useRows (repeatable rows), useAsyncAction (busy + error)
contexts/    RfqContext
Documentation/RFQ_MODULE.md
```
Removed: `RfqCreateModal`, `RfqDetailModal`, `RfqLifecycle`, `RfqStageAction`, `RfqComponentsPanel`, `RfqTargetPhase`, placeholder `pages/Dashboard.jsx`.

## 9. Not covered here

Purchasing, Warehouse (GRN / invoice → purchase accept → finance) and Production hand-offs live in their own modules and were not changed.

## Access, remarks, filters and reports (NPD update)

- **Roles:** `NPD_SCRUM_MASTER` creates RFQs; the RFQ's **Project Owner** (an `NPD_USER`) updates stages; **NPD Manager** edits RFQ fields; only **Admin / Super User** delete. An `NPD_USER` only ever sees RFQs they own (enforced by the server: `rfqScope` in `backend/modules/rfq/services/rfqPermissions.js`, also applied to the RFQ dashboard and report).
- **Project Owner** is a user (`project_owner`), picked from `GET /rfq/owners`. `project_lead` is still stored (the owner's name, set by the server) so Projects and dashboards keep working.
- **Remarks:** append-only, per stage, unlimited (`POST /rfq/:id/remarks`). Shown in the stage card (newest), in "Details & remarks", and in the register (newest remark of the current stage).
- **Current stage** has no remarks input; its "Add remarks" button opens a dialog (`AddRemarkDialog`). **View details** on a submitted stage is read-only and shows the stage's Created At, Updated At and whether it was edited after submission (stage history entries carry timestamps; editing the RFQ marks the RFQ-received stage as updated).
- **Edit / Delete** buttons on the RFQ page follow `permissions` from the server: edit = NPD Manager, Admin, Super User; delete = Admin, Super User (an RFQ already converted to a project cannot be deleted).
- **Navigation** is a floating drawer opened by hovering or clicking the menu / logo area in the header.
- **Filters:** Excel-style multi-select on Customer, Project, Owner, Stage and Status. Option lists come from `GET /rfq/filter-options`; filtering is done by the server (`?customer=A|B`). Search and month stay in the browser.
- **Reports:** `/dashboard/reports?department=rfq` returns a detailed report (one row per RFQ with all fields, plus parts, sub-parts, stage schedule, remarks, history, purchase items, deliveries and attachments). NPD roles can only request `projects` and `rfq` (`NPD_REPORT_DEPARTMENTS`).

## Remarks rule and stage editing
- A stage cannot be completed until it has at least one remark (enforced in `transitionRfq`); remarks can be added any number of times from the current stage's "Add remarks" button.
- A submitted stage can be corrected with **Edit** (NPD Manager, Admin, Super User): target date, submit date, attachments, and the quoted value (Costing) or PO number / quantity (Customer PO). The stage's Updated At changes, so View details shows "Edited After Submit: Yes".

## 10. Part drawings and independent workflow instances (update)

- Main parts and sub-parts now each support `drawing_attachments[]`. The existing attachment picker is reused, so the current UI pattern stays unchanged. As with stage attachments, selected local files are currently stored as metadata only; use links for immediately openable drawings until the application's file-upload integration is wired in.
- The RFQ detail page now has a **Workflow Instances** section. Create an instance by naming it and selecting one or more main parts and/or sub-parts. Each instance is stored in the separate MongoDB `rfq_workflows` collection and gets its own 20-stage lifecycle, stage schedule, remarks, attachments, costing, PO data, BOM and project conversion.
- The workflow instance detail view reuses the existing 20-stage grid and dialog patterns. Its stage, remark, edit, purchase-item and BOM actions use workflow-specific endpoints and do not update the parent RFQ's lifecycle.
- If the RFQ's part descriptions or drawings are updated later, selected part snapshots are refreshed in existing workflow instances without resetting their progress/history. A newly added part is not silently injected into an already-running workflow; create another workflow and select that part.
- Workflow endpoints: `GET /:rfqItemID/workflows`, `POST /:rfqItemID/workflows`, `GET /:rfqItemID/workflows/:workflowID`, `POST /:rfqItemID/workflows/:workflowID/transition`, `POST /:rfqItemID/workflows/:workflowID/remarks`, `PUT /:rfqItemID/workflows/:workflowID/stages/:stage`, and `PUT /:rfqItemID/workflows/:workflowID/purchase-items`.
- Workflow BOM lines use `workflow_instance` in the existing Components collection. At mass-production handover, only that workflow's components are handed over to its generated Project.
- Existing RFQ records remain valid. Mongoose will create the `rfq_workflows` collection when first used; no destructive migration is included. Take a database backup before deploying any schema/controller update.


## Batch workflow model (updated)

- Creating an RFQ is intake-only. It saves customer/project details, the part hierarchy, drawings, and RFQ-level attachments; it does not initialize stage targets/history or start a lifecycle.
- Open an RFQ to see consolidated values and its batch-workflow register. Start a workflow only through **Create Batch Workflow** after selecting available main parts and/or subparts and supplying target dates for stages 2 through 8.
- At workflow start, users provide target dates for stages 2 through 8 (`DOCUMENT_REVIEW` through `RFQ_SUBMITTED`). `CUSTOMER_RFQ_RECEIVED` is recorded as completed when the user explicitly starts the workflow. Each later target-date stage asks for its own target date when that stage becomes active; customer/event stages remain customer-driven. The existing 20-stage process and stage gates remain in place.
- Main-part selection and subpart selection are independent. A main part or subpart already assigned to any workflow is disabled in the UI and rejected by the API if submitted again. Different, unassigned subparts under the same parent main part can be assigned to other workflows.
- Workflow numbers are generated as `<RFQ number>-WF-001`, `<RFQ number>-WF-002`, etc. Every workflow owns its own stage schedule, progress, remarks, attachments, costing, PO information, and BOM.
- RFQ register values are consolidated from child workflows. Quoted value is the sum of workflow quotes; awarded value is the sum of awarded workflow quote × PO quantity (or × 1 when a PO quantity is not recorded yet).
- Existing direct RFQ stage-mutation routes have been removed. Stage actions are available only under `/:rfqItemID/workflows/:workflowID/...`.

### Workflow creation request

`POST /:rfqItemID/workflows` accepts `{ initial_target_dates, selected_parts }`, where each selection has `main_part_id`, `main_part_selected` (boolean), and `sub_part_ids` (array). The API validates part ownership, rejects duplicate assignments, and requires a valid target date for each of stages 2 through 8.

## Parent RFQ lifecycle controls

The RFQ detail page exposes Pause, Resume, Complete, and Cancel actions. Pause temporarily locks workflow stage actions and records which child workflows were paused by the parent. Resume restores only those workflows to `IN_PROGRESS` without changing their current stage or stage history. Complete and Cancel stop running child workflows with terminal lifecycle statuses while keeping workflow records and history viewable. The RFQ register displays the parent RFQ lifecycle status independently of each workflow's customer/commercial `rfq_status`.
