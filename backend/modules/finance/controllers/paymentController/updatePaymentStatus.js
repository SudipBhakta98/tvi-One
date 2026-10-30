import mongoose from "mongoose";
import Payment from "../../models/paymentModel.js";
import Credit from "../../models/creditModel.js";
import SupplierAdvance from "../../models/supplierAdvanceModel.js";
import { canManageCreditNotes } from "../../utils/creditNoteAuthorization.js";
import { ROLES } from "../../../../constants/roles.js";
import {
  settleAdvances,
  releaseAdvances,
  advanceErrorResponse,
} from "../../utils/advanceSettlement.js";

export const updatePaymentStatus = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { paymentId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({ success: false, message: "The payment ID is not valid." });
    }

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Please choose either Approve or Reject." });
    }

    const isApproved = status === "Approved";

    await session.withTransaction(async () => {
      const payment = await Payment.findById(paymentId).session(session);
      if (!payment) throw new Error("PAYMENT_NOT_FOUND");

      const actualRole = req.user?.originalRole || req.user?.role;
      const isSuperUser = actualRole === ROLES.SUPER_USER || actualRole === "Super User";
      const mayApproveCreditAllocation = payment.creditNoteNumber && canManageCreditNotes(req.user);
      if (!isSuperUser && !mayApproveCreditAllocation) {
        const e = new Error("FORBIDDEN_PAYMENT_STATUS");
        throw e;
      }

      if (payment.status !== "Pending") {
        const e = new Error("ALREADY_PROCESSED");
        e.status = payment.status;
        throw e;
      }

      /* ---- Advance payment itself: keep the advance register in sync ---- */
      if (payment.paymentType === "ADVANCE") {
        const advance = await SupplierAdvance.findOne({ paymentId: payment._id }).session(session);
        if (advance && advance.status === "Pending") {
          advance.status = isApproved ? "Approved" : "Cancelled";
          advance.updateLogs.push({
            updatedBy: req.user._id,
            remark: `Advance ${isApproved ? "approved" : "cancelled"} from payment approval.`,
          });
          await advance.save({ session });
        }
      }

      /* ---- Credit note portion (unchanged behaviour) ---- */
      if (payment.creditNoteNumber) {
        const credit = await Credit.findOne({ creditNoteNumber: payment.creditNoteNumber }).session(session);
        if (!credit) throw new Error("CREDIT_NOT_FOUND");

        const request = credit.allocationRequest.find((r) => r.paymentId.toString() === paymentId);
        if (!request) throw new Error("ALLOCATION_REQUEST_NOT_FOUND");

        const reqAmount = request.requestAmount;

        credit.totalAllocationRequestAmount -= reqAmount;
        if (isApproved) {
          credit.totalAllocatedAmount += reqAmount;
          credit.pendingAllocationAmount -= reqAmount;
          credit.allocations.push({ paymentId: payment._id, allocatedAmount: reqAmount, allocatedAt: new Date() });
        }

        credit.status =
          credit.totalAllocatedAmount === credit.creditNoteAmount
            ? "Fully Allocated"
            : credit.totalAllocatedAmount > 0
              ? "Partially Allocated"
              : "Pending";

        credit.allocationRequest.pull({ paymentId });
        credit.updateLogs.push({
          updatedBy: req.user._id,
          updatedAt: new Date(),
          remark: isApproved
            ? `Payment ${paymentId} was approved and allocated.`
            : `Payment ${paymentId} was rejected and allocation request was removed.`,
        });

        await credit.save({ session });
      }

      /* ---- Supplier advance portion ---- */
      if (payment.advanceAllocations?.length) {
        if (isApproved) {
          await settleAdvances({ payment, userId: req.user._id, session });
        } else {
          await releaseAdvances({
            payment,
            userId: req.user._id,
            session,
            reason: `payment ${paymentId} was rejected.`,
          });
        }
      }

      payment.status = status;
      payment.approvedBy = req.user._id;
      payment.approvedAt = new Date();
      await payment.save({ session });
    });

    return res.status(200).json({
      success: true,
      message: isApproved
        ? "Payment has been approved successfully."
        : "Payment has been rejected successfully.",
    });
  } catch (error) {
    console.error("Error updating payment status:", error);

    const adv = advanceErrorResponse(error);
    if (adv) return res.status(adv[0]).json({ success: false, message: adv[1] });

    if (error.message === "FORBIDDEN_PAYMENT_STATUS") {
      return res.status(403).json({ success: false, message: "Only Super User can approve or reject payments. Credit Note allocation requests can be actioned by Super User or Admin." });
    }
    if (error.message === "PAYMENT_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "We couldn't find this payment." });
    }
    if (error.message === "ALREADY_PROCESSED") {
      return res.status(400).json({ success: false, message: `This payment has already been ${String(error.status).toLowerCase()}.` });
    }
    if (error.message === "CREDIT_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Associated Credit Note could not be found." });
    }
    if (error.message === "ALLOCATION_REQUEST_NOT_FOUND") {
      return res.status(409).json({ success: false, message: "Payment allocation request could not be found." });
    }

    return res.status(500).json({ success: false, message: "Something went wrong while updating the payment status." });
  } finally {
    await session.endSession();
  }
};
