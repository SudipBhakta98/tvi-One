import mongoose from "mongoose";

const componentSchema = new mongoose.Schema({
  // Components belong to the RFQ aggregate or the converted Project aggregate.
  // They are intentionally NOT attached to main parts or sub parts.
  project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", index: true },
  rfq_item: { type: mongoose.Schema.Types.ObjectId, ref: "RfqItem", index: true },
  component_name: { type: String, required: true, trim: true },
  component_description: { type: String, default: "", trim: true },
  per_unit_qty: { type: Number, required: true, min: 1 },
  total_qty: { type: Number, required: true, min: 1 },
  bom_stage: { type: String, enum: ["PILOT", "FINAL_BOM"], required: true },
}, { timestamps: true });

componentSchema.index({ rfq_item: 1, bom_stage: 1, createdAt: -1 });
componentSchema.index({ project: 1, bom_stage: 1, createdAt: -1 });

export default mongoose.model("Component", componentSchema);
