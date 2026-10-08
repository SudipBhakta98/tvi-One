import RfqItem from "../models/rfqItemModel.js";
import Component from "../models/componentModel.js";
import convertRfqToProject from "./convertRfqToProject.js";

export const STAGES = [
  "CUSTOMER_RFQ_RECEIVED", "DOCUMENT_REVIEW", "TECHNICAL_REVIEW", "FEASIBILITY_REVIEW",
  "DFM_REVIEW", "COMMERCIAL_REVIEW", "COSTING", "RFQ_SUBMITTED", "CUSTOMER_DECISION",
  "CAPEX_PROTO", "PROTO_BUILD", "PROTO_SUBMITTED", "CUSTOMER_APPROVAL_PILOT",
  "CAPEX_PILOT_COMPONENTS", "PILOT_BUILD", "PILOT_DELIVERY", "CUSTOMER_APPROVAL_MASS_PRODUCTION",
  "CUSTOMER_PO_RECEIVED", "ACTUAL_BOM", "MASS_PRODUCTION_HANDOVER",
];

// Targets are created progressively. Customer-controlled/event stages never get targets.
export const TARGET_DATE_STAGES = new Set([
  "CUSTOMER_RFQ_RECEIVED", "DOCUMENT_REVIEW", "TECHNICAL_REVIEW", "FEASIBILITY_REVIEW",
  "DFM_REVIEW", "COMMERCIAL_REVIEW", "COSTING", "RFQ_SUBMITTED", "CAPEX_PROTO", "PROTO_BUILD",
  "PROTO_SUBMITTED", "CAPEX_PILOT_COMPONENTS", "PILOT_BUILD", "PILOT_DELIVERY", "ACTUAL_BOM",
  "MASS_PRODUCTION_HANDOVER",
]);

export const TARGET_PHASES = {
  INITIAL: [
    "CUSTOMER_RFQ_RECEIVED", "DOCUMENT_REVIEW", "TECHNICAL_REVIEW", "FEASIBILITY_REVIEW",
    "DFM_REVIEW", "COMMERCIAL_REVIEW", "COSTING", "RFQ_SUBMITTED",
  ],
  PROTOTYPE: ["CAPEX_PROTO", "PROTO_BUILD", "PROTO_SUBMITTED"],
  PILOT: ["CAPEX_PILOT_COMPONENTS", "PILOT_BUILD", "PILOT_DELIVERY"],
  MASS_PRODUCTION: ["ACTUAL_BOM", "MASS_PRODUCTION_HANDOVER"],
};

// Only Admin / Super User / NPD Manager may complete a stage; SCM Manager also owns the pilot capex stage.
const MANAGER_ROLES = ["ADMIN", "SUPER_USER", "NPD_MANAGER"];
const STAGE_ROLES = { CAPEX_PILOT_COMPONENTS: [...MANAGER_ROLES, "SCM_MANAGER"] };
export const canActOnStage = (role, stage) => (STAGE_ROLES[stage] || MANAGER_ROLES).includes(role);

// Stages that cannot be completed without at least one attachment. Add a stage key here to make its upload mandatory.
const ATTACHMENT_REQUIRED_STAGES = new Set(["CUSTOMER_DECISION", "CUSTOMER_APPROVAL_PILOT", "CUSTOMER_APPROVAL_MASS_PRODUCTION", "CUSTOMER_PO_RECEIVED"]);

// A positive customer answer at these stages opens the next target-date phase (collected in the same request).
const NEXT_PHASE_AFTER = { CUSTOMER_DECISION: "PROTOTYPE", CUSTOMER_APPROVAL_PILOT: "PILOT", CUSTOMER_APPROVAL_MASS_PRODUCTION: "MASS_PRODUCTION" };

// Stages that can carry an optional list of purchase items.
const PURCHASE_ITEM_STAGES = new Set(["CAPEX_PROTO", "CAPEX_PILOT_COMPONENTS"]);

const prerequisites = Object.fromEntries(STAGES.map((stage, index) => [stage, index ? [STAGES[index - 1]] : []]));

const label = (stage) => stage.replaceAll("_", " ");
const plain = (item) => (item?.toObject ? item.toObject() : { ...item });
const getScheduleEntry = (rfq, stage) => rfq.stage_schedule?.find((item) => item.stage === stage);
const dateKey = (value) => new Date(value).toISOString().slice(0, 10);
const completed = (rfq, stage) => Boolean(getScheduleEntry(rfq, stage)?.completed_date);

export const getStageStatus = (rfq, stage, now = new Date()) => {
  const item = getScheduleEntry(rfq, stage);
  if (item?.completed_date) {
    if (!item.target_date) return "DONE";
    return dateKey(item.completed_date) > dateKey(item.target_date) ? "DELAY_DONE" : "DONE";
  }
  if (!TARGET_DATE_STAGES.has(stage) || !item?.target_date) return "WAITING";
  return dateKey(now) > dateKey(item.target_date) ? "DELAY_PENDING" : "PENDING";
};

const allowedTargetPhase = (currentStage) => {
  // Initial targets are supplied only during RFQ creation. They are not editable here.
  if (TARGET_PHASES.PROTOTYPE.includes(currentStage)) return "PROTOTYPE";
  if (TARGET_PHASES.PILOT.includes(currentStage)) return "PILOT";
  if (TARGET_PHASES.MASS_PRODUCTION.includes(currentStage)) return "MASS_PRODUCTION";
  return null;
};

export const canSetTargetsForCurrentPhase = (rfq) => Boolean(allowedTargetPhase(rfq.current_stage));

// Validates a full set of target dates for one phase and returns Map(stage -> Date).
const parsePhaseTargets = (phase, targetDates) => {
  if (!Array.isArray(targetDates) || !targetDates.length) throw new Error("Target dates are required for the next stages");
  const allowed = new Set(TARGET_PHASES[phase]);
  const incoming = new Map(targetDates.map((item) => [item.stage, item.target_date]));
  for (const stage of incoming.keys()) {
    if (!allowed.has(stage)) throw new Error(`Cannot set target date for ${label(stage)} in this phase`);
  }
  return new Map([...allowed].map((stage) => {
    const target = new Date(incoming.get(stage));
    if (!incoming.get(stage) || Number.isNaN(target.getTime())) throw new Error(`A valid target date is required for ${label(stage)}`);
    return [stage, target];
  }));
};

export const setPhaseTargets = async (rfqId, targetDates) => {
  const rfq = await RfqItem.findById(rfqId);
  if (!rfq) throw new Error("RFQ not found");
  const phase = allowedTargetPhase(rfq.current_stage);
  if (!phase) throw new Error("No target-date phase is currently open");

  const targets = parsePhaseTargets(phase, targetDates);
  for (const stage of targets.keys()) {
    if (completed(rfq, stage)) throw new Error(`Completed stage ${label(stage)} cannot be rescheduled`);
  }
  rfq.stage_schedule = buildSchedule(rfq, targets);
  await rfq.save();
  return rfq;
};

// Rebuilds the full 20-stage schedule, creating any missing entry, so a saved date can never be skipped.
const buildSchedule = (rfq, targets, completedStage, completedAt) => STAGES.map((stage) => {
  const entry = { stage, ...plain(getScheduleEntry(rfq, stage)) };
  if (targets.has(stage)) entry.target_date = targets.get(stage);
  if (stage === completedStage) entry.completed_date = completedAt;
  return entry;
});

const parsePurchaseOrder = (data) => {
  const poNumber = data.po_number?.trim();
  const poQty = Number(data.po_qty);
  if (!poNumber) throw new Error("Customer PO number is required");
  if (!Number.isFinite(poQty) || poQty <= 0) throw new Error("PO quantity must be greater than zero");

  const schedule = (data.delivery_schedule || []).map(({ date, quantity }) => ({ date: new Date(date), quantity: Number(quantity) }));
  if (!schedule.length) throw new Error("Add at least one delivery schedule");
  if (schedule.some((entry) => Number.isNaN(entry.date.getTime()) || !(entry.quantity > 0))) throw new Error("Every delivery schedule needs a valid date and a quantity");
  const scheduledQty = schedule.reduce((sum, entry) => sum + entry.quantity, 0);
  if (scheduledQty > poQty) throw new Error(`Scheduled quantity (${scheduledQty}) exceeds the PO quantity (${poQty})`);
  return { po_number: poNumber, po_qty: poQty, delivery_schedule: schedule };
};

const completionPayload = (rfq, stage, data, targets) => {
  const now = new Date();
  const updates = { stage_schedule: buildSchedule(rfq, targets, stage, now) };
  if (stage === "COSTING") updates.costing = { ...rfq.costing?.toObject?.(), ...data, status: "SUBMITTED_TO_CUSTOMER", submitted_date: now, quoted_price: Number(data.quoted_price) };
  if (stage === "CUSTOMER_DECISION") {
    updates.rfq_status = data.decision === "LOST" ? "LOST" : "AWARDED";
    updates.awarded_date = data.decision === "AWARDED" ? now : undefined;
    updates.customer_decision = { decision: data.decision, decision_date: now, notes: data.note || "" };
  }
  if (stage === "CUSTOMER_APPROVAL_PILOT") updates.customer_approval_pilot = { approved: true, approved_date: now, notes: data.note || "" };
  if (stage === "CUSTOMER_APPROVAL_MASS_PRODUCTION") updates.customer_approval = { approved: true, approved_date: now, notes: data.note || "" };
  if (stage === "CUSTOMER_PO_RECEIVED") updates.purchase_order = { ...parsePurchaseOrder(data), po_received_date: now };
  if (stage === "ACTUAL_BOM") updates.actual_bom_defined_date = now;
  if (stage === "CAPEX_PROTO") updates.proto_capex = { ...rfq.proto_capex?.toObject?.(), ...data, status: "COMPLETED", completed_date: now };
  if (stage === "CAPEX_PILOT_COMPONENTS") updates.capex_status = data.status || "APPROVED";
  if (stage === "PROTO_BUILD") updates.proto_build = { ...rfq.proto_build?.toObject?.(), ...data, status: "IN_PROGRESS", completed_date: now };
  if (stage === "PROTO_SUBMITTED") updates.proto_build = { ...rfq.proto_build?.toObject?.(), ...data, status: "PROTO_SUBMITTED", submitted_date: now };
  if (stage === "PILOT_BUILD") updates.pilot_build = { ...rfq.pilot_build?.toObject?.(), ...data, status: "IN_PROGRESS", completed_date: now };
  if (stage === "PILOT_DELIVERY") updates.pilot_build = { ...rfq.pilot_build?.toObject?.(), ...data, status: "SUBMITTED", delivered_date: now };
  if (stage === "MASS_PRODUCTION_HANDOVER") updates.mass_production = { ...rfq.mass_production?.toObject?.(), ...data, status: "HANDED_OVER", handed_over_date: now };

  const index = STAGES.indexOf(stage);
  updates.current_stage = index === STAGES.length - 1 ? "COMPLETED" : STAGES[index + 1];
  if (stage === "CUSTOMER_DECISION" && data.decision === "LOST") updates.current_stage = "COMPLETED";
  return { updates, now };
};

export const transitionRfq = async (rfqId, stage, data, user) => {
  if (!STAGES.includes(stage)) throw new Error("Invalid workflow stage");
  if (!canActOnStage(user.role, stage)) throw new Error(`Role ${user.role} cannot perform ${stage}`);

  const rfq = await RfqItem.findById(rfqId);
  if (!rfq) throw new Error("RFQ not found");
  if (rfq.current_stage !== stage) throw new Error(`Current stage is ${label(String(rfq.current_stage))}`);

  for (const prerequisite of prerequisites[stage]) {
    if (!completed(rfq, prerequisite)) throw new Error(`${label(prerequisite)} must be completed first`);
  }

  if (TARGET_PHASES.INITIAL.includes(stage) && !getScheduleEntry(rfq, stage)?.target_date) {
    throw new Error(`Set the target date for ${label(stage)} before completing this stage`);
  }
  if (stage === "COSTING" && (!Number.isFinite(Number(data.quoted_price)) || Number(data.quoted_price) <= 0)) throw new Error("Quoted value is required and must be greater than zero");
  if (ATTACHMENT_REQUIRED_STAGES.has(stage) && (!Array.isArray(data.attachments) || data.attachments.length === 0)) throw new Error("At least one attachment is required for this stage");
  if (stage === "CUSTOMER_DECISION" && !["AWARDED", "LOST"].includes(data.decision)) throw new Error("Customer decision must be AWARDED or LOST");
  if (stage === "CUSTOMER_APPROVAL_PILOT" && !data.approved) throw new Error("Customer approval for pilot building is required");
  if (stage === "CUSTOMER_APPROVAL_MASS_PRODUCTION" && !data.approved) throw new Error("Customer approval for mass production is required");
  if (stage === "ACTUAL_BOM" && await Component.countDocuments({ rfq_item: rfq._id, bom_stage: "FINAL_BOM" }) === 0) throw new Error("Define at least one final BOM component before completing this stage");

  const opensNextPhase = NEXT_PHASE_AFTER[stage] && data.decision !== "LOST";
  const targets = opensNextPhase ? parsePhaseTargets(NEXT_PHASE_AFTER[stage], data.target_dates) : new Map();

  const { updates, now } = completionPayload(rfq, stage, data, targets);
  if (Array.isArray(data.attachments) && data.attachments.length) {
    const current = rfq.stage_attachments instanceof Map ? Object.fromEntries(rfq.stage_attachments) : (rfq.stage_attachments || {});
    updates.stage_attachments = { ...current, [stage]: data.attachments.map((item) => ({
      file_name: item.file_name, file_type: item.file_type || "", file_size: Number(item.file_size || 0), url: item.url || "", storage_provider: item.storage_provider || "PENDING_CLOUD_UPLOAD", uploaded_at: item.uploaded_at ? new Date(item.uploaded_at) : now,
    })) };
  }
  rfq.set(updates);
  rfq.stage_history.push({ stage, action: "COMPLETED", user: user._id, note: data.note, completedAt: now });
  await rfq.save();

  let project = null;
  if (stage === "MASS_PRODUCTION_HANDOVER") project = await convertRfqToProject(rfq);
  return { rfq, project };
};

// Replaces the purchase items of one Capex / Tooling stage. Items are optional, so an empty list is valid.
export const savePurchaseItems = async (rfqId, stage, items, user) => {
  if (!PURCHASE_ITEM_STAGES.has(stage)) throw new Error("Purchase items are not used at this stage");
  if (!canActOnStage(user.role, stage)) throw new Error(`Role ${user.role} cannot edit ${label(stage)}`);

  const rfq = await RfqItem.findById(rfqId);
  if (!rfq) throw new Error("RFQ not found");
  if (rfq.current_stage !== stage) throw new Error("Purchase items can only be edited while this stage is open");

  const cleaned = (items || [])
    .filter((item) => item.item_name?.trim())
    .map((item) => ({ stage, item_name: item.item_name.trim(), quantity: Number(item.quantity) || 1, remarks: item.remarks?.trim() || "" }));
  const otherStages = (rfq.purchase_items || []).filter((item) => item.stage !== stage).map(plain);
  rfq.purchase_items = [...otherStages, ...cleaned];
  await rfq.save();
  return rfq;
};

export const getWorkflowSummary = async (rfqId) => {
  const rfq = await RfqItem.findById(rfqId).populate("stage_history.user", "name email role").lean();
  if (!rfq) return null;
  // After handover the components are re-owned by the Project, so read both owners.
  const owners = [{ rfq_item: rfqId }, ...(rfq.linked_project ? [{ project: rfq.linked_project }] : [])];
  const components = await Component.find({ $or: owners }).sort({ bom_stage: 1, createdAt: 1 }).lean();
  const stage_schedule = (rfq.stage_schedule || []).map((item) => ({ ...item, status: getStageStatus(rfq, item.stage) }));
  return { rfq, components, stage_schedule, can_set_targets: canSetTargetsForCurrentPhase(rfq) };
};
