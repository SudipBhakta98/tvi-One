import mongoose from "mongoose";

const machineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, trim: true, uppercase: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const Machine = mongoose.model("Machine", machineSchema);
export default Machine;
