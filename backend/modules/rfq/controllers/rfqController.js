import RfqItem from "../models/rfqItemModel.js";
import { STAGES, TARGET_DATE_STAGES, getStageStatus, transitionRfq, getWorkflowSummary, setPhaseTargets, savePurchaseItems } from "../services/rfqWorkflow.js";

const normalizeStageSchedule = (schedule) => {
  if (!Array.isArray(schedule)) throw new Error("Initial RFQ target dates are required");
  const byStage = new Map(schedule.map((item) => [item.stage, item]));
  const normalized = STAGES.map((stage) => {
    const item = byStage.get(stage) || {};
    if (TARGET_DATE_STAGES.has(stage) && [
      "CUSTOMER_RFQ_RECEIVED", "DOCUMENT_REVIEW", "TECHNICAL_REVIEW", "FEASIBILITY_REVIEW",
      "DFM_REVIEW", "COMMERCIAL_REVIEW", "COSTING", "RFQ_SUBMITTED"
    ].includes(stage) && !item.target_date) {
      throw new Error(`Target date is required for ${stage.replaceAll("_", " ")}`);
    }
    if (item.target_date) {
      const target = new Date(item.target_date);
      if (Number.isNaN(target.getTime())) throw new Error(`Invalid target date for ${stage.replaceAll("_", " ")}`);
      return { stage, target_date: target };
    }
    return { stage, target_date: undefined };
  });
  const unknown = schedule.some((item) => !STAGES.includes(item.stage));
  if (unknown) throw new Error("Invalid workflow stage schedule");
  return normalized;
};

const normalizePartHierarchy = (body) => {
  const normalized = { ...body };
  if (!Array.isArray(normalized.main_parts) || normalized.main_parts.length === 0) {
    normalized.main_parts = [{
      main_part_no: normalized.main_part_no,
      description: normalized.description || "",
      volume_per_annum_nos: Number(normalized.volume_per_annum_nos),
      rfq_target_date: normalized.rfq_target_date,
      sub_parts: normalized.sub_part_no ? [{ sub_part_no: normalized.sub_part_no, qty_per_main_part: 1 }] : [],
    }];
  }
  normalized.main_parts = normalized.main_parts.map((main) => ({
    ...main,
    volume_per_annum_nos: Number(main.volume_per_annum_nos),
    sub_parts: Array.isArray(main.sub_parts) ? main.sub_parts.map((sub) => ({
      ...sub, qty_per_main_part: Number(sub.qty_per_main_part || 1),
    })) : [],
  }));

  const mainNos = new Set();
  for (const main of normalized.main_parts) {
    if (!main.main_part_no?.trim()) throw new Error("Every main part requires a main_part_no");
    if (mainNos.has(main.main_part_no.trim())) throw new Error(`Duplicate main part number: ${main.main_part_no}`);
    mainNos.add(main.main_part_no.trim());
    const subNos = new Set();
    for (const sub of main.sub_parts) {
      if (!sub.sub_part_no?.trim()) throw new Error(`Every sub part under ${main.main_part_no} requires a sub_part_no`);
      if (subNos.has(sub.sub_part_no.trim())) throw new Error(`Duplicate sub part ${sub.sub_part_no} under ${main.main_part_no}`);
      subNos.add(sub.sub_part_no.trim());
    }
  }

  normalized.main_part_no = normalized.main_part_no || normalized.main_parts[0].main_part_no;
  normalized.volume_per_annum_nos = Number(normalized.volume_per_annum_nos || normalized.main_parts[0].volume_per_annum_nos);
  normalized.sub_part_no = normalized.sub_part_no || normalized.main_parts[0].sub_parts?.[0]?.sub_part_no || "";
  return normalized;
};

export const createRfqItem = async (req, res) => {
  try {
    const body = normalizePartHierarchy(req.body);
    body.stage_schedule = normalizeStageSchedule(body.stage_schedule);
    body.stage_schedule = body.stage_schedule.map((item) => item.stage === "CUSTOMER_RFQ_RECEIVED" ? { ...item, completed_date: new Date() } : item);
    const rfqItem = await RfqItem.create({
      ...body,
      current_stage: "DOCUMENT_REVIEW",
      stage_history: [{
        stage: "CUSTOMER_RFQ_RECEIVED", action: "COMPLETED", user: req.user._id, note: "RFQ received", completedAt: new Date(),
      }],
    });
    res.status(201).json({ success: true, message: "RFQ created", rfqItem });
  } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const getAllRfqItems = async (req, res) => {
  try {
    const filter = {};
    ["rfq_status", "customer", "project_lead", "current_stage"].forEach((k) => {
      if (req.query[k]) filter[k] = req.query[k];
    });
    const rows = await RfqItem.find(filter)
      .select("rfq_number customer project_lead project_name rfq_dated rfq_target_date stage_schedule main_parts main_part_no sub_part_no volume_per_annum_nos rfq_status current_stage costing stage_attachments createdAt")
      .sort({ createdAt: -1 }).lean();
    res.json(rows.map((row) => ({
      ...row,
      stage_schedule: (row.stage_schedule || []).map((item) => ({ ...item, status: getStageStatus(row, item.stage) })),
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const getRfqItemById = async (req, res) => {
  const row = await RfqItem.findById(req.params.rfqItemID).lean();
  if (!row) return res.status(404).json({ error: "RFQ not found" });
  res.json(row);
};

export const updateRfqItem = async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.main_parts) Object.assign(body, normalizePartHierarchy(body));
    // Target dates are fixed at RFQ creation. Completion dates are server-controlled by transitionRfq.
    [
      "stage_schedule", "stage_history", "current_stage", "customer_decision", "customer_approval_pilot", "technical_review", "feasibility_status",
      "tooling_category", "dfm_review", "commercial_review", "costing", "rfq_status", "awarded_date",
      "proto_capex", "proto_build", "capex_status", "pilot_build", "customer_approval", "actual_bom_defined_date", "mass_production", "purchase_order", "linked_project", "purchase_items", "stage_attachments",
    ].forEach((key) => delete body[key]);
    const row = await RfqItem.findByIdAndUpdate(req.params.rfqItemID, body, { new: true, runValidators: true });
    if (!row) return res.status(404).json({ error: "RFQ not found" });
    res.json({ success: true, rfqItem: row });
  } catch (e) { res.status(400).json({ error: e.message }); }
};

export const deleteRfqItem = async (req, res) => {
  const row = await RfqItem.findByIdAndDelete(req.params.rfqItemID);
  if (!row) return res.status(404).json({ error: "RFQ not found" });
  res.json({ success: true, message: "RFQ deleted" });
};

export const setTargets = async (req, res) => {
  try {
    const rfq = await setPhaseTargets(req.params.rfqItemID, req.body.target_dates);
    res.json({ success: true, message: "Target dates saved", rfqItem: rfq });
  } catch (e) { res.status(400).json({ success: false, error: e.message }); }
};

export const transition = async (req, res) => {
  try {
    const result = await transitionRfq(req.params.rfqItemID, req.body.stage, req.body.data || {}, req.user);
    res.json({ success: true, message: `${req.body.stage} completed`, ...result });
  } catch (e) { res.status(400).json({ success: false, error: e.message }); }
};

export const workflow = async (req, res) => {
  try {
    const result = await getWorkflowSummary(req.params.rfqItemID);
    if (!result) return res.status(404).json({ error: "RFQ not found" });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const purchaseItems = async (req, res) => {
  try {
    const rfq = await savePurchaseItems(req.params.rfqItemID, req.body.stage, req.body.items, req.user);
    res.json({ success: true, message: "Purchase items saved", purchase_items: rfq.purchase_items });
  } catch (e) { res.status(400).json({ success: false, error: e.message }); }
};
