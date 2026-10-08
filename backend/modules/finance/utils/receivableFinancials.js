import mongoose from "mongoose";
import Receivable from "../models/receivableModel.js";
import Collection from "../models/collectionModel.js";

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Financials of one receivable invoice.
 *
 *   outstanding = totalAmount - approved (received + TDS)
 *   maxAllowed  = outstanding - pending (received + TDS)
 *
 * When editing a pending collection pass excludeCollectionId so it is not
 * counted against itself.
 */
export const getReceivableFinancials = async ({
  invoiceNumber,
  grnNumber,
  session,
  excludeCollectionId = null,
}) => {
  const receivable = await Receivable.findOne({ invoiceNumber, grnNumber }).session(session);
  if (!receivable) throw new Error("RECEIVABLE_NOT_FOUND");

  const match = { invoiceNumber, grnNumber, status: { $in: ["Pending", "Approved"] } };
  if (excludeCollectionId) match._id = { $ne: new mongoose.Types.ObjectId(excludeCollectionId) };

  const settledWhen = (status) => ({
    $sum: {
      $cond: [{ $eq: ["$status", status] }, { $add: ["$receivedAmount", "$tdsAmount"] }, 0],
    },
  });

  const aggregation = Collection.aggregate([
    { $match: match },
    { $group: { _id: null, pending: settledWhen("Pending"), approved: settledWhen("Approved") } },
  ]);
  if (session) aggregation.session(session);
  const [totals] = await aggregation;

  const totalAmount = Number(receivable.totalAmount);
  const totalApproved = round2(totals?.approved);
  const totalPending = round2(totals?.pending);
  const outstandingAmount = Math.max(0, round2(totalAmount - totalApproved));
  const maxAllowedAmount = Math.max(0, round2(outstandingAmount - totalPending));

  return { receivable, totalAmount, totalApproved, totalPending, outstandingAmount, maxAllowedAmount };
};
