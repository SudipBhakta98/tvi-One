import mongoose from "mongoose";
const sessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenId: { type: String, required: true, unique: true },
  ipAddress: String,
  userAgent: String,
  expiresAt: Date,
  revokedAt: Date
}, { timestamps: true });
export default mongoose.model("Session", sessionSchema);
