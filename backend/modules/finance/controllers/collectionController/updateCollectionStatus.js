import mongoose from "mongoose";
import Collection from "../../models/collectionModel.js";
import { ROLES } from "../../../../constants/roles.js";

/** Approve or reject a Pending collection. Super User only; checks the original application role. */
export const updateCollectionStatus = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { status } = req.body;

    const actualRole = req.user?.originalRole || req.user?.role;
    if (actualRole !== ROLES.SUPER_USER && actualRole !== "Super User") {
      return res.status(403).json({ success: false, message: "You do not have permission to approve or reject this collection." });
    }
    if (!mongoose.Types.ObjectId.isValid(collectionId)) {
      return res.status(400).json({ success: false, message: "The collection ID is not valid." });
    }
    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Please choose either Approve or Reject." });
    }

    // Only a Pending collection can move; the filter makes a double click harmless.
    const collection = await Collection.findOneAndUpdate(
      { _id: collectionId, status: "Pending" },
      { status, approvedBy: req.user._id, approvedAt: new Date() },
      { new: true },
    );

    if (!collection) {
      const existing = await Collection.findById(collectionId).lean();
      return existing
        ? res.status(400).json({ success: false, message: `This collection has already been ${existing.status.toLowerCase()}.` })
        : res.status(404).json({ success: false, message: "We couldn't find this collection." });
    }

    return res.status(200).json({
      success: true,
      message: status === "Approved" ? "Collection has been approved successfully." : "Collection has been rejected successfully.",
    });
  } catch (error) {
    console.error("Error updating collection status:", error);
    return res.status(500).json({ success: false, message: "Something went wrong while updating the collection status." });
  }
};
