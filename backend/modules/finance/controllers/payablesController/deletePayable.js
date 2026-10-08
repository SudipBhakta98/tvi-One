import mongoose from "mongoose";
import Payable from "../../models/payableModel.js";
import Payment from "../../models/paymentModel.js";
import Debit from "../../models/debitModel.js";
import { releaseAdvances, restoreAdjustedAdvances } from "../../utils/advanceSettlement.js";

export const deletePayable = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;

    // 1. Validate Payable ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Please provide payable ID.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payable ID.",
      });
    }

    // 2. Start transaction
    session.startTransaction();

    // 3. Find Payable by ID
    const payableToDelete = await Payable.findById(id).session(session);

    if (!payableToDelete) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "Payable record not found.",
      });
    }

    // 4. Get invoiceNumber and grnNumber
    const { invoiceNumber, grnNumber } = payableToDelete;

    const compositeFilter = {
      invoiceNumber,
      grnNumber,
    };

    // 5a. Give advance balance back before its payments disappear
    const advancePayments = await Payment.find({
      ...compositeFilter,
      "advanceAllocations.0": { $exists: true },
    }).session(session);

    for (const p of advancePayments) {
      const args = {
        payment: p,
        userId: req.user?._id,
        session,
        reason: `invoice ${invoiceNumber} was deleted.`,
      };
      if (p.status === "Approved") await restoreAdjustedAdvances(args);
      else if (p.status === "Pending") await releaseAdvances(args);
    }

    // 5. Delete associated Payments
    const paymentDeleteResult = await Payment.deleteMany(
      compositeFilter,
      { session }
    );

    // 6. Delete associated Debits
    const debitDeleteResult = await Debit.deleteMany(
      compositeFilter,
      { session }
    );

    // 7. Delete Payable
    const deletedPayable = await Payable.findByIdAndDelete(id, {
      session,
    });

    // Safety check
    if (!deletedPayable) {
      throw new Error("Payable could not be deleted.");
    }

    // 8. Commit transaction
    await session.commitTransaction();

    // 9. Response
    return res.status(200).json({
      success: true,
      message:
        "Payable and all associated payments and debit notes deleted successfully.",
      summary: {
        deletedPayableId: deletedPayable._id,
        invoiceNumber,
        grnNumber,
        deletedPaymentsCount: paymentDeleteResult.deletedCount || 0,
        deletedDebitsCount: debitDeleteResult.deletedCount || 0,
      },
    });
  } catch (error) {
    // Rollback everything if anything fails
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("Error deleting payable:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  } finally {
    // Always close session
    await session.endSession();
  }
};