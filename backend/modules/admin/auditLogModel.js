import mongoose from "mongoose";
const auditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  action: { type: String, required: true },
  resource: String,
  resourceId: String,
  method: String,
  path: String,
  ipAddress: String,
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });
export default mongoose.model("AuditLog", auditLogSchema);
