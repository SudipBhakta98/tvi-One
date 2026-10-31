import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // YYYY-MM
  sequence: { type: Number, required: true, default: 0, min: 0 },
}, { timestamps: true, versionKey: false });

export default mongoose.models.Counter || mongoose.model("Counter", counterSchema, "rfq_counters");
