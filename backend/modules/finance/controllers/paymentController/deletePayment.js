import mongoose from "mongoose";
import Payment from "../../models/paymentModel.js";
import Credit from "../../models/creditModel.js";
import { releaseAdvances, advanceErrorResponse } from "../../utils/advanceSettlement.js";

export const deletePayment = async (req, res) => {
  const { paymentId } = req.params;

  if (req.user?.role !== "Super User") {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to delete this payment.",
    });
  }

  if (!mongoose.Types.ObjectId.isValid(paymentId)) {
    return res.status(400).json({
      success: false,
      message: "The payment ID is not valid.",
    });
  }

  const payment = await Payment.findById(paymentId).lean();

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: "We couldn't find this payment.",
    });
  }

  if (payment.paymentType === "ADVANCE") {
    return res.status(400).json({
      success: false,
      message: "Advance payments cannot be deleted here. Cancel the advance from the Advance Register.",
    });
  }

  if (payment.status === "Approved") {
    return res.status(400).json({
      success: false,
      message: "Approved payments cannot be deleted.",
    });
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // Give back any advance reserved by this (pending) payment.
      if (payment.status === "Pending") {
        await releaseAdvances({
          payment,
          userId: req.user._id,
          session,
          reason: `payment ${paymentId} was deleted.`,
        });
      }

      // Rejected payments already released their credit request.
      if (payment.creditNoteNumber && payment.status === "Pending") {
        const credit = await Credit.findOne({
          creditNoteNumber: payment.creditNoteNumber,
        }).session(session);

        if (!credit) {
          throw new Error("CREDIT_NOT_FOUND");
        }

        const request = credit.allocationRequest.find(
          (r) =>
            r.paymentId.toString() === payment._id.toString(),
        );

        if (!request) {
          throw new Error("ALLOCATION_REQUEST_NOT_FOUND");
        }

        // Remove pending allocation request
        credit.totalAllocationRequestAmount -=
          request.requestAmount;

        credit.allocationRequest.pull({
          paymentId: payment._id,
        });

        // Update status
        if (
          credit.totalAllocatedAmount ===
          credit.creditNoteAmount
        ) {
          credit.status = "Fully Allocated";
        } else if (credit.totalAllocatedAmount > 0) {
          credit.status = "Partially Allocated";
        } else {
          credit.status = "Pending";
        }

        credit.updateLogs.push({
          updatedBy: req.user._id,
          updatedAt: new Date(),
          remark: `Allocation request removed because payment ${paymentId} was deleted.`,
        });

        await credit.save({ session });
      }

      await Payment.deleteOne(
        { _id: paymentId },
        { session },
      );
    });

    return res.status(200).json({
      success: true,
      message: "Payment has been deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting payment:", error);

    const adv = advanceErrorResponse(error);
    if (adv) {
      return res.status(adv[0]).json({ success: false, message: adv[1] });
    }

    if (error.message === "CREDIT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Associated Credit Note could not be found.",
      });
    }

    if (error.message === "ALLOCATION_REQUEST_NOT_FOUND") {
      return res.status(409).json({
        success: false,
        message: "Payment allocation request could not be found.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while deleting the payment.",
    });
  } finally {
    await session.endSession();
  }
};