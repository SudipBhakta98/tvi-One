import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    paymentType: {
      type: String,
      enum: ["INVOICE", "ADVANCE"],
      default: "INVOICE",
    },

    invoiceNumber: {
      type: String,
      trim: true,
      required: function () { return this.paymentType === "INVOICE"; },
    },

    supplierName: {
      type: String,
      required: true,
      trim: true,
    },

    grnNumber: {
      type: String,
      required: function () { return this.paymentType === "INVOICE"; },
    },

    paidAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentDate: {
      type: Date,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["CASH", "BANK", "CHEQUE", "ONLINE", "UPI", "ADVANCE"],
      required: true,
    },

    transactionNumber: {
      type: String,
      trim: true,
    },

    // Credit note is only needed for the part of the payment that is NOT
    // covered by a supplier advance.
    creditNoteNumber: {
      type: String,
      trim: true,
    },

    // Portion of paidAmount that is settled from supplier advance(s).
    // credit portion = paidAmount - advanceAmount
    advanceAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    advanceAllocations: [
      {
        advanceId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "SupplierAdvance",
          required: true,
        },
        advanceNumber: { type: String, trim: true },
        amount: { type: Number, required: true, min: 0.01 },
      },
    ],

    // User who created the payment
    paymentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },

    // User who approved/rejected the payment
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: {
      type: Date,
    },

    // Complete update history
    updateLogs: [
      {
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },

        updatedAt: {
          type: Date,
          default: Date.now,
        },

        remark: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);
paymentSchema.index({
  invoiceNumber: 1,
  grnNumber: 1,
  status: 1,
});
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ grnNumber: 1 });
paymentSchema.index({ supplierName: 1 });
paymentSchema.index({ transactionNumber: 1 });
paymentSchema.index({ creditNoteNumber: 1 });


paymentSchema.index({ paymentDate: -1, status: 1 });

export default mongoose.model("Payment", paymentSchema);
