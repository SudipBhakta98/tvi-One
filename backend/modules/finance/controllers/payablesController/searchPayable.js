import Payable from "../../models/payableModel.js";

export const getSearchPayable = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;

    const trimmedSearch = String(search).trim();

    if (!trimmedSearch) {
      return res.status(400).json({
        success: false,
        message: "Search character is required.",
      });
    }

    // Escape special regular expression characters safely
    const escapedSearch = trimmedSearch.replace(
      /[-[\]{}()*+?.,\\^$|#\s]/g,
      "\\$&"
    );

    const searchRegex = new RegExp(escapedSearch, "i");

    // Clean $or query leveraging your string schema definition
    const query = {
      $or: [
        { invoiceNumber: searchRegex },
        { grnNumber: searchRegex },
        { supplierName: searchRegex },
      ],
    };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Run query and total count concurrently for accurate pagination
    const searchPayables = await
      Payable.find(query)
        .sort({ invoiceDate: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
     
  

    return res.status(200).json({
      success: true,
      searchPayables,
      pagination: {
        currentPage: pageNum,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Error in getPayables search controller:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching payables.",
      error: error.message,
    });
  }
};