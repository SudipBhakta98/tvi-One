import mongoose from "mongoose";

import Payment from "../../models/paymentModel.js";
import Credit from "../../models/creditModel.js";
import SupplierAdvance from "../../models/supplierAdvanceModel.js";
import { canManageCreditNotes } from "../../utils/creditNoteAuthorization.js";

import { getInvoiceFinancials } from "../../utils/invoiceFinancials.js";
import {
  round2,
  normalizeAdvanceInput,
  reserveAdvances,
  settleAdvances,
  advanceErrorResponse,
} from "../../utils/advanceSettlement.js";

const getCreditStatus = (allocated, max) =>
  allocated === 0
    ? "Pending"
    : allocated < max
      ? "Partially Allocated"
      : "Fully Allocated";

/**
 * Create an invoice payment.
 *
 * A payment is settled by ONE type only:
 *   - Pay with Advance -> advanceAllocations: [{ advanceId, amount }] covering
 *     the whole paidAmount. Method is stored as "ADVANCE", the transaction
 *     number is the advance's own, there is no credit note, and the payment is
 *     approved (and the advance settled) immediately.
 *   - Add Payment      -> creditNoteNumber, normal Pending -> approval flow.
 */
export const createSinglePayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Your login session is invalid. Please log in again.",
      });
    }

    const {
      invoiceNumber,
      grnNumber,
      supplierName,
      paidAmount,
      paymentDate,
      paymentMethod,
      creditNoteNumber,
      transactionNumber,
      advanceAllocations,
    } = req.body;

    const inv = String(invoiceNumber || "").trim();
    const grn = String(grnNumber || "").trim();
    const supplier = String(supplierName || "").trim();
    const method = String(paymentMethod || "").toUpperCase().trim();
    const creditNo = creditNoteNumber ? String(creditNoteNumber).trim() : null;
    if (creditNo && !canManageCreditNotes(req.user)) {
      return res.status(403).json({ success: false, message: "Only Super User and Admin can use Credit Notes for payment allocation." });
    }
    const txnNo = String(transactionNumber || "").trim();
    const amount = round2(paidAmount);
    const date = new Date(paymentDate);

    /* ---------------- Basic validation ---------------- */

    const errors = [];

    if (!inv) errors.push("Please provide the invoice number.");
    if (!grn) errors.push("Please provide the GRN number.");
    if (!supplier) errors.push("Please provide the supplier name.");

    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push("Please provide a payment amount greater than 0.");
    }

    if (!paymentDate || Number.isNaN(date.getTime())) {
      errors.push("Please provide a valid payment date.");
    }

    let advanceItems = [];
    try {
      advanceItems = normalizeAdvanceInput(advanceAllocations);
    } catch (e) {
      errors.push("The advance details are not valid.");
    }

    const isAdvancePayment = advanceItems.length > 0;
    const advanceTotal = round2(advanceItems.reduce((s, a) => s + a.amount, 0));
    const creditAmount = isAdvancePayment ? 0 : amount;

    if (!isAdvancePayment && !["CASH", "BANK", "CHEQUE", "ONLINE", "UPI"].includes(method)) {
      errors.push("Please select Cash, Bank, Cheque, Online, or UPI as the payment method.");
    }

    // Advance and credit note are never mixed: an advance payment must cover the full amount.
    if (isAdvancePayment && Math.abs(advanceTotal - amount) > 0.001) {
      errors.push("Advance used must be equal to the payment amount.");
    }

    if (creditAmount > 0 && !creditNo) {
      errors.push("Please provide the Credit Note Number.");
    }

    if (creditAmount > 0 && method !== "CASH" && !txnNo) {
      errors.push(`Please provide the transaction number for ${method} payments.`);
    }

    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: "Please correct the payment details.",
        errors,
      });
    }

    let createdPaymentId = null;

    await session.withTransaction(async () => {
      const financials = await getInvoiceFinancials({
        invoiceNumber: inv,
        grnNumber: grn,
        session,
      });

      if (amount > financials.maxAllowedAmount + 0.001) {
        const error = new Error("PAYMENT_LIMIT_EXCEEDED");
        error.details = financials;
        throw error;
      }

      // Advance payment reuses the transaction number of the advance(s) being used.
      let advanceTxnNo = null;
      if (isAdvancePayment) {
        const advances = await SupplierAdvance.find({
          _id: { $in: advanceItems.map((a) => a.advanceId) },
        })
          .select("paymentId")
          .session(session)
          .lean();
        const advancePayments = await Payment.find({
          _id: { $in: advances.map((a) => a.paymentId) },
        })
          .select("transactionNumber")
          .session(session)
          .lean();
        advanceTxnNo =
          [...new Set(advancePayments.map((p) => p.transactionNumber).filter(Boolean))].join(", ") || null;
      }

      const [payment] = await Payment.create(
        [
          {
            invoiceNumber: inv,
            supplierName: supplier,
            grnNumber: grn,
            paidAmount: amount,
            paymentDate: date,
            paymentMethod: isAdvancePayment ? "ADVANCE" : method,
            creditNoteNumber: isAdvancePayment ? null : creditNo,
            transactionNumber: isAdvancePayment ? advanceTxnNo : method === "CASH" ? null : txnNo,
            advanceAmount: 0,
            advanceAllocations: [],
            paymentBy: userId,
            status: isAdvancePayment ? "Approved" : "Pending",
            ...(isAdvancePayment && { approvedBy: userId, approvedAt: new Date() }),
            updateLogs: [],
          },
        ],
        { session },
      );

      createdPaymentId = payment._id;

      /* ---- Advance: reserve what the user chose, then settle it right away ---- */
      if (isAdvancePayment) {
        payment.advanceAllocations = await reserveAdvances({
          items: advanceItems,
          payment,
          supplierName: supplier,
          userId,
          session,
        });
        payment.advanceAmount = advanceTotal;
        await payment.save({ session });
        await settleAdvances({ payment, userId, session });
      }

      /* ---- Credit note: only for the remaining part ---- */
      if (creditAmount > 0) {
        const credit = await Credit.findOne({ creditNoteNumber: creditNo }).session(session);

        if (!credit) throw new Error("CREDIT_NOT_FOUND");

        const availableAmount =
          Number(credit.pendingAllocationAmount) -
          Number(credit.totalAllocationRequestAmount);

        if (creditAmount > availableAmount + 0.001) {
          throw new Error("CREDIT_INSUFFICIENT_BALANCE");
        }

        credit.allocationRequest.push({
          paymentId: payment._id,
          requestAmount: creditAmount,
          requestedAt: new Date(),
        });

        credit.totalAllocationRequestAmount += creditAmount;

        credit.status = getCreditStatus(
          credit.totalAllocatedAmount,
          credit.creditNoteAmount,
        );

        credit.updateLogs.push({
          updatedBy: userId,
          updatedAt: new Date(),
          remark: `Allocation request created for payment ${payment._id}.`,
        });

        await credit.save({ session });
      }
    });

    return res.status(201).json({
      success: true,
      message: isAdvancePayment
        ? "Payment made from advance and approved successfully."
        : "Payment submitted successfully and is waiting for approval.",
      data: { paymentId: createdPaymentId },
    });
  } catch (error) {
    console.error("Error in createSinglePayment:", error);

    const adv = advanceErrorResponse(error);
    if (adv) {
      return res.status(adv[0]).json({ success: false, message: adv[1] });
    }

    if (error.message === "PAYABLE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "The payable invoice could not be found.",
      });
    }

    if (error.message === "PAYMENT_LIMIT_EXCEEDED") {
      return res.status(400).json({
        success: false,
        message: "Payment amount exceeds the maximum allowed payment amount.",
        outstandingAmount: error.details?.outstandingAmount,
        totalPendingPayment: error.details?.totalPendingPayment,
        maxAllowedAmount: error.details?.maxAllowedAmount,
      });
    }

    if (error.message === "CREDIT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "The selected Credit Note could not be found.",
      });
    }

    if (error.message === "CREDIT_INSUFFICIENT_BALANCE") {
      return res.status(400).json({
        success: false,
        message:
          "The Credit Note does not have enough available allocation balance for this payment.",
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A payment already exists for this Invoice and GRN combination.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong while creating the payment.",
    });
  } finally {
    await session.endSession();
  }
};
