import mongoose from "mongoose";
import {
  DOCUMENT_STATUS, REVIEW_STATUS, FEASIBILITY_STATUS, TOOLING_CATEGORY, COSTING_STATUS,
  RFQ_STATUS, PROTO_BUILD_STATUS, CAPEX_STATUS, PILOT_BUILD_STATUS, MASS_PRODUCTION_STATUS,
  CURRENT_STAGE, PROJECT_LIFECYCLE_STATUS, HALF_VOLUME_SPLIT_RATIO,
} from "../../../constants/rfqEnums.js";

const subPartSchema = new mongoose.Schema({
  sub_part_no: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  qty_per_main_part: { type: Number, default: 1, min: 1 },
}, { _id: true });

const mainPartSchema = new mongoose.Schema({
  main_part_no: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  volume_per_annum_nos: { type: Number, required: true, min: 1 },
  rfq_target_date: Date,
  sub_parts: { type: [subPartSchema], default: [] },
}, { _id: true });

const stageScheduleSchema = new mongoose.Schema({
  stage: { type: String, required: true },
  target_date: { type: Date },
  completed_date: { type: Date },
}, { _id: false });

const customerDecisionSchema = new mongoose.Schema({ decision: { type: String, enum: ["AWARDED", "LOST"] }, decision_date: Date, notes: String }, { _id: false });

const attachmentSchema = new mongoose.Schema({
  file_name: { type: String, required: true, trim: true },
  file_type: { type: String, default: "" },
  file_size: { type: Number, default: 0, min: 0 },
  url: { type: String, default: "" },
  storage_provider: { type: String, enum: ["PENDING_CLOUD_UPLOAD", "CLOUD"], default: "PENDING_CLOUD_UPLOAD" },
  uploaded_at: { type: Date, default: Date.now },
}, { _id: true });

const purchaseItemSchema = new mongoose.Schema({
  stage: { type: String, required: true },
  item_name: { type: String, required: true, trim: true },
  quantity: { type: Number, default: 1, min: 1 },
  remarks: { type: String, default: "", trim: true },
}, { _id: true });

const stageHistorySchema = new mongoose.Schema({
  stage: { type: String, required: true }, action: { type: String, required: true }, user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, note: String, completedAt: { type: Date, default: Date.now },
}, { _id: false });

const rfqItemSchema = new mongoose.Schema({
  rfq_number: { type: String, required: true, trim: true, index: true },
  project_status: { type: String, enum: PROJECT_LIFECYCLE_STATUS, default: "ACTIVE" },
  customer: { type: String, required: true, trim: true },
  project_lead: { type: String, required: true, trim: true },
  project_name: { type: String, required: true, trim: true },
  rfq_dated: { type: Date, required: true },
  description: { type: String, required: true },
  rfq_target_date: Date,
  // One target date per lifecycle stage. completed_date is written only by a stage action.
  stage_schedule: { type: [stageScheduleSchema], default: [] },

  // Hierarchy: one RFQ -> many main parts -> many sub parts.
  main_parts: { type: [mainPartSchema], default: [] },

  // Legacy compatibility fields. New UI writes main_parts; existing downstream modules can still read these.
  main_part_no: { type: String, required: true, trim: true },
  sub_part_no: String,
  volume_per_annum_nos: { type: Number, required: true, min: 1 },
  volume_per_annum_mt: Number,

  documents: { pdf_drawing: { type: String, enum: DOCUMENT_STATUS, default: "WAITING_FOR_INPUT" }, drawing_2d: { type: String, enum: DOCUMENT_STATUS, default: "WAITING_FOR_INPUT" }, drawing_3d: { type: String, enum: DOCUMENT_STATUS, default: "WAITING_FOR_INPUT" }, spec_sheet: { type: String, enum: DOCUMENT_STATUS, default: "WAITING_FOR_INPUT" } },
  customer_decision: customerDecisionSchema,
  stage_attachments: { type: Map, of: [attachmentSchema], default: {} },
  // Optional items to purchase during the Capex / Tooling stages (prototype and pilot). Kept per stage.
  purchase_items: { type: [purchaseItemSchema], default: [] },
  customer_approval_pilot: { approved: { type: Boolean, default: false }, approved_date: Date, notes: String },
  actual_bom_defined_date: Date,
  proto_capex: { status: String, completed_date: Date, notes: String },
  technical_review: { target_date: Date, status: { type: String, enum: REVIEW_STATUS, default: "IN_PROGRESS" }, completed_date: Date, notes: String },
  feasibility_status: { type: String, enum: FEASIBILITY_STATUS }, tooling_category: { type: String, enum: TOOLING_CATEGORY },
  dfm_review: { status: { type: String, enum: REVIEW_STATUS, default: "IN_PROGRESS" }, completed_date: Date, notes: String },
  commercial_review: { target_date: Date, status: { type: String, enum: REVIEW_STATUS, default: "IN_PROGRESS" }, completed_date: Date, notes: String },
  costing: { status: { type: String, enum: COSTING_STATUS, default: "COSTING_IN_PROGRESS" }, submitted_date: Date, quoted_price: Number, notes: String },
  rfq_status: { type: String, enum: RFQ_STATUS, default: "WAITING_FOR_APPROVAL" }, awarded_date: Date,
  proto_build: { target_date: Date, submitted_date: Date, status: { type: String, enum: PROTO_BUILD_STATUS, default: "NOT_STARTED" }, notes: String },
  capex_status: { type: String, enum: CAPEX_STATUS, default: "NOT_STARTED" },
  pilot_build: { target_date: Date, submitted_date: Date, status: { type: String, enum: PILOT_BUILD_STATUS, default: "NOT_STARTED" }, notes: String },
  customer_approval: { approved: { type: Boolean, default: false }, approved_date: Date, notes: String },
  purchase_order: { po_number: String, po_qty: Number, delivery_schedule: [{ date: Date, quantity: Number }], po_received_date: Date },
  mass_production: { handover_target_date: Date, handed_over_date: Date, status: { type: String, enum: MASS_PRODUCTION_STATUS, default: "NOT_READY" } },
  current_stage: { type: String, enum: CURRENT_STAGE, default: "CUSTOMER_RFQ_RECEIVED" },
  remarks: String, linked_project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
  stage_history: { type: [stageHistorySchema], default: [] },
}, { timestamps: true });

rfqItemSchema.index({ rfq_status: 1, createdAt: -1 });
rfqItemSchema.index({ current_stage: 1, createdAt: -1 });

rfqItemSchema.virtual("volume_half_annum_nos").get(function () { return Math.round(this.volume_per_annum_nos * HALF_VOLUME_SPLIT_RATIO); });
rfqItemSchema.virtual("main_part_count").get(function () { return this.main_parts?.length || 0; });
rfqItemSchema.virtual("sub_part_count").get(function () { return this.main_parts?.reduce((n, p) => n + (p.sub_parts?.length || 0), 0) || 0; });
rfqItemSchema.set("toJSON", { virtuals: true }); rfqItemSchema.set("toObject", { virtuals: true });
rfqItemSchema.index({ rfq_dated: -1, current_stage: 1 });

export default mongoose.model("RfqItem", rfqItemSchema);
