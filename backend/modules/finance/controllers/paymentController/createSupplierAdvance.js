import mongoose from "mongoose";
import Payment from "../../models/paymentModel.js";
import SupplierAdvance from "../../models/supplierAdvanceModel.js";

export const createSupplierAdvance = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: "Your login session is invalid. Please log in again." });
    const { supplierName, paidAmount, paymentDate, paymentMethod, transactionNumber, remark } = req.body;
    const supplier = String(supplierName || "").trim();
    const amount = Number(paidAmount);
    const method = String(paymentMethod || "").toUpperCase().trim();
    const date = new Date(paymentDate);
    if (!supplier) return res.status(400).json({ success: false, message: "Supplier name is required." });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: "Advance amount must be greater than 0." });
    if (Number.isNaN(date.getTime())) return res.status(400).json({ success: false, message: "Please provide a valid payment date." });
    if (!["CASH", "BANK", "CHEQUE", "ONLINE", "UPI"].includes(method)) return res.status(400).json({ success: false, message: "Invalid payment method." });
    if (method !== "CASH" && !String(transactionNumber || "").trim()) return res.status(400).json({ success: false, message: "Transaction number is required for this payment method." });

    let result;
    await session.withTransaction(async () => {
      const payment = new Payment({
        paymentType: "ADVANCE",
        invoiceNumber: null,
        grnNumber: null,
        supplierName: supplier,
        paidAmount: amount,
        paymentDate: date,
        paymentMethod: method,
        transactionNumber: method === "CASH" ? null : String(transactionNumber).trim(),
        paymentBy: userId,
        status: "Pending",
        updateLogs: remark ? [{ updatedBy: userId, remark }] : [],
      });
      await payment.save({ session });
      const advanceNumber = `ADV-${new Date().getFullYear()}-${String(payment._id).slice(-8).toUpperCase()}`;
      const [advance] = await SupplierAdvance.create([{
        advanceNumber,
        paymentId: payment._id,
        supplierName: supplier,
        advanceAmount: amount,
        totalAdjustedAmount: 0,
        pendingAdjustmentAmount: amount,
        status: "Pending",
        createdBy: userId,
        updateLogs: remark ? [{ updatedBy: userId, remark }] : [],
      }], { session });
      result = advance;
    });
    return res.status(201).json({ success: true, message: "Supplier advance created successfully.", data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to create supplier advance." });
  } finally { await session.endSession(); }
};
