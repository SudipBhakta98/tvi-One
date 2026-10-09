import mongoose from "mongoose";
import Receivable from "../../models/receivableModel.js";
import Collection from "../../models/collectionModel.js";

export const deleteReceivable = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;

    // 1. Validate Receivable ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Please provide receivable ID.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid receivable ID.",
      });
    }

    // 2. Start transaction
    session.startTransaction();

    // 3. Find Receivable by ID
    const receivableToDelete = await Receivable.findById(id).session(session);

    if (!receivableToDelete) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "Receivable record not found.",
      });
    }

    // 4. Get invoiceNumber and grnNumber
    const { invoiceNumber, grnNumber } = receivableToDelete;

    const compositeFilter = {
      invoiceNumber,
      grnNumber,
    };

    // 5. Delete associated Collections
    const collectionDeleteResult = await Collection.deleteMany(
      compositeFilter,
      { session }
    );

    // 6. Delete Receivable
    const deletedReceivable = await Receivable.findByIdAndDelete(id, {
      session,
    });

    // Safety check
    if (!deletedReceivable) {
      throw new Error("Receivable could not be deleted.");
    }

    // 7. Commit transaction
    await session.commitTransaction();

    // 8. Response
    return res.status(200).json({
      success: true,
      message:
        "Receivable and all associated collections deleted successfully.",
      summary: {
        deletedReceivableId: deletedReceivable._id,
        invoiceNumber,
        grnNumber,
        deletedCollectionsCount: collectionDeleteResult.deletedCount || 0,
      },
    });
  } catch (error) {
    // Rollback everything if anything fails
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("Error deleting receivable:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  } finally {
    // Always close session
    await session.endSession();
  }
};