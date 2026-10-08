import mongoose from "mongoose";

import Payment from "../../models/paymentModel.js";
import Credit from "../../models/creditModel.js";

import {
  getInvoiceFinancials,
} from "../../utils/invoiceFinancials.js";

import {
  round2,
  normalizeAdvanceInput,
  reserveAdvances,
  releaseAdvances,
  advanceErrorResponse,
} from "../../utils/advanceSettlement.js";

const getCreditStatus = (
  allocated,
  max
) =>
  allocated === 0
    ? "Pending"
    : allocated < max
      ? "Partially Allocated"
      : "Fully Allocated";

export const updatePayment = async (
  req,
  res
) => {
  const session =
    await mongoose.startSession();

  try {
    const {
      paymentId,
    } = req.params;

    const userId =
      req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Your login session is invalid. Please log in again.",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        paymentId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "The payment ID is not valid.",
      });
    }

    const {
      supplierName,
      paidAmount,
      paymentDate,
      paymentMethod,
      transactionNumber,
      creditNoteNumber,
      advanceAllocations,
      remark,
    } = req.body;

    const trimmedRemark =
      String(
        remark || ""
      ).trim();

    if (!trimmedRemark) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a reason for updating the payment.",
      });
    }

    const payment =
      await Payment.findById(
        paymentId
      );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message:
          "Payment record not found.",
      });
    }

    if (payment.paymentType === "ADVANCE") {
      return res.status(400).json({
        success: false,
        message:
          "Advance payments cannot be edited here. Use the Advance Register.",
      });
    }

    if (
      payment.status ===
      "Approved"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Approved payments cannot be edited.",
      });
    }

    /*
     * ---------------------------------------------------------
     * Normalize fields
     * ---------------------------------------------------------
     */

    const allowedMethods = [
      "CASH",
      "BANK",
      "CHEQUE",
      "ONLINE",
      "UPI",
    ];

    const newPaymentMethod =
      paymentMethod !==
      undefined
        ? String(
            paymentMethod
          )
            .toUpperCase()
            .trim()
        : payment.paymentMethod;

    if (
      !allowedMethods.includes(
        newPaymentMethod
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please select Cash, Bank, Cheque, Online, or UPI as the payment method.",
      });
    }

    const newPaidAmount =
      paidAmount !==
      undefined
        ? Number(paidAmount)
        : Number(
            payment.paidAmount
          );

    if (
      !Number.isFinite(
        newPaidAmount
      ) ||
      newPaidAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a payment amount greater than 0.",
      });
    }

    let newPaymentDate =
      payment.paymentDate;

    if (
      paymentDate !==
      undefined
    ) {
      const parsedDate =
        new Date(
          paymentDate
        );

      if (
        Number.isNaN(
          parsedDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please provide a valid payment date.",
        });
      }

      newPaymentDate =
        parsedDate;
    }

    const newSupplierName =
      supplierName !==
      undefined
        ? String(
            supplierName
          ).trim()
        : payment.supplierName;

    if (!newSupplierName) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide the supplier name.",
      });
    }

    let newCreditNoteNumber =
      payment.creditNoteNumber
        ? String(
            payment.creditNoteNumber
          ).trim()
        : null;

    let newTransactionNumber =
      payment.transactionNumber
        ? String(
            payment.transactionNumber
          ).trim()
        : null;

    if (
      creditNoteNumber !==
      undefined
    ) {
      newCreditNoteNumber =
        String(
          creditNoteNumber
        ).trim();
    }

    if (
      transactionNumber !==
      undefined
    ) {
      newTransactionNumber =
        String(
          transactionNumber
        ).trim();
    }

    /*
     * Advance handling
     *
     * advanceAllocations === undefined -> keep the advance already on the payment
     * advanceAllocations === []        -> remove the advance from the payment
     * advanceAllocations === [...]     -> use exactly these advances
     */

    let newAdvanceItems;

    try {
      newAdvanceItems =
        advanceAllocations === undefined
          ? normalizeAdvanceInput(
              (payment.advanceAllocations || []).map(
                (a) => ({
                  advanceId: a.advanceId,
                  amount: a.amount,
                })
              )
            )
          : normalizeAdvanceInput(
              advanceAllocations
            );
    } catch (e) {
      return res.status(400).json({
        success: false,
        message:
          "The advance details are not valid.",
      });
    }

    const newAdvanceTotal = round2(
      newAdvanceItems.reduce(
        (sum, a) => sum + a.amount,
        0
      )
    );

    const newCreditAmount = round2(
      newPaidAmount - newAdvanceTotal
    );

    if (newAdvanceTotal > newPaidAmount + 0.001) {
      return res.status(400).json({
        success: false,
        message:
          "The advance used cannot be more than the payment amount.",
      });
    }

    /*
     * Credit Note is required only for the part
     * that is not covered by advance.
     */

    if (
      newCreditAmount > 0 &&
      !newCreditNoteNumber
    ) {
      return res.status(400).json({
        success: false,
        message:
          newAdvanceTotal > 0
            ? `₹${newCreditAmount} is not covered by the advance. Please select a Credit Note for the remaining amount.`
            : "Please provide the Credit Note Number.",
      });
    }

    if (
      newCreditAmount > 0 &&
      newPaymentMethod !==
        "CASH" &&
      !newTransactionNumber
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Please provide the transaction number for ${newPaymentMethod} payments.`,
      });
    }

    const oldCreditNoteNumber =
      payment.creditNoteNumber
        ? String(
            payment.creditNoteNumber
          ).trim()
        : null;

    /*
     * ---------------------------------------------------------
     * Transaction
     * ---------------------------------------------------------
     */

    await session.withTransaction(
      async () => {
        /*
         * Exclude the current payment.
         */

        const financials =
          await getInvoiceFinancials({
            invoiceNumber:
              payment.invoiceNumber,
            grnNumber:
              payment.grnNumber,
            session,
            excludePaymentId:
              paymentId,
          });

        /*
         * -----------------------------------------------------
         * BACKEND PAYMENT EDIT LIMIT
         * -----------------------------------------------------
         */

        if (
          newPaidAmount >
          financials.maxAllowedAmount
        ) {
          const error =
            new Error(
              "PAYMENT_LIMIT_EXCEEDED"
            );

          error.details =
            financials;

          throw error;
        }

        /*
         * -----------------------------------------------------
         * Release old advance reservations
         * -----------------------------------------------------
         */

        if (
          payment.status ===
          "Pending"
        ) {
          await releaseAdvances({
            payment,
            userId,
            session,
            reason: `payment ${paymentId} was updated.`,
          });
        }

        /*
         * -----------------------------------------------------
         * Remove old credit request
         * -----------------------------------------------------
         */

        if (
          payment.status ===
            "Pending" &&
          oldCreditNoteNumber
        ) {
          const oldCredit =
            await Credit.findOne({
              creditNoteNumber:
                oldCreditNoteNumber,
            }).session(session);

          if (!oldCredit) {
            throw new Error(
              "OLD_CREDIT_NOT_FOUND"
            );
          }

          const index =
            oldCredit.allocationRequest.findIndex(
              (item) =>
                item.paymentId.toString() ===
                paymentId
            );

          if (index === -1) {
            throw new Error(
              "OLD_ALLOCATION_REQUEST_NOT_FOUND"
            );
          }

          const [
            oldRequest,
          ] =
            oldCredit.allocationRequest.splice(
              index,
              1
            );

          oldCredit.totalAllocationRequestAmount -=
            Number(
              oldRequest.requestAmount
            );

          if (
            oldCredit.totalAllocationRequestAmount <
            0
          ) {
            oldCredit.totalAllocationRequestAmount = 0;
          }

          oldCredit.status =
            getCreditStatus(
              oldCredit.totalAllocatedAmount,
              oldCredit.creditNoteAmount
            );

          oldCredit.updateLogs.push({
            updatedBy:
              userId,
            updatedAt:
              new Date(),
            remark: `Allocation request removed because payment ${paymentId} was updated.`,
          });

          await oldCredit.save({
            session,
          });
        }

        /*
         * -----------------------------------------------------
         * Add new credit request
         * -----------------------------------------------------
         */

        if (newCreditAmount > 0) {
        const newCredit =
          await Credit.findOne({
            creditNoteNumber:
              newCreditNoteNumber,
          }).session(session);

        if (!newCredit) {
          throw new Error(
            "NEW_CREDIT_NOT_FOUND"
          );
        }

        const availableAmount =
          Number(
            newCredit.pendingAllocationAmount
          ) -
          Number(
            newCredit.totalAllocationRequestAmount
          );

        if (
          newCreditAmount >
          availableAmount
        ) {
          throw new Error(
            "CREDIT_INSUFFICIENT_BALANCE"
          );
        }

        newCredit.totalAllocationRequestAmount +=
          newCreditAmount;

        newCredit.allocationRequest.push({
          paymentId:
            payment._id,
          requestAmount:
            newCreditAmount,
          requestedAt:
            new Date(),
        });

        newCredit.status =
          getCreditStatus(
            newCredit.totalAllocatedAmount,
            newCredit.creditNoteAmount
          );

        newCredit.updateLogs.push({
          updatedBy:
            userId,
          updatedAt:
            new Date(),
          remark: `Allocation request created because payment ${paymentId} was updated.`,
        });

        await newCredit.save({
          session,
        });
        }

        /*
         * -----------------------------------------------------
         * Reserve new advances
         * -----------------------------------------------------
         */

        let newAdvanceAllocations = [];

        if (newAdvanceItems.length) {
          newAdvanceAllocations =
            await reserveAdvances({
              items: newAdvanceItems,
              payment,
              supplierName:
                newSupplierName,
              userId,
              session,
            });
        }

        /*
         * -----------------------------------------------------
         * Update Payment
         * -----------------------------------------------------
         */

        payment.supplierName =
          newSupplierName;

        payment.paidAmount =
          newPaidAmount;

        payment.paymentDate =
          newPaymentDate;

        payment.paymentMethod =
          newPaymentMethod;

        payment.creditNoteNumber =
          newCreditAmount > 0
            ? newCreditNoteNumber
            : null;

        payment.advanceAllocations =
          newAdvanceAllocations;

        payment.advanceAmount =
          newAdvanceTotal;

        payment.transactionNumber =
          newPaymentMethod ===
            "CASH" ||
          newCreditAmount <= 0
            ? null
            : newTransactionNumber;

        payment.status =
          "Pending";

        payment.approvedBy =
          undefined;

        payment.approvedAt =
          undefined;

        payment.updateLogs.push({
          updatedBy:
            userId,
          updatedAt:
            new Date(),
          remark:
            trimmedRemark,
        });

        await payment.save({
          session,
        });
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Payment updated successfully and sent for approval again.",
    });
  } catch (error) {
    console.error(
      "Error updating payment:",
      error
    );

    const adv =
      advanceErrorResponse(error);

    if (adv) {
      return res
        .status(adv[0])
        .json({
          success: false,
          message: adv[1],
        });
    }

    if (
      error.message ===
      "PAYABLE_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message:
          "The payable invoice could not be found.",
      });
    }

    if (
      error.message ===
      "PAYMENT_LIMIT_EXCEEDED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount exceeds the maximum allowed payment amount.",
        outstandingAmount:
          error.details
            ?.outstandingAmount,
        totalPendingPayment:
          error.details
            ?.totalPendingPayment,
        maxAllowedAmount:
          error.details
            ?.maxAllowedAmount,
      });
    }

    if (
      error.message ===
      "OLD_CREDIT_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message:
          "The previous Credit Note could not be found.",
      });
    }

    if (
      error.message ===
      "NEW_CREDIT_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message:
          "The new Credit Note could not be found.",
      });
    }

    if (
      error.message ===
      "OLD_ALLOCATION_REQUEST_NOT_FOUND"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "The payment's existing allocation request could not be found.",
      });
    }

    if (
      error.message ===
      "CREDIT_INSUFFICIENT_BALANCE"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "The Credit Note does not have enough available allocation balance for this payment.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while updating the payment.",
    });
  } finally {
    await session.endSession();
  }
};