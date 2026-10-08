import mongoose from "mongoose";

import Debit from "../../models/debitModel.js";

import {
  getInvoiceFinancials,
} from "../../utils/invoiceFinancials.js";

export const createDebit = async (
  req,
  res
) => {
  const session =
    await mongoose.startSession();

  try {
    const {
      invoiceNumber,
      grnNumber,
      debitAmount,
      description,
    } = req.body;

    const userId =
      req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Your login session is invalid. Please log in again.",
      });
    }

    const trimmedInvoiceNumber =
      String(
        invoiceNumber || ""
      ).trim();

    const trimmedGrnNumber =
      String(
        grnNumber || ""
      ).trim();

    const parsedDebitAmount =
      Number(debitAmount);

    const trimmedDescription =
      String(
        description || ""
      ).trim();

    const errors = [];

    if (!trimmedInvoiceNumber) {
      errors.push(
        "Please provide the invoice number."
      );
    }

    if (!trimmedGrnNumber) {
      errors.push(
        "Please provide the GRN number."
      );
    }

    if (
      !Number.isFinite(
        parsedDebitAmount
      ) ||
      parsedDebitAmount <= 0
    ) {
      errors.push(
        "Please provide a debit amount greater than 0."
      );
    }

    if (errors.length) {
      return res.status(400).json({
        success: false,
        message:
          "Please correct the debit note details.",
        errors,
      });
    }

    let createdDebitId = null;

    await session.withTransaction(
      async () => {
        /*
         * -----------------------------------------------------
         * Calculate:
         *
         * outstanding
         * pending payments
         * max allowed debit
         * -----------------------------------------------------
         */

        const financials =
          await getInvoiceFinancials({
            invoiceNumber:
              trimmedInvoiceNumber,
            grnNumber:
              trimmedGrnNumber,
            session,
          });

        /*
         * -----------------------------------------------------
         * BACKEND DEBIT LIMIT
         * -----------------------------------------------------
         */

        if (
          parsedDebitAmount >
          financials.maxAllowedAmount
        ) {
          const error =
            new Error(
              "DEBIT_LIMIT_EXCEEDED"
            );

          error.details =
            financials;

          throw error;
        }

        /*
         * -----------------------------------------------------
         * Create Debit
         * -----------------------------------------------------
         */

        const [debit] =
          await Debit.create(
            [
              {
                invoiceNumber:
                  trimmedInvoiceNumber,
                grnNumber:
                  trimmedGrnNumber,
                debitAmount:
                  parsedDebitAmount,
                description:
                  trimmedDescription,
                createdBy:
                  userId,
                updateLogs: [],
              },
            ],
            { session }
          );

        createdDebitId =
          debit._id;
      }
    );

    return res.status(201).json({
      success: true,
      message:
        "Debit note created successfully.",
      data: {
        debitId:
          createdDebitId,
      },
    });
  } catch (error) {
    console.error(
      "Error in createDebit:",
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
        maxAllowedAmount:
          error.details
            ?.maxAllowedAmount,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while creating the debit note.",
    });
  } finally {
    await session.endSession();
  }
};