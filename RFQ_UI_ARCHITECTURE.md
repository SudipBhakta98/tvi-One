# TVI One – RFQ UI & hierarchy architecture

## Page pattern
All operational registers now follow the same interaction pattern:

1. Page header + primary `Add ...` button.
2. KPI cards.
3. Search/filter bar.
4. Main register/list.
5. Clicking a row opens a detail dialog.
6. Create/edit/action workflows happen inside dialogs instead of pushing large forms into the page.

Shared implementation lives in `frontend/src/components/ui.jsx` (`KpiCard`, `FilterBar`, `Modal`, `AddButton`).

## RFQ hierarchy
The RFQ aggregate is:

`RFQ -> main_parts[] -> sub_parts[]`

A single RFQ document can therefore contain many main parts, while every main part can contain many sub parts.

The server validates:
- at least one main part
- unique main part numbers within an RFQ
- unique sub part numbers within each main part
- sub part IDs used by components must belong to the selected main part
- main part IDs used by components must belong to the selected RFQ

Legacy top-level `main_part_no`, `sub_part_no` and `volume_per_annum_nos` fields remain for downstream compatibility. New RFQs populate `main_parts` and mirror the first main part into those legacy fields.

## Component ownership
Prototype components may optionally carry:
- `rfq_item`
- `main_part_id`
- `sub_part_id`

This keeps BOM/component data traceable to the RFQ part hierarchy while preserving the existing project handover flow.
