import Payable from "../../models/payableModel.js";
import mongoose from "mongoose";

const PERCENT = 100;

export const updatePayable = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const { remark } = updateData;
    const updatedBy = req.user?._id;
    const { invoiceNumber,grnNumber }=updateData

    if (invoiceNumber || grnNumber ) {
      return res.status(400).json({
        success: false,
        message: "Invoice number and GRN number cannot be updated.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payable record.",
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

    const existingPayable = await Payable.findById(id);
    if (!existingPayable) {
      return res.status(404).json({
        success: false,
        message: "Payable record not found.",
      });
    }

    // Merge field calculations
    const subTotal =
      updateData.subTotal !== undefined
        ? Number(updateData.subTotal)
        : existingPayable.subTotal;
    // The form sends the GST rate as a percent (18); it is stored as a fraction (0.18), same as create.
    const gstRate =
      updateData.gstRate !== undefined
        ? Number(updateData.gstRate) / PERCENT
        : existingPayable.gstRate;
    const totalAmount =
      updateData.totalAmount !== undefined
        ? Number(updateData.totalAmount)
        : existingPayable.totalAmount;
    const tdsRate =
      updateData.tdsRate !== undefined
        ? Number(updateData.tdsRate)
        : existingPayable.tdsRate;

    if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 1) {
      return res.status(400).json({
        success: false,
        message: "GST Rate must be between 0% and 100%.",
      });
    }

    // Other amount: keep the stored value unless the request sends one (blank = 0)
    const otherAmount = Number(updateData.otherAmount ?? existingPayable.otherAmount) || 0;
    const otherAmountDescription = String(
      updateData.otherAmountDescription ?? existingPayable.otherAmountDescription ?? "",
    ).trim();

    if (otherAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Other amount cannot be negative.",
      });
    }

    // Math Validation
    const expectedGstAmount =
      Math.round(subTotal * gstRate * 100) / 100;
    const expectedTotalAmount =
      Math.round((subTotal + expectedGstAmount + otherAmount) * 100) / 100;

    if (Math.abs(totalAmount - expectedTotalAmount) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Math Mismatch Error: SubTotal (${subTotal}) + GST (${expectedGstAmount}) + Other Amount (${otherAmount}) = ${expectedTotalAmount}, but Total Amount provided is ${totalAmount}.`,
      });
    }

    const calculatedTdsAmount =
      Math.round(subTotal * (tdsRate / 100) * 100) / 100;
    const calculatedPayableAmount = Math.max(
      0,
      Math.round((expectedTotalAmount - calculatedTdsAmount) * 100) / 100,
    );

    // Apply updates

    existingPayable.supplierName = updateData.supplierName
      ? updateData.supplierName.trim()
      : existingPayable.supplierName;
    existingPayable.invoiceDate = updateData.invoiceDate
      ? new Date(updateData.invoiceDate)
      : existingPayable.invoiceDate;
    existingPayable.subTotal = subTotal;
    existingPayable.gstRate = gstRate;
    existingPayable.gstAmount = expectedGstAmount;
    existingPayable.otherAmount = otherAmount;
    existingPayable.otherAmountDescription = otherAmountDescription;
    existingPayable.totalAmount = expectedTotalAmount;
    existingPayable.tdsRate = tdsRate;
    existingPayable.tdsAmount = calculatedTdsAmount;
    existingPayable.payableAmount = calculatedPayableAmount;
    existingPayable.updateLogs.push({
      updatedBy: updatedBy,
      updatedAt: new Date(),
      remark: String(remark).trim(),
    });

    await existingPayable.save();

    return res.status(200).json({
      success: true,
      message: "Payable record updated successfully.",
      // data: existingPayable,
    });
  } catch (error) {
    console.error("Error updating Payable record:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};