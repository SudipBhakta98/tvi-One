import Credit from "../../models/creditModel.js";

export const deleteCredit = async (req, res) => {
  try {
    if (req.user?.role !== "Super User") {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete a Credit Note.",
      });
    }

    const { creditNoteNumber } = req.params;

    const credit = await Credit.findOne({
      creditNoteNumber: String(creditNoteNumber).trim(),
    });

    if (!credit) {
      return res.status(404).json({
        success: false,
        message: "Credit Note not found.",
      });
    }

    if (credit.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message:
          "Only Pending Credit Notes can be deleted.",
      });
    }

    if (
      credit.totalAllocatedAmount > 0 ||
      credit.allocations.length > 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This Credit Note cannot be deleted because it has allocations.",
      });
    }

    if (
      credit.totalAllocationRequestAmount > 0 ||
      credit.allocationRequest.length > 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This Credit Note cannot be deleted because it has pending allocation requests.",
      });
    }

    await Credit.deleteOne({
      _id: credit._id,
    });

    return res.status(200).json({
      success: true,
      message: "Credit Note deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting Credit Note:", error);

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while deleting the Credit Note.",
    });
  }
};