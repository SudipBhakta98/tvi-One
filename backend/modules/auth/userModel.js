import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true, index: true },
  department: { type: String, default: "GENERAL" },
  isActive: { type: Boolean, default: true },
  lastLoginAt: Date
}, { timestamps: true });

export default mongoose.model("User", userSchema);
