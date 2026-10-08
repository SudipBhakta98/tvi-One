import Receivable from "../../models/receivableModel.js";
import { buildReceivableRows } from "../../utils/receivableRows.js";

const DEFAULT_PERIOD_COUNT = 3;

export const getReceivablesAnalytics = async (req, res) => {
  try {
    // Available periods (year/month) from the invoice dates
    const rawPeriods = await Receivable.aggregate([
      { $match: { invoiceDate: { $ne: null } } },
      { $group: { _id: { year: { $year: "$invoiceDate" }, month: { $month: "$invoiceDate" } } } },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $project: { _id: 0, year: "$_id.year", month: "$_id.month" } },
    ]);

    const periodMap = new Map();
    for (const { year, month } of rawPeriods) {
      if (!periodMap.has(year)) periodMap.set(year, []);
      periodMap.get(year).push(month);
    }
    const availablePeriods = Array.from(periodMap.entries()).map(([year, months]) => ({ year, months }));

    if (rawPeriods.length === 0) {
      return res.status(200).json({ success: true, availablePeriods: [], selectedPeriods: [], data: [] });
    }

    // Selected periods (provided, otherwise the latest few)
    let selectedPeriods = [];
    if (req.query.period) {
      try {
        const parsedPeriod = JSON.parse(req.query.period);
        if (Array.isArray(parsedPeriod) && parsedPeriod.length > 0) {
          selectedPeriods = parsedPeriod.map((p) => ({ year: Number(p.year), month: Number(p.month) }));
        }
      } catch (error) {
        return res.status(400).json({ success: false, message: "The selected period is not valid." });
      }
    }
    if (selectedPeriods.length === 0) selectedPeriods = rawPeriods.slice(0, DEFAULT_PERIOD_COUNT);

    const invoiceRecords = await Receivable.find({
      $or: selectedPeriods.map((period) => ({
        invoiceDate: {
          $gte: new Date(Date.UTC(period.year, period.month - 1, 1, 0, 0, 0, 0)),
          $lte: new Date(Date.UTC(period.year, period.month, 0, 23, 59, 59, 999)),
        },
      })),
    })
      .sort({ invoiceDate: -1 })
      .lean();

    const data = await buildReceivableRows(invoiceRecords);

    return res.status(200).json({ success: true, availablePeriods, selectedPeriods, data });
  } catch (error) {
    console.error("Error executing receivables analytics:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};
