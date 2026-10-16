import RfqItem from "../models/rfqItemModel.js";
import Component from "../models/componentModel.js";
import User from "../../auth/userModel.js";
import { ROLES } from "../../../constants/roles.js";
import { CURRENT_STAGE, RFQ_STATUS, WORKFLOW_STAGES } from "../../../constants/rfqEnums.js";
import { STAGES, TARGET_DATE_STAGES, getStageStatus, transitionRfq, editStage as editStageRecord, getWorkflowSummary, setPhaseTargets, savePurchaseItems } from "../services/rfqWorkflow.js";
import { rfqScope, permissionsFor, reportDepartmentsFor } from "../services/rfqPermissions.js";
import { currentStageInfo } from "../services/rfqStageSummary.js";
import { buildRfqReport } from "../services/rfqReport.js";

// Multi-select filters travel as one query value, e.g. ?customer=Acme|Bosch ("|" cannot clash with names that contain commas).
export const MULTI_VALUE_SEPARATOR = "|";
// The RFQ details (customer, parts, owner...) are the record of this stage, so editing the RFQ marks it as edited.
const RFQ_RECEIVED_STAGE = "CUSTOMER_RFQ_RECEIVED";
// Month filter (same idea as the Finance registers): by default only the latest months are sent, the dropdown lists every
// month that has an RFQ, and picking another month fetches it on demand (?month=2026-03|2025-12).
const DEFAULT_MONTH_COUNT = 3;
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_KEY_FORMAT = "%Y-%m";
const monthRange = (key) => {
  const [year, month] = key.split("-").map(Number);
  return { rfq_dated: { $gte: new Date(Date.UTC(year, month - 1, 1)), $lt: new Date(Date.UTC(year, month, 1)) } };
};
const monthLabel = (key) => new Date(`${key}-01T00:00:00Z`).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
// Every month that has an RFQ the user may see, newest first.
const availableMonthKeys = async (scope) => {
  const months = await RfqItem.aggregate([
    { $match: { ...scope, rfq_dated: { $ne: null } } },
    { $group: { _id: { $dateToString: { format: MONTH_KEY_FORMAT, date: "$rfq_dated" } } } },
    { $sort: { _id: -1 } },
  ]);
  return months.map(({ _id }) => _id);
};

const FILTER_FIELDS = ["customer", "project_name", "project_owner", "current_stage", "rfq_status"];
const LIST_FIELDS = "rfq_number customer project_owner project_lead project_name rfq_dated rfq_target_date stage_schedule main_parts main_part_no sub_part_no volume_per_annum_nos rfq_status current_stage costing stage_attachments stage_remarks createdAt updatedAt";
const humanize = (value) => value.replaceAll("_", " ");
const toOptions = (values) => values.filter(Boolean).sort((a, b) => a.localeCompare(b)).map((value) => ({ label: value, value }));

// The owner is always an active NPD user; the dropdown only offers those, and the server re-checks it.
const resolveOwner = async (ownerId) => {
  const owner = await User.findOne({ _id: ownerId, role: ROLES.NPD_USER, isActive: true }).select("name");
  if (!owner) throw new Error("Project owner must be an active NPD user");
  return owner;
};


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
    const owner = await resolveOwner(body.project_owner);
    body.project_owner = owner._id;
    body.project_lead = owner.name;
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
    FILTER_FIELDS.forEach((key) => {
      if (req.query[key]) filter[key] = { $in: String(req.query[key]).split(MULTI_VALUE_SEPARATOR) };
    });
    const scope = rfqScope(req.user);
    const requestedMonths = String(req.query.month || "").split(MULTI_VALUE_SEPARATOR).filter((key) => MONTH_KEY.test(key));
    const monthKeys = requestedMonths.length ? requestedMonths : (await availableMonthKeys(scope)).slice(0, DEFAULT_MONTH_COUNT);
    if (monthKeys.length) filter.$or = monthKeys.map(monthRange);
    // The user's scope is applied last so a filter can never widen what an NPD user may see.
    const rows = await RfqItem.find({ ...filter, ...scope })
      .select(LIST_FIELDS)
      .populate("project_owner", "name")
      .sort({ createdAt: -1 }).lean();
    res.json(rows.map(({ stage_remarks, ...row }) => {
      const { due_date, status, latest_remark } = currentStageInfo({ ...row, stage_remarks });
      return {
        ...row,
        project_owner_name: row.project_owner?.name || row.project_lead,
        current_due_date: due_date,
        current_stage_status: status,
        latest_remark,
        stage_schedule: (row.stage_schedule || []).map((item) => ({ ...item, status: getStageStatus(row, item.stage) })),
      };
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Every filter dropdown is fed from here, so options always reflect what the user is actually allowed to see.
export const getFilterOptions = async (req, res) => {
  try {
    const scope = rfqScope(req.user);
    const [customers, projectNames, ownerIds] = await Promise.all(
      ["customer", "project_name", "project_owner"].map((field) => RfqItem.distinct(field, scope)),
    );
    const owners = await User.find({ _id: { $in: ownerIds } }).select("name").sort({ name: 1 }).lean();
    const monthKeys = await availableMonthKeys(scope);
    res.json({
      month: monthKeys.map((key) => ({ label: monthLabel(key), value: key })),
      defaults: { month: monthKeys.slice(0, DEFAULT_MONTH_COUNT) }, // what the register loads when no month is picked
      customer: toOptions(customers),
      project_name: toOptions(projectNames),
      project_owner: owners.map((owner) => ({ label: owner.name, value: String(owner._id) })),
      current_stage: CURRENT_STAGE.map((stage) => ({ label: humanize(stage), value: stage })),
      rfq_status: RFQ_STATUS.map((status) => ({ label: humanize(status), value: status })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const getOwners = async (_req, res) => {
  try {
    const owners = await User.find({ role: ROLES.NPD_USER, isActive: true }).select("name").sort({ name: 1 }).lean();
    res.json(owners.map((owner) => ({ label: owner.name, value: String(owner._id) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const getRfqItemById = async (req, res) => {
  const row = await RfqItem.findById(req.params.rfqItemID)
    .populate("project_owner", "name email role")
    .populate("stage_history.user", "name role")
    .lean();
  if (!row) return res.status(404).json({ error: "RFQ not found" });
  res.json({ ...row, permissions: permissionsFor(req.user, req.rfq) });
};

export const updateRfqItem = async (req, res) => {
  try {
    const body = { ...req.body };
    delete body.project_lead; // derived from project_owner below
    if (body.project_owner) {
      const owner = await resolveOwner(body.project_owner);
      body.project_lead = owner.name;
    } else delete body.project_owner;
    if (body.main_parts) Object.assign(body, normalizePartHierarchy(body));
    // Target dates are fixed at RFQ creation. Completion dates are server-controlled by transitionRfq.
    [
      "stage_schedule", "stage_history", "stage_remarks", "current_stage", "customer_decision", "customer_approval_pilot", "technical_review", "feasibility_status",
      "tooling_category", "dfm_review", "commercial_review", "costing", "rfq_status", "awarded_date",
      "proto_capex", "proto_build", "capex_status", "pilot_build", "customer_approval", "actual_bom_defined_date", "mass_production", "purchase_order", "linked_project", "purchase_items", "stage_attachments",
    ].forEach((key) => delete body[key]);
    const row = await RfqItem.findByIdAndUpdate(
      req.params.rfqItemID,
      { $set: { ...body, "stage_history.$[entry].updatedAt": new Date() } },
      { new: true, runValidators: true, arrayFilters: [{ "entry.stage": RFQ_RECEIVED_STAGE }] },
    );
    if (!row) return res.status(404).json({ error: "RFQ not found" });
    res.json({ success: true, rfqItem: row });
  } catch (e) { res.status(400).json({ error: e.message }); }
};

export const deleteRfqItem = async (req, res) => {
  try {
    const row = await RfqItem.findById(req.params.rfqItemID).select("linked_project");
    if (!row) return res.status(404).json({ error: "RFQ not found" });
    if (row.linked_project) return res.status(409).json({ success: false, error: "This RFQ was converted to a project and cannot be deleted" });
    await Component.deleteMany({ rfq_item: row._id }); // its BOM / prototype components go with it
    await row.deleteOne();
    res.json({ success: true, message: "RFQ deleted" });
  } catch (e) { res.status(400).json({ success: false, error: e.message }); }
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

export const editStage = async (req, res) => {
  try {
    await editStageRecord(req.params.rfqItemID, req.params.stage, req.body);
    res.json({ success: true, message: "Stage updated" });
  } catch (e) { res.status(400).json({ success: false, error: e.message }); }
};

export const workflow = async (req, res) => {
  try {
    const result = await getWorkflowSummary(req.params.rfqItemID);
    if (!result) return res.status(404).json({ error: "RFQ not found" });
    res.json({ ...result, permissions: permissionsFor(req.user, req.rfq) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const purchaseItems = async (req, res) => {
  try {
    const rfq = await savePurchaseItems(req.params.rfqItemID, req.body.stage, req.body.items, req.user);
    res.json({ success: true, message: "Purchase items saved", purchase_items: rfq.purchase_items });
  } catch (e) { res.status(400).json({ success: false, error: e.message }); }
};

// Remarks are append-only and can be added any number of times to any stage by anyone who can see the RFQ.
export const addRemark = async (req, res) => {
  try {
    const { stage, text } = req.body;
    if (!WORKFLOW_STAGES.includes(stage)) throw new Error("Invalid workflow stage");
    if (!text?.trim()) throw new Error("Remark cannot be empty");
    const row = await RfqItem.findByIdAndUpdate(
      req.params.rfqItemID,
      {
        $push: { stage_remarks: { stage, text, user: req.user._id, user_name: req.user.name, user_role: req.user.role } },
        $set: { "stage_history.$[entry].updatedAt": new Date() }, // a remark on a submitted stage counts as an edit of that stage
      },
      { new: true, runValidators: true, projection: { stage_remarks: 1 }, arrayFilters: [{ "entry.stage": stage }] },
    );
    res.status(201).json({ success: true, message: "Remark added", remarks: row.stage_remarks });
  } catch (e) { res.status(400).json({ success: false, error: e.message }); }
};

// Same payload shape the Reports page consumes from /dashboard/reports, so it can be used directly or merged there.
export const getRfqReport = async (req, res) => {
  try {
    res.json({ reports: { rfq: await buildRfqReport(req.user, req.query) }, allowed_departments: reportDepartmentsFor(req.user.role) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};