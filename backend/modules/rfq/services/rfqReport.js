import RfqItem from "../models/rfqItemModel.js";
import { getStageStatus } from "./rfqWorkflow.js";
import { rfqScope } from "./rfqPermissions.js";
import { currentStageInfo } from "./rfqStageSummary.js";

const END_OF_DAY = "T23:59:59.999Z";
const date = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");
const dateTime = (value) => (value ? new Date(value).toISOString().replace("T", " ").slice(0, 16) : "");
const countWhere = (rows, field, value) => rows.filter((row) => row[field] === value).length;

const dateRangeFilter = ({ from_date, to_date }) => {
  const range = {};
  if (from_date) range.$gte = new Date(from_date);
  if (to_date) range.$lte = new Date(`${to_date}${END_OF_DAY}`);
  return Object.keys(range).length ? { rfq_dated: range } : {};
};

const rfqRow = (rfq) => {
  const info = currentStageInfo(rfq);
  return {
    rfq_number: rfq.rfq_number,
    project_name: rfq.project_name,
    customer: rfq.customer,
    rfq_send_by_name: rfq.rfq_send_by_name,
    rfq_send_by_contact_number: rfq.rfq_send_by_contact_number,
    rfq_send_by_email: rfq.rfq_send_by_email,
    project_owner: rfq.project_owner?.name || rfq.project_lead,
    rfq_status: rfq.rfq_status,
    project_status: rfq.project_status,
    current_stage: rfq.current_stage,
    current_stage_due_date: date(info.due_date),
    current_stage_status: info.status,
    current_stage_latest_remark: info.latest_remark?.text || "",
    rfq_dated: date(rfq.rfq_dated),
    rfq_target_date: date(rfq.rfq_target_date),
    description: rfq.description,
    main_part_count: rfq.main_parts?.length || 0,
    sub_part_count: rfq.main_parts?.reduce((total, part) => total + (part.sub_parts?.length || 0), 0) || 0,
    volume_per_annum_nos: rfq.volume_per_annum_nos,
    volume_per_annum_mt: rfq.volume_per_annum_mt,
    feasibility_status: rfq.feasibility_status,
    tooling_category: rfq.tooling_category,
    technical_review_status: rfq.technical_review?.status,
    dfm_review_status: rfq.dfm_review?.status,
    commercial_review_status: rfq.commercial_review?.status,
    costing_status: rfq.costing?.status,
    quoted_price: rfq.costing?.quoted_price,
    costing_submitted_date: date(rfq.costing?.submitted_date),
    customer_decision: rfq.customer_decision?.decision,
    customer_decision_date: date(rfq.customer_decision?.decision_date),
    awarded_date: date(rfq.awarded_date),
    proto_build_status: rfq.proto_build?.status,
    capex_status: rfq.capex_status,
    pilot_build_status: rfq.pilot_build?.status,
    po_number: rfq.purchase_order?.po_number,
    po_qty: rfq.purchase_order?.po_qty,
    po_received_date: date(rfq.purchase_order?.po_received_date),
    mass_production_status: rfq.mass_production?.status,
    mass_production_handover_target: date(rfq.mass_production?.handover_target_date),
    mass_production_handed_over: date(rfq.mass_production?.handed_over_date),
    linked_project: rfq.linked_project ? String(rfq.linked_project) : "",
    created_at: dateTime(rfq.createdAt),
    updated_at: dateTime(rfq.updatedAt),
  };
};

// One flat table per kind of record, each row tagged with its rfq_number, so nothing in an RFQ is left out of the report.
const detailTables = (rfq) => {
  const tag = { rfq_number: rfq.rfq_number };
  const mainParts = rfq.main_parts || [];
  return {
    main_parts: mainParts.map((part) => ({ ...tag, main_part_no: part.main_part_no, description: part.description, volume_per_annum_nos: part.volume_per_annum_nos, rfq_target_date: date(part.rfq_target_date), sub_part_count: part.sub_parts?.length || 0 })),
    sub_parts: mainParts.flatMap((part) => (part.sub_parts || []).map((sub) => ({ ...tag, main_part_no: part.main_part_no, sub_part_no: sub.sub_part_no, description: sub.description, qty_per_main_part: sub.qty_per_main_part }))),
    stage_schedule: (rfq.stage_schedule || []).map((item) => ({ ...tag, stage: item.stage, target_date: date(item.target_date), completed_date: date(item.completed_date), status: getStageStatus(rfq, item.stage) })),
    stage_remarks: (rfq.stage_remarks || []).map((remark) => ({ ...tag, stage: remark.stage, remark: remark.text, added_by: remark.user_name, role: remark.user_role, added_at: dateTime(remark.createdAt) })),
    stage_history: (rfq.stage_history || []).map((entry) => ({ ...tag, stage: entry.stage, action: entry.action, user: entry.user?.name || "", note: entry.note || "", completed_at: dateTime(entry.completedAt) })),
    purchase_items: (rfq.purchase_items || []).map((item) => ({ ...tag, stage: item.stage, item_name: item.item_name, quantity: item.quantity, remarks: item.remarks })),
    delivery_schedule: (rfq.purchase_order?.delivery_schedule || []).map((entry) => ({ ...tag, date: date(entry.date), quantity: entry.quantity })),
    attachments: Object.entries(rfq.stage_attachments || {}).flatMap(([stage, files]) => files.map((file) => ({ ...tag, stage, file_name: file.file_name, file_type: file.file_type, file_size: file.file_size, uploaded_at: dateTime(file.uploaded_at) }))),
  };
};

export const buildRfqReport = async (user, query = {}) => {
  const rfqs = await RfqItem.find({ ...dateRangeFilter(query), ...rfqScope(user) })
    .populate("project_owner", "name")
    .populate("stage_history.user", "name")
    .sort({ rfq_dated: -1 })
    .lean();

  const rfqRows = rfqs.map(rfqRow);
  const tables = rfqs.map(detailTables);
  const rows = { rfqs: rfqRows };
  Object.keys(tables[0] || detailTables({})).forEach((name) => { rows[name] = tables.flatMap((table) => table[name]); });

  return {
    total_rfqs: rfqRows.length,
    active_rfqs: countWhere(rfqRows, "rfq_status", "ACTIVE"),
    awarded_rfqs: countWhere(rfqRows, "rfq_status", "AWARDED"),
    total_quoted_amount: rfqRows.reduce((sum, row) => sum + (row.quoted_price || 0), 0),
    lost_rfqs: countWhere(rfqRows, "rfq_status", "LOST"),
    rows,
  };
};
