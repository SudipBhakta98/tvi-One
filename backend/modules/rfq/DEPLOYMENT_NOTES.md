# RFQ module update — deployment notes

## Included changes

- Added `drawing_attachments[]` metadata to main parts and sub-parts; at least one drawing is required for each part and sub-part.
- Added `RfqWorkflow` model backed by the `rfq_workflows` collection. It reuses the existing RFQ schema so workflow-specific stage fields and validation follow the same 20-stage rules.
- Added workflow-instance create/list/detail/transition/remark/stage-edit/purchase-item endpoints.
- Added workflow-specific BOM ownership using `Component.workflow_instance` and separate handover of those components to the generated Project.
- Refreshes selected part snapshots when existing RFQ part descriptions/drawings are edited, while preserving workflow lifecycle history.
- RFQ creation is intake-only: it does not set an initial target date, create stage history, or start a stage. Parent RFQ records no longer expose stage-mutation routes.
- Workflow start requires a selected set of unassigned main parts/subparts and an initial target date; the existing 20-stage process then runs on the workflow instance only. The initial date seeds Document Review; each later target-date stage requests its own target date when it becomes active, while customer/event stages remain customer-driven.
- RFQ register quote/award totals are consolidated from child workflows; workflow register rows show each batch independently.

## Apply

1. Back up MongoDB and the current RFQ module folders.
2. Replace the existing backend RFQ module folder with the `rfq/` folder from this ZIP, preserving the same application path.
3. Replace the existing frontend RFQ module folder with the `rfq/` folder from the frontend ZIP.
4. Restart the backend and rebuild/restart the frontend using the application's normal scripts.
5. Verify authentication middleware still attaches `req.user` before the RFQ routes and that the existing `/api/rfq` and `/api/components` route mounts remain unchanged.

Install `multer` for local file uploads. Existing records do not require a destructive migration; the new workflow/counter collections are created on first write.

## Smoke-test checklist

- Open an existing RFQ and verify its current stage/history remain unchanged.
- Edit an RFQ part and add a drawing link; save, reopen, and verify the drawing remains visible.
- Create an RFQ without any target dates and confirm it has no started stage.
- From the RFQ detail page, create a batch workflow with one main part and/or selected subparts and an initial target date.
- Confirm a second workflow cannot select a main part or subpart already assigned to a previous workflow.
- Complete a stage in one workflow and confirm the parent RFQ and other workflow stages do not change.
- Confirm the RFQ register shows consolidated part counts and quote/award totals, while the workflow register shows each workflow number, counts, values, current stage, remarks, and status.
- Add workflow-specific BOM lines and verify the parent RFQ BOM remains separate.
- Complete handover in a test workflow and verify only that workflow's components move to the created Project.
- Add a new part/drawing to the RFQ and confirm existing workflow progress/history is unchanged while selected part drawing snapshots refresh.

## Important integration boundary

These archives contain the RFQ modules, not the entire application. Static syntax checks were performed on the modified RFQ code, but full application compilation, authentication integration, database behavior, and project-module integration cannot be verified without the complete application repositories and a test database. Test on a staging environment before replacing production folders.

## RFQ lifecycle controls (Pause / Resume / Complete / Cancel)

The parent RFQ lifecycle is stored separately from the existing workflow/customer outcome field:

- `lifecycle_status`: `ACTIVE` (default), `PAUSED`, `COMPLETED`, or `CANCELLED`.
- `POST /:rfqItemID/lifecycle` accepts `{ action: "PAUSE" | "RESUME" | "COMPLETE" | "CANCEL", reason }`.
- PAUSE marks only running child workflows as `PAUSED` and records `paused_by_parent=true` plus their previous lifecycle status.
- RESUME restores only workflows paused by that parent RFQ, preserving current stage and stage history.
- COMPLETE / CANCEL stop running workflows as `STOPPED_BY_RFQ_COMPLETION` / `STOPPED_BY_RFQ_CANCELLATION`; existing completed workflows and all stage history remain unchanged.
- Workflow creation is rejected unless the parent RFQ is `ACTIVE`. Stage transitions are rejected unless both parent RFQ and workflow are active.
- Workflow lifecycle is separate from `rfq_status`, which continues to represent the existing customer/commercial decision process.

Existing RFQ documents without `lifecycle_status` are treated as `ACTIVE`; existing workflow documents without `lifecycle_status` are treated as `IN_PROGRESS` by transition and display logic. Back up the database and validate these controls in staging before production rollout.


## Updated RFQ lifecycle, numbering, reports and local attachments

### RFQ number generation
- `models/counterModel.js` persists monthly and workflow counters in `rfq_counters`.
- `services/rfqNumber.js` allocates a number atomically by UTC RFQ month (`YYYY-MM`) and emits `T-Mmm-NNN-PROJECTCODE`.
- The RFQ number is server-generated; `rfq_number` is ignored on create/update from the client.
- `RfqItem.rfq_number` has a unique index. Before deployment, check for and resolve duplicate existing RFQ numbers so MongoDB can build this index.

### Separate statuses
- `register_status` is the parent RFQ status: `PENDING`, `ACTIVE`, `HOLD`, `CANCEL`, `COMPLETED`.
- Existing `rfq_status` is intentionally preserved for workflow/customer outcomes (`WAITING_FOR_APPROVAL`, `AWARDED`, `LOST`, etc.).
- Creating a batch workflow atomically promotes the parent from `PENDING` to `ACTIVE`. Register KPIs and filters use `register_status`.
- Admin, Super User and NPD Manager can set `HOLD`, `CANCEL`, `COMPLETED`; a held RFQ can be resumed (`ACTIVE`, or `PENDING` if it has no workflow).
- Scrum Master, Super User and Admin can create/edit RFQs, start batch workflows and set target dates. Workflow creation uses a short parent-level lease lock to prevent concurrent selection of the same parts; workflow numbers use a persistent atomic counter.

### Local upload setup
Install Multer if it is not already present:
`npm install multer`

The RFQ route exposes `POST /api/rfq/attachments` (multipart field name `files`) and authenticated `GET /api/rfq/attachments/:filename` view/download access (`?download=1` forces download). Files are saved under the configured `UPLOADS_DIR` (default `<project-root>/storage/uploads/rfq`); file paths and metadata are stored in RFQ documents. Create a backup policy for this directory because it is not part of MongoDB.

In the main Express entry file, add the static mount once (before or after API routes):
```js
import path from "node:path";
import express from "express";

app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads"), {
  dotfiles: "deny",
  index: false,
  maxAge: "7d",
}));
```
The backend `services/storage/index.js` is the storage-driver boundary. Future S3 migration should replace its driver exports with an S3 implementation while preserving the attachment metadata contract.

### Report
- `GET /api/rfq/:rfqItemID/report` returns one RFQ, its child workflows and all collected attachment metadata.
- The frontend Report view formats this as a print-friendly document. Use the browser's Print / Save PDF action.

### Required deployment checks
1. Ensure MongoDB is connected before accepting requests and allow the app's database user to create indexes.
2. Ensure `<project-root>/uploads` is writable by the Node process and is included in backups.
3. Mount `/uploads` statically in the main Express app as shown above.
4. Confirm `multer` is installed.
5. Existing RFQ records without `register_status` are treated by the frontend as `PENDING` unless their register API derives otherwise. For clean analytics, run a one-time migration:
   `db.rfqitems.updateMany({ register_status: { $exists: false } }, [{ $set: { register_status: { $cond: [{ $eq: ["$workflow_started", true] }, "ACTIVE", "PENDING"] } } }])`
   Adjust the collection name if your Mongoose collection name differs.
6. Verify all role constant values in `constants/roles.js` match the values used by `ROLES` (`ADMIN`, `SUPER_USER`, `NPD_MANAGER`, `NPD_SCRUM_MASTER`).
