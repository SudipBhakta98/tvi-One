import Receivable from "../../models/receivableModel.js";
import mongoose from "mongoose";
import { getReceivableFinancials, round2 } from "../../utils/receivableFinancials.js";

const TOTAL_TOLERANCE = 0.01;
const PERCENT = 100;

export const updateReceivable = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const { remark } = updateData;
    const updatedBy = req.user?._id;
    const { invoiceNumber, grnNumber } = updateData;

    if (invoiceNumber || grnNumber) {
      return res.status(400).json({
        success: false,
        message: "Invoice number and GRN number cannot be updated.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid receivable record.",
      });
    }

    if (!updatedBy) {
      return res.status(401).json({
        success: false,
        message: "Your login session is invalid. Please log in again.",
      });
    }

    if (!remark || String(remark).trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Please provide a reason for updating this invoice.",
      });
    }

    const existingReceivable = await Receivable.findById(id);
    if (!existingReceivable) {
      return res.status(404).json({
        success: false,
        message: "Receivable record not found.",
      });
    }

    // Merge field calculations
    // The form sends the GST rate as a percent (18); it is stored as a fraction (0.18), same as create.
    const subTotal =
      updateData.subTotal !== undefined
        ? Number(updateData.subTotal)
        : existingReceivable.subTotal;
    const gstRate =
      updateData.gstRate !== undefined
        ? Number(updateData.gstRate) / PERCENT
        : existingReceivable.gstRate;
    const totalAmount =
      updateData.totalAmount !== undefined
        ? Number(updateData.totalAmount)
        : existingReceivable.totalAmount;

    if (!Number.isFinite(subTotal) || subTotal < 0) {
      return res.status(400).json({
        success: false,
        message: "Sub Total must be a valid amount.",
      });
    }

    if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 1) {
      return res.status(400).json({
        success: false,
        message: "GST Rate must be between 0% and 100%.",
      });
    }

    // Other amount: keep the stored value unless the request sends one (blank = 0)
    const otherAmount =
      Number(updateData.otherAmount ?? existingReceivable.otherAmount) || 0;
    const otherAmountDescription = String(
      updateData.otherAmountDescription ?? existingReceivable.otherAmountDescription ?? "",
    ).trim();

    if (otherAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Other amount cannot be negative.",
      });
    }

    // Math Validation
    const expectedGstAmount = round2(subTotal * gstRate);
    const expectedTotalAmount = round2(subTotal + expectedGstAmount + otherAmount);

    if (Math.abs(totalAmount - expectedTotalAmount) > TOTAL_TOLERANCE) {
      return res.status(400).json({
        success: false,
        message: `Math Mismatch Error: SubTotal (${subTotal}) + GST (${expectedGstAmount}) + Other Amount (${otherAmount}) = ${expectedTotalAmount}, but Total Amount provided is ${totalAmount}.`,
      });
    }

    // The invoice can't be cut below what is already collected or waiting for approval.
    const { totalApproved, totalPending } = await getReceivableFinancials({
      invoiceNumber: existingReceivable.invoiceNumber,
      grnNumber: existingReceivable.grnNumber,
    });
    const alreadySettled = round2(totalApproved + totalPending);

    if (expectedTotalAmount < alreadySettled) {
      return res.status(400).json({
        success: false,
        message: `Total Amount (₹${expectedTotalAmount}) cannot be less than the collections already recorded (₹${alreadySettled}).`,
      });
    }

    // Apply updates
    existingReceivable.customerName = updateData.customerName
      ? String(updateData.customerName).trim()
      : existingReceivable.customerName;
    existingReceivable.invoiceDate = updateData.invoiceDate
      ? new Date(updateData.invoiceDate)
      : existingReceivable.invoiceDate;
    existingReceivable.subTotal = subTotal;
    existingReceivable.gstRate = gstRate;
    existingReceivable.gstAmount = expectedGstAmount;
    existingReceivable.otherAmount = otherAmount;
    existingReceivable.otherAmountDescription = otherAmountDescription;
    existingReceivable.totalAmount = expectedTotalAmount;
    existingReceivable.updateLogs.push({
      updatedBy: updatedBy,
      updatedAt: new Date(),
      remark: String(remark).trim(),
    });

    await existingReceivable.save();

    return res.status(200).json({
      success: true,
      message: "Receivable record updated successfully.",
    });
  } catch (error) {
    console.error("Error updating Receivable record:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};