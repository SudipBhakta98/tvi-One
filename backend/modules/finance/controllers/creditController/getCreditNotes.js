import Credit from "../../models/creditModel.js";

export const getCreditNotes = async (req, res) => {
  try {
    const credits = await Credit.find({})
      .populate("createdBy", "name email")
      .populate("allocationRequest.paymentId", "invoiceNumber grnNumber supplierName paidAmount paymentMethod status")
      .populate("allocations.paymentId", "invoiceNumber grnNumber supplierName paidAmount paymentMethod status")
      .populate("updateLogs.updatedBy", "name")
      .sort({ creditNoteDate: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: credits.length,
      data: credits,
    });
  } catch (error) {
    console.error("Error in getCreditNotes:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch credit notes.",
      error: error.message,
    });
  }
};
