import Collection from "../../models/collectionModel.js";

export const getReceivableDetails = async (req, res) => {
  try {
    const invoiceNumber = String(req.query.invoiceNumber || "").trim();
    const grnNumber = String(req.query.grnNumber || "").trim();

    if (!invoiceNumber || !grnNumber) {
      return res.status(400).json({ success: false, message: "Please provide both invoice number and GRN number." });
    }

    const collections = await Collection.find({ invoiceNumber, grnNumber })
      .populate("collectionBy", "name email")
      .populate("approvedBy", "name email")
      .populate("updateLogs.updatedBy", "name")
      .sort({ collectionDate: -1 })
      .lean();

    return res.status(200).json({ success: true, data: { collections } });
  } catch (error) {
    console.error("Error in getReceivableDetails:", error);
    return res.status(500).json({ success: false, message: "Something went wrong while fetching receivable details." });
  }
};
