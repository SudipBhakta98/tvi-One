import mongoose from "mongoose";
import SupplierAdvance from "../../models/supplierAdvanceModel.js";
import Payment from "../../models/paymentModel.js";
export const updateSupplierAdvanceStatus = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const status = String(req.body.status || "").trim();
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized." });
    if (status !== "Approved" && status !== "Cancelled") return res.status(400).json({ success: false, message: "Invalid advance status." });
    let advance;
    await session.withTransaction(async () => {
      advance = await SupplierAdvance.findById(id).session(session);
      if (!advance) throw new Error("Supplier advance not found.");
      if (advance.status !== "Pending") throw new Error("Only pending advances can be approved or cancelled.");
      advance.status = status;
      advance.updateLogs.push({ updatedBy: userId, remark: `Advance ${status.toLowerCase()}.` });
      await advance.save({ session });
      await Payment.findByIdAndUpdate(advance.paymentId, { status, approvedBy: userId, approvedAt: new Date() }, { session });
    });
    return res.json({ success: true, message: `Supplier advance ${status.toLowerCase()} successfully.`, data: advance });
  } catch (error) { return res.status(400).json({ success: false, message: error.message || "Failed to update supplier advance." }); }
  finally { await session.endSession(); }
};
