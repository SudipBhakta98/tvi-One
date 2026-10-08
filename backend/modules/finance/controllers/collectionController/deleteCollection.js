import mongoose from "mongoose";
import Collection from "../../models/collectionModel.js";

export const deleteCollection = async (req, res) => {
  try {
    const { collectionId } = req.params;

    if (req.user?.role !== "Super User") {
      return res.status(403).json({ success: false, message: "You do not have permission to delete this collection." });
    }
    if (!mongoose.Types.ObjectId.isValid(collectionId)) {
      return res.status(400).json({ success: false, message: "The collection ID is not valid." });
    }

    const collection = await Collection.findById(collectionId).lean();
    if (!collection) {
      return res.status(404).json({ success: false, message: "We couldn't find this collection." });
    }
    if (collection.status === "Approved") {
      return res.status(400).json({ success: false, message: "Approved collections cannot be deleted." });
    }

    await Collection.findByIdAndDelete(collectionId);

    return res.status(200).json({ success: true, message: "Collection deleted successfully." });
  } catch (error) {
    console.error("Error deleting collection:", error);
    return res.status(500).json({ success: false, message: "Something went wrong while deleting the collection." });
  }
};
