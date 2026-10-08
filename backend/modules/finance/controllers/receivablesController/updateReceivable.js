import mongoose from "mongoose";
import Receivable from "../../models/receivableModel.js";
import { getReceivableFinancials, round2 } from "../../utils/receivableFinancials.js";

const TOTAL_TOLERANCE = 0.01;

export const updateReceivable = async (req, res) => {
  try {
    const { id } = req.params;
    const { invoiceNumber, grnNumber, remark } = req.body;
    const updatedBy = req.user?._id;

    if (invoiceNumber || grnNumber) {
      return res.status(400).json({ success: false, message: "Invoice number and GRN number cannot be updated." });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid receivable record." });
    }
    if (!updatedBy) {
      return res.status(401).json({ success: false, message: "Your login session is invalid. Please log in again." });
    }
    if (!remark || String(remark).trim() === "") {
      return res.status(400).json({ success: false, message: "Please provide a reason for updating this invoice." });
    }

    const receivable = await Receivable.findById(id);
    if (!receivable) {
      return res.status(404).json({ success: false, message: "Receivable record not found." });
    }

    const pick = (key) => (req.body[key] !== undefined ? Number(req.body[key]) : receivable[key]);
    const subTotal = pick("subTotal");
    const gstAmount = pick("gstAmount");
    const expectedTotal = round2(subTotal + gstAmount);

    if (![subTotal, gstAmount].every((n) => Number.isFinite(n) && n >= 0)) {
      return res.status(400).json({ success: false, message: "Sub Total and GST must be valid amounts." });
    }

    if (req.body.totalAmount !== undefined && Math.abs(Number(req.body.totalAmount) - expectedTotal) > TOTAL_TOLERANCE) {
      return res.status(400).json({
        success: false,
        message: `Math Mismatch Error: SubTotal (${subTotal}) + GST (${gstAmount}) = ${expectedTotal}, but Total Amount provided is ${req.body.totalAmount}.`,
      });
    }

    // The invoice can't be cut below what is already collected or waiting for approval.
    const { totalApproved, totalPending } = await getReceivableFinancials({
      invoiceNumber: receivable.invoiceNumber,
      grnNumber: receivable.grnNumber,
    });
    const alreadySettled = round2(totalApproved + totalPending);
    if (expectedTotal < alreadySettled) {
      return res.status(400).json({
        success: false,
        message: `Total Amount (₹${expectedTotal}) cannot be less than the collections already recorded (₹${alreadySettled}).`,
      });
    }

    if (req.body.customerName) receivable.customerName = String(req.body.customerName).trim();
    if (req.body.invoiceDate) receivable.invoiceDate = new Date(req.body.invoiceDate);
    receivable.subTotal = subTotal;
    receivable.gstAmount = gstAmount;
    receivable.totalAmount = expectedTotal;
    receivable.updateLogs.push({ updatedBy, updatedAt: new Date(), remark: String(remark).trim() });

    await receivable.save();

    return res.status(200).json({ success: true, message: "Receivable record updated successfully." });
  } catch (error) {
    console.error("Error updating Receivable record:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};
