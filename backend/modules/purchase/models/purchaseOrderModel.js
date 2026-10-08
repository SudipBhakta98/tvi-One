import mongoose from "mongoose";
import { PURCHASE_TYPE } from "../../../constants/rfqEnums.js";

const receivingScheduleEntrySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  receiving_qty: { type: Number, required: true },
});

const purchaseOrderSchema = new mongoose.Schema(
  {
    // RFQ_NPD: sample/trial/development material bought against an RFQ, before
    //   a Project or formal Component necessarily exists.
    // PRODUCTION: material bought against a live Project + Component, once
    //   Mass Production has been approved.
    purchase_type: { type: String, enum: PURCHASE_TYPE, required: true },

    rfq_item: { type: mongoose.Schema.Types.ObjectId, ref: "RfqItem" },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    component: { type: mongoose.Schema.Types.ObjectId, ref: "Component" },

    // Free-text description of what's being bought, used for RFQ_NPD purchases
    // that don't (yet) have a formal Component record behind them.
    item_name: { type: String },

    po_number: { type: String, required: true },
    supplier: { type: String, required: true },
    total_quantity: { type: Number, required: true },
    cost: { type: Number },
    status: {
      type: String,
      enum: ["ACCEPTED", "REJECTED", "UNDER_DISCUSSION"],
      default: "UNDER_DISCUSSION",
    },
    delivery_schedule: [receivingScheduleEntrySchema],
  },
  { timestamps: true },
);

purchaseOrderSchema.pre("validate", function (next) {
  if (this.purchase_type === "PRODUCTION" && (!this.project || !this.component)) {
    return next(new Error("Production purchase orders require both project and component"));
  }
  if (this.purchase_type === "RFQ_NPD") {
    if (!this.rfq_item) return next(new Error("RFQ purchase orders require an rfq_item"));
    if (!this.component && !this.item_name) {
      return next(new Error("RFQ purchase orders need either a component or an item_name"));
    }
  }

});

purchaseOrderSchema.index({ createdAt: -1, purchase_type: 1 });
purchaseOrderSchema.index({ project: 1, createdAt: -1 });

const PurchaseOrder = mongoose.model("PurchaseOrder", purchaseOrderSchema);
export default PurchaseOrder;
