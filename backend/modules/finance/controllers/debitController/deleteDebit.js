import Debit from "../../models/debitModel.js";
import mongoose from "mongoose";

export const deleteDebit = async (req, res) => {
  try {
    const { debitId } = req.params;

    // 1. Check Super User permission
    if (req.user?.role !== "Super User") {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this debit note.",
      });
    }

    // 2. Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(debitId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid debit record.",
      });
    }

    // 3. Find debit note
    const debit = await Debit.findById(debitId);

    if (!debit) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find this debit note.",
      });
    }

    // 4. Delete debit note
    await Debit.findByIdAndDelete(debitId);

    // 5. Success response
    return res.status(200).json({
      success: true,
      message: "Debit note has been deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting debit note:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while deleting the debit note. Please try again.",
    });
  }
};