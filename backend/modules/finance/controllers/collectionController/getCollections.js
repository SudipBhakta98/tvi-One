import Collection from "../../models/collectionModel.js";

const STATUSES = ["Pending", "Approved", "Rejected"];

/**
 * GET /getCollections?status=Pending|Approved|Rejected   (default: Pending)
 * Feeds the Approve Receivable page.
 */
export const getCollections = async (req, res) => {
  try {
    const status = STATUSES.includes(req.query.status) ? req.query.status : "Pending";

    const collections = await Collection.find({ status })
      .populate("collectionBy", "name")
      .populate("approvedBy", "name")
      .populate("updateLogs.updatedBy", "name")
      .sort({ collectionDate: -1 })
      .lean();

    return res.status(200).json({ success: true, status, count: collections.length, data: collections });
  } catch (error) {
    console.error("Error fetching collections:", error);
    return res.status(500).json({ success: false, message: "Something went wrong while loading the collections." });
  }
};
