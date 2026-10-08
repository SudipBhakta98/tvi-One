import Payment from "../../models/paymentModel.js";

export const getPayments = async (req, res) => {
  try {
    // 1. Get all available year/month periods
    const rawPeriods = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $ne: null },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$paymentDate" },
            month: { $month: "$paymentDate" },
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

    // 2. Format available periods
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

    // 3. No payments available
    if (rawPeriods.length === 0) {
      return res.status(200).json({
        success: true,
        availablePeriods: [],
        selectedPeriods: [],
        data: [],
      });
    }

    // 4. Get selected periods from query
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

    // 5. Default: latest 3 available periods
    if (selectedPeriods.length === 0) {
      selectedPeriods = rawPeriods.slice(0, 3);
    }

    // 6. Create date filter
    const filterCondition = {
      $or: selectedPeriods.map((period) => ({
        paymentDate: {
          $gte: new Date(
            Date.UTC(period.year, period.month - 1, 1, 0, 0, 0, 0)
          ),
          $lte: new Date(
            Date.UTC(period.year, period.month, 0, 23, 59, 59, 999)
          ),
        },
      })),
    };

    // 7. Fetch payments with populates matching paymentSchema
    const payments = await Payment.find(filterCondition)
      .populate("paymentBy", "name")
      .populate("approvedBy", "name")
      .populate("updateLogs.updatedBy", "name")
      .sort({ paymentDate: -1 })
      .lean();

    // 8. Date Formatter (DD-MM-YYYY)
    const formatDate = (dateObj) => {
      if (!dateObj) return null;

      const d = new Date(dateObj);
      const day = String(d.getUTCDate()).padStart(2, "0");
      const month = String(d.getUTCMonth() + 1).padStart(2, "0");
      const year = d.getUTCFullYear();

      return `${day}-${month}-${year}`;
    };

    // 9. Format response array mapped to active schema fields
    const data = payments.map((payment) => ({
      _id: payment._id,
      paymentType: payment.paymentType || "INVOICE",
      advanceAmount: payment.advanceAmount || 0,
      advanceAllocations: payment.advanceAllocations || [],
      invoiceNumber: payment.invoiceNumber,
      supplierName: payment.supplierName,
      grnNumber: payment.grnNumber,
      paidAmount: payment.paidAmount,
      paymentDate: formatDate(payment.paymentDate),
      paymentMethod: payment.paymentMethod,
      transactionNumber: payment.transactionNumber || null,
      creditNoteNumber: payment.creditNoteNumber || null,
      paymentBy: payment.paymentBy || null,
      status: payment.status,
      approvedBy: payment.approvedBy || null,
      approvedAt: formatDate(payment.approvedAt),
      updateLogs: payment.updateLogs || [],
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    }));

    // 10. Final Response
    return res.status(200).json({
      success: true,
      availablePeriods,
      selectedPeriods,
      data,
    });
  } catch (error) {
    console.error("Error fetching payments:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while loading the payments.",
    });
  }
};