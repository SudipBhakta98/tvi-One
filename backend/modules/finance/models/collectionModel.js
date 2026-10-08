import mongoose from "mongoose";

/**
 * One money-received entry against a receivable invoice.
 *   receivedAmount : cash actually received from the customer
 *   tdsAmount      : TDS the customer withheld (entered as an amount)
 * Both reduce the invoice outstanding once the collection is Approved.
 */
const collectionSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, trim: true },
    grnNumber: { type: String, required: true, trim: true },
    customerName: { type: String, required: true, trim: true },

    receivedAmount: { type: Number, required: true, min: 0 },
    tdsAmount: { type: Number, default: 0, min: 0 },
    collectionDate: { type: Date, required: true },

    collectionBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },

    updateLogs: [
      {
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        updatedAt: { type: Date, default: Date.now },
        remark: { type: String, required: true, trim: true },
      },
    ],
  },
  { timestamps: true },
);

collectionSchema.index({ invoiceNumber: 1, grnNumber: 1, status: 1 });
collectionSchema.index({ collectionDate: -1 });
collectionSchema.index({ status: 1, collectionDate: -1 });

export default mongoose.model("Collection", collectionSchema);
