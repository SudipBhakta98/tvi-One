import Credit from "../../models/creditModel.js";

export const createCredit = async (req, res) => {
  try {
    if (req.user?.role !== "Super User") {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to create a Credit Note.",
      });
    }

    const {
      creditNoteNumber,
      creditNoteAmount,
      creditNoteDate,
    } = req.body;

    const number = String(creditNoteNumber || "").trim();
    const amount = Number(creditNoteAmount);
    const date = new Date(creditNoteDate);

    if (!number) {
      return res.status(400).json({
        success: false,
        message: "Please provide the Credit Note Number.",
      });
    }

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a Credit Note Amount greater than 0.",
      });
    }

    if (!creditNoteDate || isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid Credit Note Date.",
      });
    }

    const existingCredit = await Credit.findOne({
      creditNoteNumber: number,
    }).lean();

    if (existingCredit) {
      return res.status(409).json({
        success: false,
        message: `Credit Note '${number}' already exists.`,
      });
    }

    const credit = await Credit.create({
      creditNoteNumber: number,
      creditNoteAmount: amount,
      totalAllocatedAmount: 0,
      totalAllocationRequestAmount: 0,
      pendingAllocationAmount: amount,
      allocationRequest: [],
      allocations: [],
      creditNoteDate: date,
      createdBy: req.user._id,
      status: "Pending",
      updateLogs: [],
    });

    return res.status(201).json({
      success: true,
      message: "Credit Note created successfully.",
      data: credit,
    });
  } catch (error) {
    console.error("Error creating Credit Note:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This Credit Note Number already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong while creating the Credit Note.",
    });
  }
};