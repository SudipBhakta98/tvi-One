import mongoose from "mongoose";

const creditSchema = new mongoose.Schema(
  {
    creditNoteNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    creditNoteAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    totalAllocatedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
totalAllocationRequestAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    pendingAllocationAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    allocationRequest: [
      {
        paymentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Payment",
          required: true,
        },

        requestAmount: {
          type: Number,
          required: true,
          min: 0.01,
        },

        requestedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    allocations: [
      {
        paymentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Payment",
          required: true,
        },

        allocatedAmount: {
          type: Number,
          required: true,
          min: 0.01,
        },

        allocatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    creditNoteDate: {
      type: Date,
      required: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["Pending", "Partially Allocated", "Fully Allocated"],
      default: "Pending",
    },

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

creditSchema.index({ creditNoteDate: -1 });
creditSchema.index({ status: 1 });

creditSchema.index({ creditNoteDate: -1, status: 1 });

export default mongoose.model("Credit", creditSchema);
