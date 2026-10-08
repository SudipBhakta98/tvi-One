import mongoose from "mongoose";

import Debit from "../../models/debitModel.js";

import {
  getInvoiceFinancials,
} from "../../utils/invoiceFinancials.js";

export const editDebit = async (
  req,
  res
) => {
  const session =
    await mongoose.startSession();

  try {
    const userId =
      req.user?._id;

    const {
      id,
    } = req.params;

    const {
      debitAmount,
      description,
      remark,
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Your login session is invalid. Please log in again.",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "The debit note ID is not valid.",
      });
    }

    const trimmedRemark =
      String(
        remark || ""
      ).trim();

    if (!trimmedRemark) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a remark for the update log.",
      });
    }

    const debit =
      await Debit.findById(id);

    if (!debit) {
      return res.status(404).json({
        success: false,
        message:
          "Debit note not found.",
      });
    }

    const parsedAmount =
      debitAmount !==
      undefined
        ? Number(debitAmount)
        : Number(
            debit.debitAmount
          );

    if (
      !Number.isFinite(
        parsedAmount
      ) ||
      parsedAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a valid debit amount greater than 0.",
      });
    }

    const trimmedDescription =
      description !==
      undefined
        ? String(
            description
          ).trim()
        : debit.description;

    await session.withTransaction(
      async () => {
        const financials =
          await getInvoiceFinancials({
            invoiceNumber:
              debit.invoiceNumber,
            grnNumber:
              debit.grnNumber,
            session,
          });

        /*
         * The current debit is already part of the existing
         * accounting state.
         *
         * Therefore, give it back before checking the
         * replacement amount.
         */

        const currentDebitAmount =
          Number(
            debit.debitAmount
          ) || 0;

        const maxAllowedDebit =
          Math.max(
            0,
            financials.maxAllowedAmount +
              currentDebitAmount
          );

        if (
          parsedAmount >
          maxAllowedDebit
        ) {
          const error =
            new Error(
              "DEBIT_LIMIT_EXCEEDED"
            );

          error.details = {
            ...financials,
            currentDebitAmount,
            maxAllowedDebit,
          };

          throw error;
        }

        debit.debitAmount =
          parsedAmount;

        debit.description =
          trimmedDescription;

        debit.updateLogs.push({
          updatedBy:
            userId,
          updatedAt:
            new Date(),
          remark:
            trimmedRemark,
        });

        await debit.save({
          session,
        });
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Debit note updated successfully.",
    });
  } catch (error) {
    console.error(
      "Error in editDebit:",
      error
    );

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
      "DEBIT_LIMIT_EXCEEDED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Debit amount exceeds the maximum allowed debit amount.",
        outstandingAmount:
          error.details
            ?.outstandingAmount,
        totalPendingPayment:
          error.details
            ?.totalPendingPayment,
        currentDebitAmount:
          error.details
            ?.currentDebitAmount,
        maxAllowedDebit:
          error.details
            ?.maxAllowedDebit,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while updating the debit note.",
    });
  } finally {
    await session.endSession();
  }
};