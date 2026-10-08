import mongoose from "mongoose";

const debiteSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    trim: true,
  },
  grnNumber: {
    type: String,
    required: true,
  },
  debitAmount: {
    type: Number,
    required: true,
  },

  description: {
    type: String,
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
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
        required: true,
        trim: true,
      },
    },
  ],
});


debiteSchema.index({ invoiceNumber: 1,grnNumber: 1});
debiteSchema.index({ grnNumber: 1});


debiteSchema.index({ createdAt: -1 });

export default mongoose.model("Debit", debiteSchema);
