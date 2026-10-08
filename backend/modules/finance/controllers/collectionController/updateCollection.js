import mongoose from "mongoose";
import Collection from "../../models/collectionModel.js";
import { getReceivableFinancials, round2 } from "../../utils/receivableFinancials.js";

/** Edit a collection that is not approved yet. It goes back to Pending for approval. */
export const updateCollection = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { collectionId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Your login session is invalid. Please log in again." });
    }
    if (!mongoose.Types.ObjectId.isValid(collectionId)) {
      return res.status(400).json({ success: false, message: "The collection ID is not valid." });
    }

    const { receivedAmount, tdsAmount, collectionDate, remark } = req.body;
    const trimmedRemark = String(remark || "").trim();
    if (!trimmedRemark) {
      return res.status(400).json({ success: false, message: "Please provide a reason for updating the collection." });
    }

    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res.status(404).json({ success: false, message: "Collection record not found." });
    }
    if (collection.status === "Approved") {
      return res.status(400).json({ success: false, message: "Approved collections cannot be edited." });
    }

    const newReceived = receivedAmount !== undefined ? round2(receivedAmount) : collection.receivedAmount;
    const newTds = tdsAmount !== undefined ? round2(tdsAmount) : collection.tdsAmount;
    const newDate = collectionDate !== undefined ? new Date(collectionDate) : collection.collectionDate;

    if (!Number.isFinite(newReceived) || newReceived <= 0) {
      return res.status(400).json({ success: false, message: "Please provide a received amount greater than 0." });
    }
    if (!Number.isFinite(newTds) || newTds < 0) {
      return res.status(400).json({ success: false, message: "TDS amount cannot be negative." });
    }
    if (Number.isNaN(newDate.getTime())) {
      return res.status(400).json({ success: false, message: "Please provide a valid collection date." });
    }

    await session.withTransaction(async () => {
      // This collection must not count against itself.
      const { maxAllowedAmount } = await getReceivableFinancials({
        invoiceNumber: collection.invoiceNumber,
        grnNumber: collection.grnNumber,
        session,
        excludeCollectionId: collectionId,
      });

      if (round2(newReceived + newTds) > maxAllowedAmount + 0.001) {
        const error = new Error("COLLECTION_LIMIT_EXCEEDED");
        error.maxAllowedAmount = maxAllowedAmount;
        throw error;
      }

      collection.receivedAmount = newReceived;
      collection.tdsAmount = newTds;
      collection.collectionDate = newDate;
      collection.status = "Pending";
      collection.approvedBy = undefined;
      collection.approvedAt = undefined;
      collection.updateLogs.push({ updatedBy: userId, updatedAt: new Date(), remark: trimmedRemark });

      await collection.save({ session });
    });

    return res.status(200).json({
      success: true,
      message: "Collection updated successfully and sent for approval again.",
    });
  } catch (error) {
    console.error("Error updating collection:", error);

    if (error.message === "RECEIVABLE_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "The receivable invoice could not be found." });
    }
    if (error.message === "COLLECTION_LIMIT_EXCEEDED") {
      return res.status(400).json({
        success: false,
        message: "Received amount + TDS exceeds the maximum allowed collection amount.",
        maxAllowedAmount: error.maxAllowedAmount,
      });
    }
    return res.status(500).json({ success: false, message: "Something went wrong while updating the collection." });
  } finally {
    await session.endSession();
  }
};
