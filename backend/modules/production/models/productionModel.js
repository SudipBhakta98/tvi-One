import mongoose from "mongoose";
import { QC_STATUS } from "../../../constants/rfqEnums.js";

const productionSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true }, date: { type: Date, required: true }, finished_qty: { type: Number, required: true, min: 1 },
  qc_status: { type: String, enum: QC_STATUS, default: "PENDING" }, qc_notes: String,
  stage: { type: mongoose.Schema.Types.ObjectId, ref: "Stage" }, machine: { type: mongoose.Schema.Types.ObjectId, ref: "Machine" },
  operator_name: { type: String, trim: true, required: true }, start_time: { type: Date, required: true }, end_time: { type: Date, required: true },
}, { timestamps: true });
productionSchema.index({ project: 1, date: -1 });
productionSchema.index({ qc_status: 1, date: -1 });
productionSchema.pre("validate", function (done) { if (this.end_time <= this.start_time) return done(new Error("end_time must be after start_time")); done(); });
productionSchema.virtual("run_minutes").get(function () { return Math.round((this.end_time - this.start_time) / 60000); });
productionSchema.virtual("pieces_per_hour").get(function () { return this.run_minutes ? Math.round((this.finished_qty / this.run_minutes) * 600 * 100) / 100 : null; });
productionSchema.set("toJSON", { virtuals: true });
productionSchema.index({ date: -1, qc_status: 1 });
productionSchema.index({ stage: 1, date: -1 });
productionSchema.index({ machine: 1, date: -1 });

export default mongoose.model("Production", productionSchema);
