import mongoose from "mongoose";

const payableSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
    },

    grnNumber: {
      type: String,
      required: true,
      trim: true,
    },

    supplierName: {
      type: String,
      required: true,
      trim: true,
    },

    invoiceDate: {
      type: Date,
      required: true,
    },

    subTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    gstRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    gstAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Optional untaxed extra charge, added directly to totalAmount
    otherAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    otherAmountDescription: {
      type: String,
      default: "",
      trim: true,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    tdsRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    tdsAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    payableAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // User who created the payable
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
          trim: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Invoice + GRN combination must be unique
payableSchema.index({ invoiceNumber: 1, grnNumber: 1 }, { unique: true });

payableSchema.index({ invoiceDate: -1 });
payableSchema.index({ grnNumber: 1 });
payableSchema.index({ supplierName: 1 });

payableSchema.index({ invoiceDate: -1, supplierName: 1 });

export default mongoose.model("Payable", payableSchema);