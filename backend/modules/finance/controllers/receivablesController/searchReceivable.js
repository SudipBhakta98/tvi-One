import Receivable from "../../models/receivableModel.js";
import { buildReceivableRows } from "../../utils/receivableRows.js";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 10;

export const getSearchReceivable = async (req, res) => {
  try {
    const { search = "", page = 1, limit = DEFAULT_PAGE_SIZE } = req.query;
    const trimmedSearch = String(search).trim();

    if (!trimmedSearch) {
      return res.status(400).json({ success: false, message: "Search character is required." });
    }

    const searchRegex = new RegExp(trimmedSearch.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"), "i");
    const query = {
      $or: [{ invoiceNumber: searchRegex }, { grnNumber: searchRegex }, { customerName: searchRegex }],
    };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));

    const [records, totalItems] = await Promise.all([
      Receivable.find(query)
        .sort({ invoiceDate: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Receivable.countDocuments(query),
    ]);
    const searchReceivables = await buildReceivableRows(records);

    return res.status(200).json({
      success: true,
      searchReceivables,
      pagination: {
        currentPage: pageNum,
        limit: limitNum,
        totalItems,
        totalPages: Math.ceil(totalItems / limitNum),
      },
    });
  } catch (error) {
    console.error("Error in getSearchReceivable:", error);
    return res.status(500).json({ success: false, message: "Server error while fetching receivables.", error: error.message });
  }
};
