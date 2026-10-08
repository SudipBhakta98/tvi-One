import Payment from "../../models/paymentModel.js";

export const getPendingPayments = async (req, res) => {
  try {
    const payments = await Payment.find({
      status: "Pending",
    })
      .populate("paymentBy", "name")
      .populate("approvedBy", "name")
      .populate("updateLogs.updatedBy", "name")
      .sort({ paymentDate: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Pending payments fetched successfully.",
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    console.error("Error fetching pending payments:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while loading pending payments.",
    });
  }
};