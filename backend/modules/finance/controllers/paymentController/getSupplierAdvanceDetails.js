import mongoose from "mongoose";
import SupplierAdvance from "../../models/supplierAdvanceModel.js";

export const getSupplierAdvanceDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "The advance ID is not valid." });
    }

    const data = await SupplierAdvance.findById(id)
      .populate("paymentId", "status paymentDate paymentMethod transactionNumber")
      .populate("createdBy", "name")
      .populate("adjustments.adjustedBy", "name")
      .populate("updateLogs.updatedBy", "name")
      .lean();

    if (!data) {
      return res.status(404).json({ success: false, message: "Supplier advance not found." });
    }
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to load advance details." });
  }
};
