import Payable from "../../models/payableModel.js";
import Payment from "../../models/paymentModel.js";
import Debit from "../../models/debitModel.js";

// Suppliers are paid within this many days of the invoice date.
const PAYMENT_TERM_DAYS = 45;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const getPayablesAnalytics = async (req, res) => {
  try {
    // Get available periods from Payable collection
    const rawPeriods = await Payable.aggregate([
      { $match: { invoiceDate: { $ne: null } } },
      {
        $group: {
          _id: {
            year: { $year: "$invoiceDate" },
            month: { $month: "$invoiceDate" },
          },
        },
      },
      {
        $sort: {
          "_id.year": -1,
          "_id.month": -1,
        },
      },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
        },
      },
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
      ([year, months]) => ({
        year,
        months,
      })
    );

    if (rawPeriods.length === 0) {
      return res.status(200).json({
        success: true,
        availablePeriods: [],
        selectedPeriods: [],
        data: [],
      });
    }

    // Resolve selected periods (Provided vs Default to latest 3)
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

    // Default: Take latest 3 available periods if none provided
    if (selectedPeriods.length === 0) {
      selectedPeriods = rawPeriods.slice(0, 3);
    }

    //  Payable query via invoiceDate index
    const filterCondition = {
      $or: selectedPeriods.map((period) => ({
        invoiceDate: {
          $gte: new Date(Date.UTC(period.year, period.month - 1, 1, 0, 0, 0, 0)),
          $lte: new Date(Date.UTC(period.year, period.month, 0, 23, 59, 59, 999)),
        },
      })),
    };

    const invoiceRecords = await Payable.find(filterCondition)
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

    //  Parallel lookups using composite keys ($or array of invoiceNumber + grnNumber)
    const compositeFilters = invoiceRecords.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      grnNumber: inv.grnNumber,
    }));

    const [approvedPayments, debitNotes] = await Promise.all([
      Payment.find(
        { $or: compositeFilters, status: "Approved" },
        { invoiceNumber: 1, grnNumber: 1, paidAmount: 1, _id: 0 }
      ).lean(),
      Debit.find(
        { $or: compositeFilters },
        { invoiceNumber: 1, grnNumber: 1, debitAmount: 1, _id: 0 }
      ).lean(),
    ]);

    // Map payments using composite key: "invoiceNumber_grnNumber"
    const paymentMap = new Map();
    for (const payment of approvedPayments) {
      const key = `${payment.invoiceNumber}_${payment.grnNumber}`;
      const current = paymentMap.get(key) || 0;
      paymentMap.set(key, current + (payment.paidAmount || 0));
    }

    // Map debit notes using composite key: "invoiceNumber_grnNumber"
    const debitMap = new Map();
    for (const debit of debitNotes) {
      const key = `${debit.invoiceNumber}_${debit.grnNumber}`;
      const current = debitMap.get(key) || 0;
      debitMap.set(key, current + (debit.debitAmount || 0));
    }

    // Date formatter helper (DD-MM-YYYY)
    const formatDate = (dateObj) => {
      const d = new Date(dateObj);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    };

    const nowTime = Date.now();

    //  Calculations & Response Assembly
    const data = invoiceRecords.map((invoice) => {
      const compositeKey = `${invoice.invoiceNumber}_${invoice.grnNumber}`;

      const paidAmount =
        Math.round((paymentMap.get(compositeKey) || 0) * 100) / 100;
      const debitAmount =
        Math.round((debitMap.get(compositeKey) || 0) * 100) / 100;

      const grossPayable = invoice.payableAmount || 0;
      const actualPayableAmount = Math.max(
        0,
        Math.round((grossPayable - debitAmount) * 100) / 100
      );
      const outstanding = Math.max(
        0,
        Math.round((actualPayableAmount - paidAmount) * 100) / 100
      );

      // Payment Status Logic
      let status = "unpaid";
      if (paidAmount >= actualPayableAmount && actualPayableAmount > 0) {
        status = "paid";
      } else if (paidAmount > 0) {
        status = "partial";
      }

      // Days left to pay (negative = overdue)
      const invoiceTime = new Date(invoice.invoiceDate).getTime();
      const elapsedDays = Math.floor((nowTime - invoiceTime) / MS_PER_DAY);
      const dueDays = PAYMENT_TERM_DAYS - elapsedDays;
      const isOverdue = dueDays < 0 && outstanding > 0;

      return {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        grnNumber: invoice.grnNumber,
        supplierName: invoice.supplierName,
        invoiceDate: formatDate(invoice.invoiceDate),
        subTotal: invoice.subTotal,
        gstRate: invoice.gstRate,
        gstAmount: invoice.gstAmount,
        tdsRate: invoice.tdsRate,
        tdsAmount: invoice.tdsAmount,
        totalAmount: invoice.totalAmount,
        grossPayableAmount: grossPayable,
        debitAmount,
        actualPayableAmount,
        paidAmount,
        outstanding,
        status,
        dueDays,
        isOverdue,
      };
    });

    // 6. Return response
    return res.status(200).json({
      success: true,
      availablePeriods,
      selectedPeriods,
      data,
    });
  } catch (error) {
    console.error("Error executing payables analytics:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};