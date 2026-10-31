import RfqItem from "../models/rfqItemModel.js";
import RfqWorkflow from "../models/rfqWorkflowModel.js";
import Component from "../models/componentModel.js";
import User from "../../auth/userModel.js";
import { ROLES } from "../../../constants/roles.js";
import { WORKFLOW_STAGES } from "../../../constants/rfqEnums.js";
import { STAGES, TARGET_PHASES, TARGET_DATE_STAGES, getStageStatus, transitionRfq, editStage as editStageRecord, getWorkflowSummary, setPhaseTargets, savePurchaseItems } from "../services/rfqWorkflow.js";
import { rfqScope, permissionsFor, reportDepartmentsFor, canUpdateRfq, RFQ_STATUS_ROLES, RFQ_EDIT_ROLES } from "../services/rfqPermissions.js";
import { currentStageInfo } from "../services/rfqStageSummary.js";
import { buildRfqReport } from "../services/rfqReport.js";
import { generateRfqNumber } from "../services/rfqNumber.js";
import { incrementCounter } from "../services/counter.js";
import { serializeUploadedFile, uploadRootDirectory } from "../services/storage/index.js";
import path from "node:path";
import fs from "node:fs";

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

const FILTER_FIELDS = ["customer", "project_name", "project_owner"];
const LIST_FIELDS = "rfq_number customer project_owner project_lead project_name rfq_dated rfq_target_date stage_schedule main_parts main_part_no sub_part_no volume_per_annum_nos rfq_status register_status lifecycle_status current_stage costing stage_attachments stage_remarks createdAt updatedAt";
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
    main_part_no: String(main.main_part_no ?? "").trim().toUpperCase(),
    volume_per_annum_nos: Number(main.volume_per_annum_nos),
    sub_parts: Array.isArray(main.sub_parts) ? main.sub_parts.map((sub) => ({
      ...sub, sub_part_no: String(sub.sub_part_no ?? "").trim().toUpperCase(), qty_per_main_part: Number(sub.qty_per_main_part || 1),
    })) : [],
  }));

  const mainNos = new Set();
  for (const main of normalized.main_parts) {
    if (!main.main_part_no?.trim()) throw new Error("Every main part requires a main_part_no");
    if (mainNos.has(main.main_part_no.trim().toUpperCase())) throw new Error(`Duplicate main part number: ${main.main_part_no}`);
    mainNos.add(main.main_part_no.trim().toUpperCase());
    const subNos = new Set();
    for (const sub of main.sub_parts) {
      if (!sub.sub_part_no?.trim()) throw new Error(`Every sub part under ${main.main_part_no} requires a sub_part_no`);
      if (subNos.has(sub.sub_part_no.trim().toUpperCase())) throw new Error(`Duplicate sub part ${sub.sub_part_no} under ${main.main_part_no}`);
      subNos.add(sub.sub_part_no.trim().toUpperCase());
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
    if (!Array.isArray(body.stage_attachments?.CUSTOMER_RFQ_RECEIVED) || !body.stage_attachments.CUSTOMER_RFQ_RECEIVED.length) throw new Error("Upload at least one RFQ attachment");
    for (const main of body.main_parts) {
      if (!Array.isArray(main.drawing_attachments) || !main.drawing_attachments.length) throw new Error(`Upload at least one drawing for main part ${main.main_part_no}`);
      for (const sub of main.sub_parts || []) if (!Array.isArray(sub.drawing_attachments) || !sub.drawing_attachments.length) throw new Error(`Upload at least one drawing for sub part ${sub.sub_part_no}`);
    }
    const requiredSenderFields = ["rfq_send_by_name", "rfq_send_by_contact_number", "rfq_send_by_email"];
    for (const field of requiredSenderFields) {
      if (!String(body[field] || "").trim()) {
        return res.status(400).json({ success: false, error: `${field.replaceAll("_", " ")} is required` });
      }
    }
    const owner = await resolveOwner(body.project_owner);
    body.project_owner = owner._id;
    body.project_lead = owner.name;
    // RFQ creation is intake only: do not collect stage targets, initialize stage history, or start the workflow.
    delete body.stage_schedule;
    delete body.stage_history;
    delete body.current_stage;
    delete body.workflow_started;
    const generatedNumber = await generateRfqNumber(body.rfq_dated, body.project_name);
    const rfqItem = await RfqItem.create({
      ...body,
      rfq_number: generatedNumber,
      register_status: "PENDING",
      workflow_started: false,
      current_stage: null,
      stage_schedule: [],
      stage_history: [],
      stage_remarks: [],
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
    const workflowRows = await RfqWorkflow.find({ parent_rfq: { $in: rows.map((row) => row._id) } })
      .select("parent_rfq main_parts selected_parts current_stage rfq_status lifecycle_status costing purchase_order stage_remarks stage_schedule")
      .lean();
    const byRfq = new Map();
    for (const wf of workflowRows) {
      const key = String(wf.parent_rfq);
      const current = byRfq.get(key) || { workflows: 0, active_workflows: 0, awarded_workflows: 0, lost_workflows: 0, quoted: 0, awarded: 0, latest_remark: null, current_stage: null, rfq_status: "NOT_STARTED", lifecycle_status: "ACTIVE" };
      current.workflows += 1;
      if ((wf.lifecycle_status || "IN_PROGRESS") === "IN_PROGRESS") current.active_workflows += 1;
      if (wf.rfq_status === "AWARDED") current.awarded_workflows += 1;
      if (wf.rfq_status === "LOST") current.lost_workflows += 1;
      const quote = Number(wf.costing?.quoted_price || 0);
      current.quoted += quote;
      if (wf.rfq_status === "AWARDED") current.awarded += Number(wf.purchase_order?.po_qty || 1) * quote;
      const remark = (wf.stage_remarks || []).slice(-1)[0];
      if (remark && (!current.latest_remark || new Date(remark.createdAt) > new Date(current.latest_remark.createdAt))) current.latest_remark = remark;
      current.current_stage = wf.current_stage;
      current.rfq_status = wf.rfq_status || current.rfq_status;
      current.lifecycle_status = wf.lifecycle_status || current.lifecycle_status;
      byRfq.set(key, current);
    }
    let responseRows = rows.map(({ stage_remarks, ...row }) => {
      const wf = byRfq.get(String(row._id)) || { workflows: 0, active_workflows: 0, awarded_workflows: 0, lost_workflows: 0, quoted: 0, awarded: 0, latest_remark: null, current_stage: null, rfq_status: "NOT_STARTED", lifecycle_status: "ACTIVE" };
      return {
        ...row,
        project_owner_name: row.project_owner?.name || row.project_lead,
        main_part_qty: (row.main_parts || []).length,
        sub_part_qty: (row.main_parts || []).reduce((n, part) => n + (part.sub_parts || []).length, 0),
        total_quoted_value: wf.quoted,
        total_awarded_value: wf.awarded,
        workflow_count: wf.workflows,
        total_workflows: wf.workflows,
        active_workflow_count: wf.active_workflows,
        awarded_workflow_count: wf.awarded_workflows,
        lost_workflow_count: wf.lost_workflows,
        awarded_lost_workflow_count: wf.awarded_workflows + wf.lost_workflows,
        latest_remark: wf.latest_remark,
        current_stage: wf.workflows ? wf.current_stage : null,
        rfq_status: wf.workflows ? wf.rfq_status : "NOT_STARTED",
        register_status: row.register_status || (wf.workflows ? "ACTIVE" : "PENDING"),
        lifecycle_status: row.lifecycle_status || "ACTIVE",
        current_due_date: null,
        current_stage_status: "NOT_STARTED",
        stage_schedule: [],
      };
    });
    const requestedStages = String(req.query.current_stage || "").split(MULTI_VALUE_SEPARATOR).filter(Boolean);
    const requestedStatuses = String(req.query.rfq_status || "").split(MULTI_VALUE_SEPARATOR).filter(Boolean);
    const requestedRegisterStatuses = String(req.query.register_status || "").split(MULTI_VALUE_SEPARATOR).filter(Boolean);
    if (requestedStages.length) responseRows = responseRows.filter((row) => requestedStages.includes(row.current_stage || "NOT_STARTED"));
    if (requestedStatuses.length) responseRows = responseRows.filter((row) => requestedStatuses.includes(row.rfq_status));
    if (requestedRegisterStatuses.length) responseRows = responseRows.filter((row) => requestedRegisterStatuses.includes(row.register_status));
    res.json(responseRows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Every filter dropdown is fed from here, so options always reflect what the user is actually allowed to see.
export const getFilterOptions = async (req, res) => {
  try {
    const scope = rfqScope(req.user);
    const [customers, projectNames, ownerIds, workflowStages, workflowStatuses] = await Promise.all([
      ...["customer", "project_name", "project_owner"].map((field) => RfqItem.distinct(field, scope)),
      RfqWorkflow.distinct("current_stage"),
      RfqWorkflow.distinct("rfq_status"),
    ]);
    const owners = await User.find({ _id: { $in: ownerIds } }).select("name").sort({ name: 1 }).lean();
    const monthKeys = await availableMonthKeys(scope);
    res.json({
      month: monthKeys.map((key) => ({ label: monthLabel(key), value: key })),
      defaults: { month: monthKeys.slice(0, DEFAULT_MONTH_COUNT) }, // what the register loads when no month is picked
      customer: toOptions(customers),
      project_name: toOptions(projectNames),
      project_owner: owners.map((owner) => ({ label: owner.name, value: String(owner._id) })),
      current_stage: [{ label: "Not Started", value: "NOT_STARTED" }, ...workflowStages.filter(Boolean).map((stage) => ({ label: humanize(stage), value: stage }))],
      rfq_status: [...new Set([...workflowStatuses.filter(Boolean), "NOT_STARTED"])].map((status) => ({ label: humanize(status), value: status })),
      register_status: ["PENDING", "ACTIVE", "HOLD", "CANCEL", "COMPLETED"].map((status) => ({ label: humanize(status), value: status })),
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
    delete body.rfq_number;
    delete body.register_status;
    delete body.project_lead; // derived from project_owner below
    if (body.project_owner) {
      const owner = await resolveOwner(body.project_owner);
      body.project_lead = owner.name;
    } else delete body.project_owner;
    if (body.main_parts) {
      Object.assign(body, normalizePartHierarchy(body));
      for (const main of body.main_parts) {
        if (!Array.isArray(main.drawing_attachments) || !main.drawing_attachments.length) throw new Error(`Upload at least one drawing for main part ${main.main_part_no}`);
        for (const sub of main.sub_parts || []) if (!Array.isArray(sub.drawing_attachments) || !sub.drawing_attachments.length) throw new Error(`Upload at least one drawing for sub part ${sub.sub_part_no}`);
      }
    }
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
    // Keep selected-part snapshots current when drawings/descriptions arrive later, without
    // touching each workflow's independent stage state, remarks, or history.
    if (body.main_parts) {
      const workflows = await RfqWorkflow.find({ parent_rfq: row._id });
      for (const instance of workflows) {
        const refreshed = [];
        for (const selection of instance.selected_parts || []) {
          const sourcePart = row.main_parts.id(selection.main_part_id);
          if (!sourcePart) {
            const oldPart = instance.main_parts.id(selection.main_part_id);
            if (oldPart) refreshed.push(oldPart.toObject());
            continue;
          }
          const part = sourcePart.toObject();
          const subIds = (selection.sub_part_ids || []).map(String);
          if (subIds.length) part.sub_parts = part.sub_parts.filter((sub) => subIds.includes(String(sub._id)));
          refreshed.push(part);
        }
        instance.main_parts = refreshed;
        await instance.save();
      }
    }
    res.json({ success: true, rfqItem: row });
  } catch (e) { res.status(400).json({ error: e.message }); }
};

export const deleteRfqItem = async (req, res) => {
  try {
    const row = await RfqItem.findById(req.params.rfqItemID).select("linked_project");
    if (!row) return res.status(404).json({ error: "RFQ not found" });
    const convertedWorkflow = await RfqWorkflow.exists({ parent_rfq: row._id, linked_project: { $exists: true, $ne: null } });
    if (row.linked_project || convertedWorkflow) return res.status(409).json({ success: false, error: "This RFQ or one of its workflows was converted to a project and cannot be deleted" });
    const workflowIds = await RfqWorkflow.find({ parent_rfq: row._id }).distinct("_id");
    await Component.deleteMany({ $or: [{ rfq_item: row._id }, { workflow_instance: { $in: workflowIds } }] });
    await RfqWorkflow.deleteMany({ parent_rfq: row._id });
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

export const transition = async (_req, res) => res.status(409).json({ success: false, error: "RFQ records do not run stages. Start a batch workflow and perform stage actions inside that workflow." });

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
    const workflow = await RfqWorkflow.findOne({ _id: req.params.workflowID, parent_rfq: req.params.rfqItemID });
    if (!workflow) return res.status(404).json({ error: "Workflow not found" });
    await assertWorkflowCanMutate(workflow, req.params.rfqItemID);
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
// Independent workflow instances. Each instance snapshots the selected part hierarchy
// and owns its own lifecycle fields/history in the rfq_workflows collection.
export const getRfqWorkflows = async (req, res) => {
  try {
    const rows = await RfqWorkflow.find({ parent_rfq: req.params.rfqItemID })
      .select("workflow_number workflow_name rfq_number project_name customer selected_parts main_parts current_stage rfq_status lifecycle_status stage_schedule costing purchase_order stage_remarks createdAt updatedAt linked_project")
      .sort({ createdAt: 1 }).lean();
    res.json(rows.map((row) => {
      const selectedParts = (row.selected_parts || []).map((part) => {
        const subIds = (part.sub_part_ids || []).map(String);
        const legacyWholeMain = part.main_part_selected === undefined && subIds.length === 0;
        const sourceMain = (row.main_parts || []).find((main) => String(main._id) === String(part.main_part_id));
        return { ...part, main_part_selected: Boolean(part.main_part_selected || legacyWholeMain), sub_part_ids: legacyWholeMain ? (sourceMain?.sub_parts || []).map((sub) => String(sub._id)) : subIds };
      });
      return {
      ...row,
      selected_parts: selectedParts,
      main_part_qty: selectedParts.filter((part) => part.main_part_selected).length,
      sub_part_qty: selectedParts.reduce((count, part) => count + (part.sub_part_ids || []).length, 0),
      quoted_value: Number(row.costing?.quoted_price || 0),
      awarded_value: row.rfq_status === "AWARDED" ? Number(row.costing?.quoted_price || 0) * Number(row.purchase_order?.po_qty || 1) : 0,
      latest_remark: (row.stage_remarks || []).slice(-1)[0] || null,
      status: row.lifecycle_status || (row.current_stage === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS"),
    };
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const createRfqWorkflow = async (req, res) => {
  let lockAcquired = false;
  const parentId = req.params.rfqItemID;
  const releaseLock = async () => {
    if (lockAcquired) {
      await RfqItem.updateOne({ _id: parentId }, { $unset: { workflow_creation_lock_until: 1 } });
      lockAcquired = false;
    }
  };
  try {
    const parent = await RfqItem.findById(req.params.rfqItemID);
    if (!parent) return res.status(404).json({ error: "RFQ not found" });
    if (!canUpdateRfq(req.user, parent)) return res.status(403).json({ error: "Only Scrum Master, Super User or Admin can start a workflow" });
    if ((parent.lifecycle_status || "ACTIVE") !== "ACTIVE" || ["HOLD", "CANCEL", "COMPLETED"].includes(parent.register_status)) return res.status(409).json({ error: `Cannot create a workflow while RFQ is ${String(parent.register_status || parent.lifecycle_status).toLowerCase()}` });
    // Lease-based parent lock prevents simultaneous workflow starts from claiming the same part.
    const lockNow = new Date();
    const lockedParent = await RfqItem.findOneAndUpdate(
      { _id: parent._id, $or: [{ workflow_creation_lock_until: { $exists: false } }, { workflow_creation_lock_until: { $lt: lockNow } }] },
      { $set: { workflow_creation_lock_until: new Date(lockNow.getTime() + 120000) } },
      { new: true }
    );
    if (!lockedParent) return res.status(409).json({ error: "Another batch workflow is being created for this RFQ. Please retry shortly." });
    lockAcquired = true;
    const initialTargets = req.body.initial_target_dates;
    const initialStages = TARGET_PHASES.INITIAL.filter((stage) => stage !== "CUSTOMER_RFQ_RECEIVED");
    if (!Array.isArray(initialTargets)) throw new Error("Target dates for stages 2 through 8 are required before starting the workflow");
    const initialDateMap = new Map(initialTargets.map((item) => [item.stage, item.target_date]));
    if (initialTargets.length !== initialStages.length || initialStages.some((stage) => !initialDateMap.has(stage) || !initialDateMap.get(stage) || Number.isNaN(new Date(initialDateMap.get(stage)).getTime()))) {
      throw new Error("Provide a valid target date for every stage from Stage 2 through Stage 8");
    }
    for (const stage of initialDateMap.keys()) if (!initialStages.includes(stage)) throw new Error(`Invalid initial target date stage: ${stage}`);
    const initialDate = new Date(initialDateMap.get("DOCUMENT_REVIEW"));
    const selection = req.body.selected_parts;
    if (!Array.isArray(selection) || selection.length === 0) throw new Error("Select at least one main part or subpart");

    const existing = await RfqWorkflow.find({ parent_rfq: parent._id }).select("selected_parts").lean();
    const usedMainIds = new Set();
    const usedSubIds = new Set();
    for (const wf of existing) for (const part of wf.selected_parts || []) {
      const subIds = (part.sub_part_ids || []).map(String);
      // Compatibility with the earlier workflow prototype, where an empty sub-part list meant the whole main-part hierarchy.
      const legacyWholeMain = part.main_part_selected === undefined && subIds.length === 0;
      if (part.main_part_selected || legacyWholeMain) usedMainIds.add(String(part.main_part_id));
      for (const subId of subIds) usedSubIds.add(subId);
      if (legacyWholeMain) {
        const legacyMain = parent.main_parts.id(part.main_part_id);
        for (const sub of legacyMain?.sub_parts || []) usedSubIds.add(String(sub._id));
      }
    }

    const selectedParts = [];
    const workflowParts = [];
    const seenMain = new Set();
    const seenSubs = new Set();
    for (const item of selection) {
      const main = parent.main_parts.id(item.main_part_id);
      if (!main) throw new Error(`Main part ${item.main_part_id} does not belong to this RFQ`);
      const mainSelected = Boolean(item.main_part_selected);
      const requestedSubs = Array.isArray(item.sub_part_ids) ? item.sub_part_ids.map(String) : [];
      if (!mainSelected && requestedSubs.length === 0) continue;
      if (seenMain.has(String(main._id))) throw new Error(`Duplicate selection for main part ${main.main_part_no}`);
      seenMain.add(String(main._id));
      if (mainSelected && usedMainIds.has(String(main._id))) throw new Error(`Main part ${main.main_part_no} is already assigned to another workflow`);
      for (const subId of requestedSubs) {
        if (!main.sub_parts.id(subId)) throw new Error(`Subpart ${subId} does not belong to main part ${main.main_part_no}`);
        if (seenSubs.has(subId)) throw new Error(`Subpart ${subId} was selected more than once`);
        if (usedSubIds.has(subId)) throw new Error(`Subpart ${subId} under ${main.main_part_no} is already assigned to another workflow`);
        seenSubs.add(subId);
      }
      selectedParts.push({ main_part_id: main._id, main_part_selected: mainSelected, sub_part_ids: requestedSubs });
      const part = main.toObject();
      part.sub_parts = part.sub_parts.filter((sub) => requestedSubs.includes(String(sub._id)));
      workflowParts.push(part);
    }
    if (!selectedParts.length) throw new Error("Select at least one main part or subpart");

    // Atomic per-RFQ workflow numbering; safe when two users start workflows concurrently.
    const workflowCounter = await incrementCounter(`workflow:${parent._id}`);
    const workflowNumber = `${parent.rfq_number}-WF-${String(workflowCounter.sequence).padStart(3, "0")}`;
    const source = parent.toObject();
    ["_id", "__v", "createdAt", "updatedAt", "linked_project"].forEach((key) => delete source[key]);
    source.parent_rfq = parent._id;
    source.workflow_number = workflowNumber;
    source.workflow_name = workflowNumber;
    source.initial_target_date = initialDate;
    source.workflow_started = true;
    source.lifecycle_status = "IN_PROGRESS";
    source.paused_by_parent = false;
    source.status_before_parent_pause = undefined;
    source.main_parts = workflowParts;
    source.selected_parts = selectedParts;
    source.main_part_no = workflowParts[0].main_part_no;
    source.sub_part_no = workflowParts[0].sub_parts?.[0]?.sub_part_no || "";
    source.volume_per_annum_nos = workflowParts.filter((part) => selectedParts.some((selection) => String(selection.main_part_id) === String(part._id) && selection.main_part_selected)).reduce((sum, part) => sum + Number(part.volume_per_annum_nos || 0), 0) || Number(parent.volume_per_annum_nos || 1);
    source.current_stage = "DOCUMENT_REVIEW";
    source.rfq_status = "WAITING_FOR_APPROVAL";
    source.customer_decision = undefined;
    source.awarded_date = undefined;
    source.costing = { status: "COSTING_IN_PROGRESS" };
    source.technical_review = { status: "IN_PROGRESS" };
    source.feasibility_status = undefined;
    source.tooling_category = undefined;
    source.dfm_review = { status: "IN_PROGRESS" };
    source.commercial_review = { status: "IN_PROGRESS" };
    source.proto_capex = undefined;
    source.proto_build = { status: "NOT_STARTED" };
    source.capex_status = "NOT_STARTED";
    source.pilot_build = { status: "NOT_STARTED" };
    source.customer_approval_pilot = { approved: false };
    source.customer_approval = { approved: false };
    source.actual_bom_defined_date = undefined;
    source.purchase_order = undefined;
    source.mass_production = { status: "NOT_READY" };
    source.linked_project = undefined;
    source.purchase_items = [];
    source.stage_attachments = { CUSTOMER_RFQ_RECEIVED: parent.stage_attachments?.get?.("CUSTOMER_RFQ_RECEIVED") || parent.stage_attachments?.CUSTOMER_RFQ_RECEIVED || [] };
    source.stage_history = [{ stage: "CUSTOMER_RFQ_RECEIVED", action: "COMPLETED", user: req.user._id, note: `Workflow ${workflowNumber} started`, completedAt: new Date() }];
    source.stage_remarks = [];
    source.stage_schedule = STAGES.map((stage) => ({ stage, target_date: initialDateMap.has(stage) ? new Date(initialDateMap.get(stage)) : undefined, completed_date: stage === "CUSTOMER_RFQ_RECEIVED" ? new Date() : undefined }));
    const workflow = await RfqWorkflow.create(source);
    // Only activate if a privileged status change did not happen while the workflow was being prepared.
    const activated = await RfqItem.findOneAndUpdate(
      { _id: parent._id, register_status: { $in: ["PENDING", "ACTIVE"] }, lifecycle_status: "ACTIVE" },
      { $set: { workflow_started: true, register_status: "ACTIVE" } },
      { new: true }
    );
    if (!activated) {
      await RfqWorkflow.deleteOne({ _id: workflow._id });
      await releaseLock();
      return res.status(409).json({ error: "RFQ status changed while the workflow was being started. Refresh and try again." });
    }
    await releaseLock();
    res.status(201).json({ success: true, message: "Batch workflow started", workflow });
  } catch (e) {
    try { await releaseLock(); } catch (releaseError) { console.error("Unable to release RFQ workflow lock", releaseError); }
    res.status(400).json({ success: false, error: e.message });
  }
};

export const updateRfqLifecycle = async (req, res) => {
  try {
    const rfq = await RfqItem.findById(req.params.rfqItemID);
    if (!rfq) return res.status(404).json({ error: "RFQ not found" });
    const status = String(req.body.status || "").toUpperCase();
    if (!RFQ_STATUS_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: "Only Admin, Super User or NPD Manager can change RFQ status" });
    }
    if (!["ACTIVE", "HOLD", "CANCEL", "COMPLETED"].includes(status)) return res.status(400).json({ error: "Invalid RFQ status" });
    if (status === "ACTIVE" && rfq.register_status !== "HOLD") return res.status(409).json({ error: "Only an RFQ on Hold can be resumed" });
    const nextStatus = status === "ACTIVE" && !(await RfqWorkflow.exists({ parent_rfq: rfq._id })) ? "PENDING" : status;
    const allowedCurrent = status === "ACTIVE" ? ["HOLD"] : ["PENDING", "ACTIVE", "HOLD"];
    const now = new Date();
    const parentLifecycle = nextStatus === "HOLD" ? "PAUSED" : nextStatus === "CANCEL" ? "CANCELLED" : nextStatus === "COMPLETED" ? "COMPLETED" : "ACTIVE";
    const updated = await RfqItem.findOneAndUpdate(
      { _id: rfq._id, register_status: { $in: allowedCurrent } },
      { $set: {
        register_status: nextStatus,
        lifecycle_status: parentLifecycle,
        lifecycle_updated_at: now,
        lifecycle_reason: String(req.body.reason || "").trim()
      } },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(409).json({ error: "RFQ status cannot be changed from its current state" });

    if (nextStatus === "HOLD") {
      await RfqWorkflow.updateMany(
        { parent_rfq: rfq._id, lifecycle_status: "IN_PROGRESS" },
        { $set: { lifecycle_status: "PAUSED", paused_by_parent: true, status_before_parent_pause: "IN_PROGRESS", lifecycle_updated_at: now } }
      );
    } else if (nextStatus === "ACTIVE" || nextStatus === "PENDING") {
      await RfqWorkflow.updateMany(
        { parent_rfq: rfq._id, lifecycle_status: "PAUSED", paused_by_parent: true },
        { $set: { lifecycle_status: "IN_PROGRESS", paused_by_parent: false, lifecycle_updated_at: now }, $unset: { status_before_parent_pause: 1 } }
      );
    } else {
      const stoppedStatus = nextStatus === "COMPLETED" ? "STOPPED_BY_RFQ_COMPLETION" : "STOPPED_BY_RFQ_CANCELLATION";
      await RfqWorkflow.updateMany(
        { parent_rfq: rfq._id, $or: [{ lifecycle_status: "IN_PROGRESS" }, { lifecycle_status: "PAUSED", paused_by_parent: true }] },
        { $set: { lifecycle_status: stoppedStatus, paused_by_parent: false, lifecycle_updated_at: now }, $unset: { status_before_parent_pause: 1 } }
      );
    }
    res.json({ success: true, register_status: updated.register_status });
  } catch (e) { res.status(400).json({ error: e.message }); }
};

export const getRfqWorkflowInstance = async (req, res) => {
  try {
    const workflow = await RfqWorkflow.findOne({ _id: req.params.workflowID, parent_rfq: req.params.rfqItemID })
      .populate("project_owner", "name email role")
      .populate("stage_history.user", "name role").lean();
    if (!workflow) return res.status(404).json({ error: "Workflow not found" });
    const summary = await getWorkflowSummary(workflow._id, RfqWorkflow);
    if (summary?.rfq) {
      const selections = summary.rfq.selected_parts || [];
      summary.rfq.main_parts = (summary.rfq.main_parts || []).map((main) => {
        const selection = selections.find((item) => String(item.main_part_id) === String(main._id));
        const legacyWholeMain = selection && selection.main_part_selected === undefined && !(selection.sub_part_ids || []).length;
        return { ...main, workflow_selected_main_part: Boolean(selection?.main_part_selected || legacyWholeMain) };
      });
    }
    const parent = await RfqItem.findById(req.params.rfqItemID).select("lifecycle_status").lean();
    const lifecycleStatus = workflow.lifecycle_status || (workflow.current_stage === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS");
    const permissions = permissionsFor(req.user, workflow);
    const workflowActive = lifecycleStatus === "IN_PROGRESS" && (parent?.lifecycle_status || "ACTIVE") === "ACTIVE";
    permissions.can_update = permissions.can_update && workflowActive;
    permissions.can_edit = permissions.can_edit && workflowActive;
    res.json({ ...summary, lifecycle_status: lifecycleStatus, parent_lifecycle_status: parent?.lifecycle_status || "ACTIVE", permissions });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const transitionWorkflowInstance = async (req, res) => {
  try {
    const workflow = await RfqWorkflow.findOne({ _id: req.params.workflowID, parent_rfq: req.params.rfqItemID });
    if (!workflow) return res.status(404).json({ error: "Workflow not found" });
    const parent = await RfqItem.findById(req.params.rfqItemID).select("lifecycle_status");
    if (parent?.lifecycle_status !== "ACTIVE") throw new Error(`Parent RFQ is ${String(parent?.lifecycle_status || "ACTIVE").toLowerCase()} and workflow stages are locked`);
    if (workflow.lifecycle_status !== "IN_PROGRESS") throw new Error(`Workflow is ${String(workflow.lifecycle_status || "IN_PROGRESS").toLowerCase().replaceAll("_", " ")} and cannot advance`);
    const result = await transitionRfq(workflow._id, req.body.stage, req.body.data || {}, req.user, RfqWorkflow);
    if (result?.rfq?.current_stage === "COMPLETED") { workflow.lifecycle_status = "COMPLETED"; workflow.lifecycle_updated_at = new Date(); await workflow.save(); }
    res.json({ success: true, message: `${req.body.stage} completed`, ...result });
  } catch (e) { res.status(400).json({ success: false, error: e.message }); }
};

const assertWorkflowCanMutate = async (workflow, parentRfqId) => {
  const parent = await RfqItem.findById(parentRfqId).select("lifecycle_status").lean();
  if (!parent || (parent.lifecycle_status || "ACTIVE") !== "ACTIVE") throw new Error("Parent RFQ is not active; workflow changes are locked");
  if ((workflow.lifecycle_status || "IN_PROGRESS") !== "IN_PROGRESS") throw new Error("Workflow is not in progress; workflow changes are locked");
};

export const addWorkflowRemark = async (req, res) => {
  try {
    const { stage, text } = req.body;
    if (!WORKFLOW_STAGES.includes(stage)) throw new Error("Invalid workflow stage");
    const workflow = await RfqWorkflow.findOne({ _id: req.params.workflowID, parent_rfq: req.params.rfqItemID });
    if (!workflow) return res.status(404).json({ error: "Workflow not found" });
    await assertWorkflowCanMutate(workflow, req.params.rfqItemID);
    if (!text?.trim()) throw new Error("Remark cannot be empty");
    const row = await RfqWorkflow.findOneAndUpdate(
      { _id: req.params.workflowID, parent_rfq: req.params.rfqItemID },
      { $push: { stage_remarks: { stage, text, user: req.user._id, user_name: req.user.name, user_role: req.user.role } }, $set: { "stage_history.$[entry].updatedAt": new Date() } },
      { new: true, runValidators: true, projection: { stage_remarks: 1 }, arrayFilters: [{ "entry.stage": stage }] },
    );
    if (!row) return res.status(404).json({ error: "Workflow not found" });
    res.status(201).json({ success: true, message: "Remark added", remarks: row.stage_remarks });
  } catch (e) { res.status(400).json({ success: false, error: e.message }); }
};

export const editWorkflowStage = async (req, res) => {
  try {
    const workflow = await RfqWorkflow.findOne({ _id: req.params.workflowID, parent_rfq: req.params.rfqItemID });
    if (!workflow) return res.status(404).json({ error: "Workflow not found" });
    await assertWorkflowCanMutate(workflow, req.params.rfqItemID);
    if (!permissionsFor(req.user, workflow).can_edit) return res.status(403).json({ error: "You do not have permission to edit submitted stages" });
    if (req.body.target_date && !RFQ_EDIT_ROLES.includes(req.user.role)) return res.status(403).json({ error: "Only Scrum Master, Super User or Admin can change target dates" });
    const result = await editStageRecord(workflow._id, req.params.stage, req.body, RfqWorkflow);
    res.json({ success: true, message: "Workflow stage updated", rfqItem: result });
  } catch (e) { res.status(400).json({ error: e.message }); }
};

export const workflowPurchaseItems = async (req, res) => {
  try {
    const workflow = await RfqWorkflow.findOne({ _id: req.params.workflowID, parent_rfq: req.params.rfqItemID });
    if (!workflow) return res.status(404).json({ error: "Workflow not found" });
    await assertWorkflowCanMutate(workflow, req.params.rfqItemID);
    const updated = await savePurchaseItems(workflow._id, req.body.stage, req.body.items, req.user, RfqWorkflow);
    res.json({ success: true, message: "Workflow purchase items saved", purchase_items: updated.purchase_items });
  } catch (e) { res.status(400).json({ error: e.message }); }
};

// Upload files through the configured storage driver; MongoDB stores only metadata/URLs.
export const uploadRfqAttachments = async (req, res) => {
  try {
    const files = (req.files || []).map((file) => serializeUploadedFile(file, req));
    res.status(201).json({ success: true, attachments: files });
  } catch (error) { res.status(400).json({ success: false, error: error.message }); }
};

// Adds the computed status (DONE / DELAY_DONE / PENDING / DELAY_PENDING / WAITING) to every stage_schedule entry,
// so the report can label stages exactly like the stage grid does.
const withStageStatus = (doc) => ({
  ...doc,
  stage_attachments: doc.stage_attachments instanceof Map ? Object.fromEntries(doc.stage_attachments) : (doc.stage_attachments || {}),
  stage_schedule: (doc.stage_schedule || []).map((item) => ({ ...item, status: getStageStatus(doc, item.stage) })),
});

export const getRfqDetailReport = async (req, res) => {
  try {
    const rfqDoc = await RfqItem.findOne({ _id: req.params.rfqItemID, ...rfqScope(req.user) })
      .populate("project_owner", "name email").populate("stage_history.user", "name").lean();
    if (!rfqDoc) return res.status(404).json({ error: "RFQ not found" });
    const rfq = withStageStatus(rfqDoc);
    const workflows = (await RfqWorkflow.find({ parent_rfq: rfq._id })
      .populate("stage_history.user", "name").sort({ createdAt: 1 }).lean()).map(withStageStatus);
    // Flat document register: every file in the RFQ, its parts and every workflow, tagged with where it came from.
    const attachments = [];
    const addFiles = (stage, files = [], source = "RFQ") => files.forEach((file) => attachments.push({ ...file, stage, source }));
    Object.entries(rfq.stage_attachments || {}).forEach(([stage, files]) => addFiles(stage, files));
    (rfq.main_parts || []).forEach((part) => {
      addFiles(`Main part ${part.main_part_no}`, part.drawing_attachments, "Part drawing");
      (part.sub_parts || []).forEach((sub) => addFiles(`Sub part ${sub.sub_part_no}`, sub.drawing_attachments, "Part drawing"));
    });
    workflows.forEach((workflow) => Object.entries(workflow.stage_attachments || {}).forEach(([stage, files]) => addFiles(`${workflow.workflow_number} · ${stage}`, files, workflow.workflow_number || "Workflow")));
    res.json({ rfq, workflows, attachments, generated_at: new Date().toISOString() });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

export const downloadRfqAttachment = async (req, res) => {
  try {
    const filename = path.basename(req.params.filename || "");
    const filePath = path.join(uploadRootDirectory, filename);
    if (!filename || !fs.existsSync(filePath)) return res.status(404).json({ error: "Attachment not found" });
    res.setHeader("Content-Disposition", `${req.query.download === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.sendFile(filePath);
  } catch (error) { res.status(400).json({ error: error.message }); }
};
