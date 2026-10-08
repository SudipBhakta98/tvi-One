import mongoose from "mongoose";
import Payment from "../models/paymentModel.js";
import Payable from "../models/payableModel.js";

/**
 * Get financial information for one invoice.
 *
 * Rule:
 *
 * outstanding =
 *   netPayable - approvedPayments
 *
 * maxAllowed =
 *   outstanding - pendingPayments
 *
 * For payment editing, pass excludePaymentId so the
 * payment currently being edited is not counted as
 * another pending payment.
 */
export const getInvoiceFinancials = async ({
  invoiceNumber,
  grnNumber,
  session,
  excludePaymentId = null,
}) => {
  /*
   * ---------------------------------------------------------
   * 1. Find payable
   * ---------------------------------------------------------
   */

  const payableQuery = Payable.findOne({
    invoiceNumber,
    grnNumber,
  });

  if (session) {
    payableQuery.session(session);
  }

  const payable = await payableQuery;

  if (!payable) {
    throw new Error("PAYABLE_NOT_FOUND");
  }

  /*
   * ---------------------------------------------------------
   * 2. Get net payable
   * ---------------------------------------------------------
   *
   * Change this section if your Payable model uses another
   * field as the final/net payable amount.
   */

  const netPayable = Number(
    payable.actualPayableAmount ??
      payable.actual_payable_amount ??
      payable.payableAmount ??
      payable.totalAmount ??
      0
  );

  if (!Number.isFinite(netPayable) || netPayable < 0) {
    throw new Error("INVALID_PAYABLE_AMOUNT");
  }

  /*
   * ---------------------------------------------------------
   * 3. Build payment query
   * ---------------------------------------------------------
   */

  const match = {
    invoiceNumber,
    grnNumber,
    status: {
      $in: ["Pending", "Approved"],
    },
  };

  /*
   * When editing a pending payment, don't count that
   * payment as another pending payment.
   */
  if (excludePaymentId) {
    match._id = {
      $ne: new mongoose.Types.ObjectId(
        excludePaymentId
      ),
    };
  }

  /*
   * ---------------------------------------------------------
   * 4. ONE aggregation for BOTH totals
   * ---------------------------------------------------------
   */

  const aggregation = Payment.aggregate([
    {
      $match: match,
    },

    {
      $group: {
        _id: null,

        totalPendingPayment: {
          $sum: {
            $cond: [
              {
                $eq: [
                  "$status",
                  "Pending",
                ],
              },
              "$paidAmount",
              0,
            ],
          },
        },

        totalApprovedPayment: {
          $sum: {
            $cond: [
              {
                $eq: [
                  "$status",
                  "Approved",
                ],
              },
              "$paidAmount",
              0,
            ],
          },
        },
      },
    },

    {
      $project: {
        _id: 0,
        totalPendingPayment: 1,
        totalApprovedPayment: 1,
      },
    },
  ]);

  if (session) {
    aggregation.session(session);
  }

  const [paymentTotals] =
    await aggregation;

  const totalPendingPayment =
    Number(
      paymentTotals?.totalPendingPayment || 0
    );

  const totalApprovedPayment =
    Number(
      paymentTotals?.totalApprovedPayment || 0
    );

  /*
   * ---------------------------------------------------------
   * 5. Calculate in JavaScript
   * ---------------------------------------------------------
   */

  const outstandingAmount = Math.max(
    0,
    netPayable - totalApprovedPayment
  );

  const maxAllowedAmount = Math.max(
    0,
    outstandingAmount -
      totalPendingPayment
  );

  return {
    payable,

    netPayable,

    totalApprovedPayment,

    totalPendingPayment,

    outstandingAmount,

    maxAllowedAmount,
  };
};