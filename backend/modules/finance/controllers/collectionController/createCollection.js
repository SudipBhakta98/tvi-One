import mongoose from "mongoose";
import Collection from "../../models/collectionModel.js";
import { getReceivableFinancials, round2 } from "../../utils/receivableFinancials.js";

/**
 * Add a collection (money received) against a receivable invoice.
 * It is saved as Pending and waits on the Approve Receivable page.
 * Received + TDS must fit inside what is still open on the invoice.
 */
export const createCollection = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Your login session is invalid. Please log in again." });
    }

    const { invoiceNumber, grnNumber, receivedAmount, tdsAmount, collectionDate } = req.body;

    const inv = String(invoiceNumber || "").trim();
    const grn = String(grnNumber || "").trim();
    const received = round2(receivedAmount);
    const tds = round2(tdsAmount);
    const date = new Date(collectionDate);

    const errors = [];
    if (!inv) errors.push("Please provide the invoice number.");
    if (!grn) errors.push("Please provide the GRN number.");
    if (!Number.isFinite(received) || received <= 0) errors.push("Please provide a received amount greater than 0.");
    if (!Number.isFinite(tds) || tds < 0) errors.push("TDS amount cannot be negative.");
    if (!collectionDate || Number.isNaN(date.getTime())) errors.push("Please provide a valid collection date.");

    if (errors.length) {
      return res.status(400).json({ success: false, message: "Please correct the collection details.", errors });
    }

    let createdId = null;

    await session.withTransaction(async () => {
      const financials = await getReceivableFinancials({ invoiceNumber: inv, grnNumber: grn, session });

      if (round2(received + tds) > financials.maxAllowedAmount + 0.001) {
        const error = new Error("COLLECTION_LIMIT_EXCEEDED");
        error.details = financials;
        throw error;
      }

      const [collection] = await Collection.create(
        [
          {
            invoiceNumber: inv,
            grnNumber: grn,
            customerName: financials.receivable.customerName,
            receivedAmount: received,
            tdsAmount: tds,
            collectionDate: date,
            collectionBy: userId,
            status: "Pending",
            updateLogs: [],
          },
        ],
        { session },
      );
      createdId = collection._id;
    });

    return res.status(201).json({
      success: true,
      message: "Collection submitted successfully and is waiting for approval.",
      data: { collectionId: createdId },
    });
  } catch (error) {
    console.error("Error in createCollection:", error);

    if (error.message === "RECEIVABLE_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "The receivable invoice could not be found." });
    }
    if (error.message === "COLLECTION_LIMIT_EXCEEDED") {
      return res.status(400).json({
        success: false,
        message: "Received amount + TDS exceeds the maximum allowed collection amount.",
        outstandingAmount: error.details?.outstandingAmount,
        totalPendingCollection: error.details?.totalPending,
        maxAllowedAmount: error.details?.maxAllowedAmount,
      });
    }
    return res.status(500).json({ success: false, message: "Something went wrong while creating the collection." });
  } finally {
    await session.endSession();
  }
};
