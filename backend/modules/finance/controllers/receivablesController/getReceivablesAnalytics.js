import Receivable from "../../models/receivableModel.js";
import Collection from "../../models/collectionModel.js";

// Customers are expected to pay within this many days of the invoice date.
const PAYMENT_TERM_DAYS = 45;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEFAULT_PERIOD_COUNT = 3;

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

// Date formatter helper (DD-MM-YYYY)
const formatDate = (dateObj) => {
  const d = new Date(dateObj);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${d.getFullYear()}`;
};

export const getReceivablesAnalytics = async (req, res) => {
  try {
    // Get available periods from Receivable collection
    const rawPeriods = await Receivable.aggregate([
      { $match: { invoiceDate: { $ne: null } } },
      {
        $group: {
          _id: {
            year: { $year: "$invoiceDate" },
            month: { $month: "$invoiceDate" },
          },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $project: { _id: 0, year: "$_id.year", month: "$_id.month" } },
    ]);

    // Format raw periods into { year, months } structure
    const periodMap = new Map();
    for (const { year, month } of rawPeriods) {
      if (!periodMap.has(year)) {
        periodMap.set(year, []);
      }
      periodMap.get(year).push(month);
    }

    const availablePeriods = Array.from(periodMap.entries()).map(
      ([year, months]) => ({ year, months })
    );

    if (rawPeriods.length === 0) {
      return res.status(200).json({
        success: true,
        availablePeriods: [],
        selectedPeriods: [],
        data: [],
      });
    }

    // Resolve selected periods (Provided vs Default to latest few)
    let selectedPeriods = [];

    if (req.query.period) {
      try {
        const parsedPeriod = JSON.parse(req.query.period);

        if (Array.isArray(parsedPeriod) && parsedPeriod.length > 0) {
          selectedPeriods = parsedPeriod.map((p) => ({
            year: Number(p.year),
            month: Number(p.month),
          }));
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "The selected period is not valid.",
        });
      }
    }

    // Default: Take latest available periods if none provided
    if (selectedPeriods.length === 0) {
      selectedPeriods = rawPeriods.slice(0, DEFAULT_PERIOD_COUNT);
    }

    // Receivable query via invoiceDate index
    const filterCondition = {
      $or: selectedPeriods.map((period) => ({
        invoiceDate: {
          $gte: new Date(Date.UTC(period.year, period.month - 1, 1, 0, 0, 0, 0)),
          $lte: new Date(Date.UTC(period.year, period.month, 0, 23, 59, 59, 999)),
        },
      })),
    };

    const invoiceRecords = await Receivable.find(filterCondition)
      .sort({ invoiceDate: -1 })
      .lean();

    if (!invoiceRecords || invoiceRecords.length === 0) {
      return res.status(200).json({
        success: true,
        availablePeriods,
        selectedPeriods,
        data: [],
      });
    }

    // Lookup using composite keys ($or array of invoiceNumber + grnNumber)
    const compositeFilters = invoiceRecords.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      grnNumber: inv.grnNumber,
    }));

    const approvedCollections = await Collection.find(
      { $or: compositeFilters, status: "Approved" },
      { invoiceNumber: 1, grnNumber: 1, receivedAmount: 1, tdsAmount: 1, _id: 0 }
    ).lean();

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

    // Calculations & Response Assembly
    const data = invoiceRecords.map((invoice) => {
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

    // Return response
    return res.status(200).json({
      success: true,
      availablePeriods,
      selectedPeriods,
      data,
    });
  } catch (error) {
    console.error("Error executing receivables analytics:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};