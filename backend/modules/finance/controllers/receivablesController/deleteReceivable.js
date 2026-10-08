import mongoose from "mongoose";
import Receivable from "../../models/receivableModel.js";
import Collection from "../../models/collectionModel.js";

export const deleteReceivable = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid receivable ID." });
    }

    let summary = null;

    await session.withTransaction(async () => {
      const receivable = await Receivable.findById(id).session(session);
      if (!receivable) throw new Error("RECEIVABLE_NOT_FOUND");

      const { invoiceNumber, grnNumber } = receivable;
      const collectionDelete = await Collection.deleteMany({ invoiceNumber, grnNumber }, { session });
      await Receivable.findByIdAndDelete(id, { session });

      summary = {
        deletedReceivableId: id,
        invoiceNumber,
        grnNumber,
        deletedCollectionsCount: collectionDelete.deletedCount || 0,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Receivable and all associated collections deleted successfully.",
      summary,
    });
  } catch (error) {
    if (error.message === "RECEIVABLE_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Receivable record not found." });
    }
    console.error("Error deleting receivable:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  } finally {
    await session.endSession();
  }
};
