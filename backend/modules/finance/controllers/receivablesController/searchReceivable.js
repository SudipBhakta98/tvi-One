import Receivable from "../../models/receivableModel.js";
import Collection from "../../models/collectionModel.js";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 10;

// Customers are expected to pay within this many days of the invoice date.
const PAYMENT_TERM_DAYS = 45;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

// Date formatter helper (DD-MM-YYYY)
const formatDate = (dateObj) => {
  const d = new Date(dateObj);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${d.getFullYear()}`;
};

export const getSearchReceivable = async (req, res) => {
  try {
    const { search = "", page = 1, limit = DEFAULT_PAGE_SIZE } = req.query;

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

    const query = {
      $or: [
        { invoiceNumber: searchRegex },
        { grnNumber: searchRegex },
        { customerName: searchRegex },
      ],
    };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));
    const skip = (pageNum - 1) * limitNum;

    // Run query and total count concurrently for accurate pagination
    const [invoiceRecords, totalItems] = await Promise.all([
      Receivable.find(query)
        .sort({ invoiceDate: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Receivable.countDocuments(query),
    ]);

    // Same collection lookup as the analytics register, so both show the same numbers
    let approvedCollections = [];
    if (invoiceRecords.length > 0) {
      const compositeFilters = invoiceRecords.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        grnNumber: inv.grnNumber,
      }));

      approvedCollections = await Collection.find(
        { $or: compositeFilters, status: "Approved" },
        { invoiceNumber: 1, grnNumber: 1, receivedAmount: 1, tdsAmount: 1, _id: 0 }
      ).lean();
    }

    // Map collections using composite key: "invoiceNumber_grnNumber"
    const collectionMap = new Map();
    for (const collection of approvedCollections) {
      const key = `${collection.invoiceNumber}_${collection.grnNumber}`;
      const current = collectionMap.get(key) || { received: 0, tds: 0 };
      collectionMap.set(key, {
        received: current.received + (collection.receivedAmount || 0),
        tds: current.tds + (collection.tdsAmount || 0),
      });
    }

    const nowTime = Date.now();

    const searchReceivables = invoiceRecords.map((invoice) => {
      const compositeKey = `${invoice.invoiceNumber}_${invoice.grnNumber}`;
      const { received = 0, tds = 0 } = collectionMap.get(compositeKey) || {};

      const collectedAmount = round2(received);
      const tdsAmount = round2(tds);
      const settledAmount = round2(collectedAmount + tdsAmount);
      const outstanding = Math.max(0, round2(invoice.totalAmount - settledAmount));

      // Collection Status Logic
      let status = "uncollected";
      if (settledAmount >= invoice.totalAmount && invoice.totalAmount > 0) {
        status = "collected";
      } else if (settledAmount > 0) {
        status = "partial";
      }

      // Days left to collect (negative = overdue)
      const elapsedDays = Math.floor(
        (nowTime - new Date(invoice.invoiceDate).getTime()) / MS_PER_DAY
      );
      const dueDays = PAYMENT_TERM_DAYS - elapsedDays;
      const isOverdue = dueDays < 0 && outstanding > 0;

      return {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        grnNumber: invoice.grnNumber,
        customerName: invoice.customerName,
        invoiceDate: formatDate(invoice.invoiceDate),
        subTotal: invoice.subTotal,
        gstRate: invoice.gstRate,
        gstAmount: invoice.gstAmount,
        otherAmount: invoice.otherAmount ?? 0,
        otherAmountDescription: invoice.otherAmountDescription ?? "",
        totalAmount: invoice.totalAmount,
        collectedAmount,
        tdsAmount,
        settledAmount,
        outstanding,
        status,
        dueDays,
        isOverdue,
      };
    });

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

    return res.status(500).json({
      success: false,
      message: "Server error while fetching receivables.",
      error: error.message,
    });
  }
};