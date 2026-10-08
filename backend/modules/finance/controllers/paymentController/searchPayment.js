import Payment from "../../models/paymentModel.js";
export const getSearchPayment = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 1 } = req.query;
    const trimmedSearch = String(search).trim();

    if (trimmedSearch === "") {
      return res.status(400).json({
        success: false,
        message: "Search keyword is required.",
      });
    }

    const escapedSearch = trimmedSearch.replace(
      /[-[\]{}()*+?.,\\^$|#\s]/g,
      "\\$&",
    );
    const searchRegex = new RegExp(escapedSearch, "i");

    // Construct query targeting indexed text fields
    const query = {
      $or: [
        { invoiceNumber: searchRegex },
        { grnNumber: searchRegex },
        { supplierName: searchRegex },
        { transactionNumber: searchRegex },
        { creditNoteNumber: searchRegex },
      ],
    };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const searchPayments = await Payment.find(query)
      .populate("paymentBy", "name")
      .populate("approvedBy", "name")
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    return res.status(200).json({
      success: true,
      searchPayments,
      pegination: {
        currentPage: pageNum,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Error in getSearchPayment controller:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while searching payments.",
      error: error.message,
    });
  }
};
