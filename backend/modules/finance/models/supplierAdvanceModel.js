import mongoose from "mongoose";

const supplierAdvanceSchema = new mongoose.Schema({
  advanceNumber: { type: String, required: true, unique: true, trim: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true, unique: true },
  supplierName: { type: String, required: true, trim: true },
  advanceAmount: { type: Number, required: true, min: 0.01 },
  totalAdjustedAmount: { type: Number, default: 0, min: 0 },
  // Amount reserved by PENDING invoice payments that are waiting for approval.
  // Available balance = pendingAdjustmentAmount - totalAllocationRequestAmount
  totalAllocationRequestAmount: { type: Number, default: 0, min: 0 },
  pendingAdjustmentAmount: { type: Number, required: true, min: 0 },
  allocationRequest: [{
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true },
    invoiceNumber: String,
    requestAmount: { type: Number, required: true, min: 0.01 },
    requestedAt: { type: Date, default: Date.now },
  }],
  adjustments: [{
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    payableId: { type: mongoose.Schema.Types.ObjectId, ref: "Payable" },
    invoiceNumber: String,
    adjustedAmount: { type: Number, min: 0.01 },
    adjustedAt: { type: Date, default: Date.now },
    adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    remark: String,
  }],
  status: { type: String, enum: ["Pending", "Approved", "Partially Adjusted", "Fully Adjusted", "Cancelled"], default: "Pending" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updateLogs: [{ updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, updatedAt: { type: Date, default: Date.now }, remark: String }],
}, { timestamps: true });

supplierAdvanceSchema.index({ supplierName: 1, status: 1 });
supplierAdvanceSchema.index({ createdAt: -1 });

export default mongoose.model("SupplierAdvance", supplierAdvanceSchema);
