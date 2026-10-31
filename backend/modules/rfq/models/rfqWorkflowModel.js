import mongoose from "mongoose";
import RfqItem from "./rfqItemModel.js";

// Keep the same lifecycle fields and validation as RfqItem, but persist every
// workflow instance in its own collection so stage progress/history are isolated.
const workflowSchema = RfqItem.schema.clone();
// Parent RFQ numbers are unique, but many workflow documents intentionally share that RFQ number.
workflowSchema.clearIndexes();
workflowSchema.add({
  parent_rfq: { type: mongoose.Schema.Types.ObjectId, ref: "RfqItem", required: true },
  workflow_number: { type: String, trim: true },
  workflow_name: { type: String, trim: true },
  initial_target_date: { type: Date },
  lifecycle_status: { type: String, enum: ["IN_PROGRESS", "PAUSED", "COMPLETED", "STOPPED_BY_RFQ_COMPLETION", "STOPPED_BY_RFQ_CANCELLATION"], default: "IN_PROGRESS", index: true },
  paused_by_parent: { type: Boolean, default: false },
  status_before_parent_pause: { type: String },
  lifecycle_updated_at: Date,
  selected_parts: [{
    main_part_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    main_part_selected: { type: Boolean, default: false },
    sub_part_ids: [{ type: mongoose.Schema.Types.ObjectId }],
  }],
});
workflowSchema.index({ parent_rfq: 1, createdAt: -1 });
workflowSchema.index({ parent_rfq: 1, workflow_number: 1 });

export default mongoose.models.RfqWorkflow || mongoose.model("RfqWorkflow", workflowSchema, "rfq_workflows");
