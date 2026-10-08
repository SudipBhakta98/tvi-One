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

Files/links added on the Create page are saved on stage 1 (Customer RFQ Received). Initial target dates (stages 1–8) are set on the Create page. Every later phase's dates are collected in the dialog at stages 9, 13 and 17.

## 4. Attachments and remarks

- Every stage accepts attachments: choose files (Excel, PDF, Word, text, images) and/or paste a link.
- Files are stored as **metadata only** (name, type, size) with `storage_provider: PENDING_CLOUD_UPLOAD`; a pasted link is saved in `url`. Cloud upload (S3) is a later step — set `url` and `storage_provider: CLOUD` when it is added.
- Attachments are **mandatory** on stages 9, 13, 17, 18 (customer evidence — label "Costing sheet & documents"); optional elsewhere. To require them on more stages add the stage key to `ATTACHMENT_REQUIRED_STAGES` in `server/rfq/services/rfqWorkflow.js`.
- Remarks are stored with the stage's history entry (who, when, note).

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
