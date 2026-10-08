import Payment from "../../models/paymentModel.js";
import Debit from "../../models/debitModel.js";

export const getPayableDetails = async (req, res) => {
  try {
    const { invoiceNumber, grnNumber } = req.query;

    const inv = String(invoiceNumber || "").trim();
    const grn = String(grnNumber || "").trim();

    if (!inv || !grn) {
      return res.status(400).json({
        success: false,
        message: "Please provide both invoice number and GRN number.",
      });
    }

    // Fetch all related Payments and Debits
    const [payments, debits] = await Promise.all([
      Payment.find({ invoiceNumber: inv, grnNumber: grn })
        .populate("paymentBy", "name email")
        .populate("approvedBy", "name email")
        .sort({ paymentDate: -1 })
        .lean(),
      Debit.find({ invoiceNumber: inv, grnNumber: grn })
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        payments,
        debits,
      },
    });
  } catch (error) {
    console.error("Error in getPayableDetails:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while fetching payable details.",
    });
  }
};