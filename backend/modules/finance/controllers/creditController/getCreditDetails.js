import Credit from "../../models/creditModel.js";

export const getCreditDetails = async (req, res) => {
  try {
    const { creditNoteNumber } = req.params;

    if (!creditNoteNumber || !creditNoteNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: "Credit note number is required.",
      });
    }

    const credit = await Credit.findOne({
      creditNoteNumber: creditNoteNumber.trim(),
    })
      .populate("createdBy", "name email")

      // Allocation requests → Payment → Users
      .populate({
        path: "allocationRequest.paymentId",
        select:
          "invoiceNumber grnNumber supplierName paidAmount paymentMethod paymentDate transactionNumber creditNoteNumber status paymentBy approvedBy approvedAt",
        populate: [
          {
            path: "paymentBy",
            select: "name email",
          },
          {
            path: "approvedBy",
            select: "name email",
          },
        ],
      })

      // Allocations → Payment → Users
      .populate({
        path: "allocations.paymentId",
        select:
          "invoiceNumber grnNumber supplierName paidAmount paymentMethod paymentDate transactionNumber creditNoteNumber status paymentBy approvedBy approvedAt",
        populate: [
          {
            path: "paymentBy",
            select: "name email",
          },
          {
            path: "approvedBy",
            select: "name email",
          },
        ],
      })

      // Credit update logs → User
      .populate("updateLogs.updatedBy", "name email")

      .lean();

    if (!credit) {
      return res.status(404).json({
        success: false,
        message: `Credit note '${creditNoteNumber}' not found.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Credit note details fetched successfully.",
      data: credit,
    });
  } catch (error) {
    console.error("Error in getCreditDetails:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch credit note details.",
      error: error.message,
    });
  }
};