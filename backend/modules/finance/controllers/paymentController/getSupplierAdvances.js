import SupplierAdvance from "../../models/supplierAdvanceModel.js";

export const getSupplierAdvances = async (req, res) => {
  try {
    const data = await SupplierAdvance.find()
      .sort({ createdAt: -1 })
      .populate("paymentId", "status paymentDate paymentMethod transactionNumber")
      .populate("createdBy", "name")
      .lean();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to load supplier advances." });
  }
};
