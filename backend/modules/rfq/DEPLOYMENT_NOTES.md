# RFQ module update — deployment notes

## Included changes

- Added optional `drawing_attachments[]` metadata to main parts and sub-parts.
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

No new package is required. Existing records do not require a destructive migration; the new workflow collection is created on first write.

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
