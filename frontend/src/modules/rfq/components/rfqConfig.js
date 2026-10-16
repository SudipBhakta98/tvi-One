import { ROLES } from "../../../constants/roles";

// [key, label, hasTargetDate] — hasTargetDate=false means the stage is customer / event driven.
export const STAGES = [
  ["CUSTOMER_RFQ_RECEIVED", "Customer RFQ Received", true],
  ["DOCUMENT_REVIEW", "Review the Documents Submitted by Customer", true],
  ["TECHNICAL_REVIEW", "Technical Review", true],
  ["FEASIBILITY_REVIEW", "Feasibility Review", true],
  ["DFM_REVIEW", "DFM Review", true],
  ["COMMERCIAL_REVIEW", "Commercial Review", true],
  ["COSTING", "Costing", true],
  ["RFQ_SUBMITTED", "RFQ Submitted to Customer", true],
  ["CUSTOMER_DECISION", "Customer Decision — Lost / Awarded", false],
  ["CAPEX_PROTO", "Capex / Tooling — Prototype Building", true],
  ["PROTO_BUILD", "Prototype Building", true],
  ["PROTO_SUBMITTED", "Prototype Submission", true],
  ["CUSTOMER_APPROVAL_PILOT", "Customer Approval for Pilot Building — 1st Batch", false],
  ["CAPEX_PILOT_COMPONENTS", "Capex / Tooling — Pilot Building", true],
  ["PILOT_BUILD", "Pilot Building", true],
  ["PILOT_DELIVERY", "Pilot Delivery", true],
  ["CUSTOMER_APPROVAL_MASS_PRODUCTION", "Customer Approval for Mass Production", false],
  ["CUSTOMER_PO_RECEIVED", "Receive Customer PO — Quantity & Delivery Schedules", false],
  ["ACTUAL_BOM", "Define Actual BOM — Components / Unit + Total", true],
  ["MASS_PRODUCTION_HANDOVER", "Mass Production Handover — Convert RFQ to Project", true],
];

// Roles that can act on a stage regardless of ownership. The RFQ's Project Owner (an NPD User) is added by the server:
// every RFQ response carries `permissions.can_update`, which the stage grid also honours.
export const ROLE_MAP = {
  ADMIN: STAGES.map(([key]) => key),
  SUPER_USER: STAGES.map(([key]) => key),
  NPD_MANAGER: STAGES.map(([key]) => key),
  NPD_SCRUM_MASTER: [],
  NPD_USER: [],
  SCM_MANAGER: ["CAPEX_PILOT_COMPONENTS"],
  SCM_USER: [],
};

// Mirrors CREATE_ROLES in backend rfqPermissions.js.
export const RFQ_CREATE_ROLES = [ROLES.ADMIN, ROLES.SUPER_USER, ROLES.NPD_SCRUM_MASTER];

export const TARGET_PHASES = {
  INITIAL: ["CUSTOMER_RFQ_RECEIVED", "DOCUMENT_REVIEW", "TECHNICAL_REVIEW", "FEASIBILITY_REVIEW", "DFM_REVIEW", "COMMERCIAL_REVIEW", "COSTING", "RFQ_SUBMITTED"],
  PROTOTYPE: ["CAPEX_PROTO", "PROTO_BUILD", "PROTO_SUBMITTED"],
  PILOT: ["CAPEX_PILOT_COMPONENTS", "PILOT_BUILD", "PILOT_DELIVERY"],
  MASS_PRODUCTION: ["ACTUAL_BOM", "MASS_PRODUCTION_HANDOVER"],
};

export const PHASE_TITLE = { PROTOTYPE: "Prototype", PILOT: "Pilot", MASS_PRODUCTION: "Mass Production" };

// A positive customer answer at these stages opens the next phase and asks for its target dates.
export const NEXT_PHASE_AFTER = { CUSTOMER_DECISION: "PROTOTYPE", CUSTOMER_APPROVAL_PILOT: "PILOT", CUSTOMER_APPROVAL_MASS_PRODUCTION: "MASS_PRODUCTION" };
export const CUSTOMER_APPROVAL_STAGES = new Set(["CUSTOMER_APPROVAL_PILOT", "CUSTOMER_APPROVAL_MASS_PRODUCTION"]);
export const CUSTOMER_EVIDENCE_STAGES = new Set(["CUSTOMER_DECISION", ...CUSTOMER_APPROVAL_STAGES, "CUSTOMER_PO_RECEIVED"]);
export const PURCHASE_ITEM_STAGES = new Set(["CAPEX_PROTO", "CAPEX_PILOT_COMPONENTS"]);
export const BOM_STAGE = "FINAL_BOM";

export const STATUS_VIEW = {
  DONE: { label: "Done", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DELAY_DONE: { label: "Done · Delayed", className: "bg-rose-50 text-rose-700 border-rose-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  DELAYED: { label: "Delayed", className: "bg-amber-50 text-amber-700 border-amber-200" },
  UPCOMING: { label: "Upcoming", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

export const blankSub = () => ({ sub_part_no: "", description: "", qty_per_main_part: 1 });
// Sub parts are optional: a main part starts with none.
export const blankMain = () => ({ main_part_no: "", description: "", volume_per_annum_nos: 1, sub_parts: [] });
export const stageLabel = (stage) => STAGES.find(([key]) => key === stage)?.[1] || String(stage || "").replaceAll("_", " ");
export const emptyStageSchedule = () => STAGES.map(([stage]) => ({ stage, target_date: null }));
export const hasTargetDate = (stage) => Boolean(STAGES.find(([key]) => key === stage)?.[2]);
export const attachmentLabel = (stage) => (CUSTOMER_EVIDENCE_STAGES.has(stage) ? "Costing sheet & documents" : "Attachments");

export const stageState = (entry, isCurrent) => {
  if (entry?.completed_date) return entry.status === "DELAY_DONE" ? "DELAY_DONE" : "DONE";
  if (!isCurrent) return "UPCOMING";
  return entry?.status === "DELAY_PENDING" ? "DELAYED" : "IN_PROGRESS";
};

export const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN") : "—");
export const formatMoney = (value) => `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
export const errorMessage = (error, fallback = "Something went wrong") => error.response?.data?.error || error.message || fallback;
