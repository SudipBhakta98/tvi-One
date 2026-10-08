# TVI One – RFQ / Dashboard Refactor

## Included changes
- Applied the Slate/Indigo/Green/Rose Tailwind theme to the shared UI, application shell, RFQ module and dashboard surfaces.
- Expanded RFQ KPIs with quoted value, awarded value, average quote and decision rate.
- Added RFQ filters for month, customer, project owner, status and workflow stage, including Stage 1–8.
- Made costing quoted value mandatory and persisted it in `costing.quoted_price`.
- Added mandatory customer-evidence attachments for customer decision / approval / PO stages.
- Added cloud-ready attachment metadata (`file_name`, `file_type`, `file_size`, `url`, `storage_provider`, `uploaded_at`). Current UI stores metadata with an empty URL and `PENDING_CLOUD_UPLOAD`; cloud storage can populate the URL later.
- Expanded RFQ dashboard analytics with quoted value, awarded value, average quote, decision rate, overdue targets, value trend, stage distribution, status mix and latest RFQs.

## Validation
- Backend modified JavaScript files pass `node --check`.
- Frontend build could not be executed in this environment because the uploaded project does not contain `node_modules`, and dependency installation timed out. Run `npm ci && npm run build` inside `frontend/` in the development environment.
