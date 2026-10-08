import mongoose from "mongoose";

const stageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  code: { type: String, trim: true, uppercase: true },
  description: String,
  machines: [{ type: mongoose.Schema.Types.ObjectId, ref: "Machine" }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

stageSchema.index({ isActive: 1, name: 1 });
export default mongoose.model("Stage", stageSchema);
