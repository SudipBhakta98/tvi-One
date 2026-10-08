import mongoose from "mongoose";
import { PROJECT_LIFECYCLE_STATUS } from "../../../constants/rfqEnums.js";
const deliveryScheduleEntrySchema = new mongoose.Schema({ date: { type: Date, required: true }, delivery_qty: { type: Number, required: true, min: 1 } }, { _id: true });
const projectSchema = new mongoose.Schema({
  project_name: { type: String, required: true }, project_owner: { type: String, required: true }, customer: String,
  order_qty: { type: Number, required: true, min: 1 }, delivery_schedule: [deliveryScheduleEntrySchema],
  status: { type: String, enum: PROJECT_LIFECYCLE_STATUS, default: "ACTIVE" },
  source_rfq: { type: mongoose.Schema.Types.ObjectId, ref: "RfqItem" },
  handover_date: Date,
}, { timestamps: true });
projectSchema.index({ createdAt: -1, status: 1 });

export default mongoose.model("Project", projectSchema);
