import Credit from "../../models/creditModel.js";

export const getPendingAndPartialCredits = async (req, res) => {
  try {
    const credits = await Credit.find({
      status: {
        $in: ["Pending", "Partially Allocated"],
      },
    })
      .select(
        "creditNoteNumber pendingAllocationAmount totalAllocationRequestAmount"
      )
      .sort({ creditNoteDate: -1 })
      .lean();

    const data = credits.map((credit) => ({
      creditNoteNumber: credit.creditNoteNumber,
      pendingRequestAmount:
        (Number(credit.pendingAllocationAmount) || 0) -
        (Number(credit.totalAllocationRequestAmount) || 0),
    }));

    return res.status(200).json({
      success: true,
      count: data.length,
      message: "Fetched pending and partially allocated credits successfully.",
      data,
    });
  } catch (error) {
    console.error("Error fetching pending and partial credits:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch credit records.",
    });
  }
};