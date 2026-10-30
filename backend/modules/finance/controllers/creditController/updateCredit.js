import { canManageCreditNotes } from "../../utils/creditNoteAuthorization.js";
import Credit from "../../models/creditModel.js";

export const updateCredit = async (req, res) => {
  try {
    if (!canManageCreditNotes(req.user)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update a Credit Note.",
      });
    }

    const { creditNoteNumber } = req.params;

    const {
      newCreditNoteNumber,
      creditNoteAmount,
      creditNoteDate,
      remark,
    } = req.body;

    if (!remark || String(remark).trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Please provide a reason for updating the Credit Note.",
      });
    }

    const credit = await Credit.findOne({
      creditNoteNumber: String(creditNoteNumber).trim(),
    });

    if (!credit) {
      return res.status(404).json({
        success: false,
        message: "Credit Note not found.",
      });
    }

    const oldAmount = credit.creditNoteAmount;
    const oldNumber = credit.creditNoteNumber;

    const newAmount =
      creditNoteAmount !== undefined
        ? Number(creditNoteAmount)
        : credit.creditNoteAmount;

    if (isNaN(newAmount) || newAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a Credit Note Amount greater than 0.",
      });
    }

    const allocatedAndRequested =
      credit.totalAllocatedAmount +
      credit.totalAllocationRequestAmount;

    if (newAmount < allocatedAndRequested) {
      return res.status(400).json({
        success: false,
        message:
          "Credit Note Amount cannot be less than the allocated and requested amount.",
      });
    }

    let updatedNumber = oldNumber;

    if (newCreditNoteNumber !== undefined) {
      if (credit.status !== "Pending") {
        return res.status(400).json({
          success: false,
          message:
            "Credit Note Number can only be changed while the Credit Note is Pending.",
        });
      }

      updatedNumber = String(newCreditNoteNumber).trim();

      if (!updatedNumber) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid Credit Note Number.",
        });
      }

      if (updatedNumber !== oldNumber) {
        const existingCredit = await Credit.findOne({
          creditNoteNumber: updatedNumber,
          _id: { $ne: credit._id },
        }).lean();

        if (existingCredit) {
          return res.status(409).json({
            success: false,
            message: `Credit Note '${updatedNumber}' already exists.`,
          });
        }
      }
    }

    let updatedDate = credit.creditNoteDate;

    if (creditNoteDate !== undefined) {
      const parsedDate = new Date(creditNoteDate);

      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid Credit Note Date.",
        });
      }

      updatedDate = parsedDate;
    }

    const changes = [];

    if (oldAmount !== newAmount) {
      changes.push(
        `Amount changed from ${oldAmount} to ${newAmount}.`,
      );
    }

    if (oldNumber !== updatedNumber) {
      changes.push(
        `Credit Note Number changed from ${oldNumber} to ${updatedNumber}.`,
      );
    }

    if (
      credit.creditNoteDate.getTime() !== updatedDate.getTime()
    ) {
      changes.push("Credit Note Date was updated.");
    }

    if (!changes.length) {
      return res.status(400).json({
        success: false,
        message: "No changes were made to the Credit Note.",
      });
    }

    credit.creditNoteNumber = updatedNumber;
    credit.creditNoteAmount = newAmount;
    credit.creditNoteDate = updatedDate;

    credit.pendingAllocationAmount =
      newAmount -
      credit.totalAllocatedAmount -
      credit.totalAllocationRequestAmount;

    credit.updateLogs.push({
      updatedBy: req.user._id,
      updatedAt: new Date(),
      remark: `${changes.join(" ")} Reason: ${String(remark).trim()}`,
    });

    await credit.save();

    return res.status(200).json({
      success: true,
      message: "Credit Note updated successfully.",
      data: credit,
    });
  } catch (error) {
    console.error("Error updating Credit Note:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This Credit Note Number already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong while updating the Credit Note.",
    });
  }
};