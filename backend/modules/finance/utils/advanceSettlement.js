import SupplierAdvance from "../models/supplierAdvanceModel.js";

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Case-insensitive exact match on supplier name. */
export const supplierNameFilter = (name) => ({
  $regex: new RegExp(`^${escapeRegex(String(name).trim())}$`, "i"),
});

/** Advance status after its balance changed. */
const getAdvanceStatus = (adv) => {
  if (adv.status === "Pending" || adv.status === "Cancelled") return adv.status;
  if (round2(adv.pendingAdjustmentAmount) <= 0) return "Fully Adjusted";
  if (round2(adv.totalAdjustedAmount) > 0) return "Partially Adjusted";
  return "Approved";
};

const availableOf = (adv) =>
  Math.max(0, round2(adv.pendingAdjustmentAmount - (adv.totalAllocationRequestAmount || 0)));

/**
 * Validate + normalise the advance part of a payment request.
 * Input:  [{ advanceId, amount }]
 * Output: merged list with numeric amounts (>0). Throws on bad input.
 */
export const normalizeAdvanceInput = (raw) => {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error("ADVANCE_INPUT_INVALID");
  const merged = new Map();
  for (const row of raw) {
    const id = String(row?.advanceId || "").trim();
    const amount = round2(row?.amount);
    if (!id || !Number.isFinite(amount)) throw new Error("ADVANCE_INPUT_INVALID");
    if (amount <= 0) continue; // user left the row empty
    merged.set(id, round2((merged.get(id) || 0) + amount));
  }
  return [...merged.entries()].map(([advanceId, amount]) => ({ advanceId, amount }));
};

/**
 * Reserve advance balance for a PENDING payment (same pattern as credit
 * allocationRequest). Nothing is consumed until the payment is approved.
 * Returns the allocations to store on the payment.
 */
export const reserveAdvances = async ({ items, payment, supplierName, userId, session }) => {
  const stored = [];
  for (const { advanceId, amount } of items) {
    const adv = await SupplierAdvance.findById(advanceId).session(session);
    if (!adv) throw new Error("ADVANCE_NOT_FOUND");

    if (String(adv.supplierName).trim().toLowerCase() !== String(supplierName).trim().toLowerCase()) {
      throw new Error("ADVANCE_SUPPLIER_MISMATCH");
    }
    if (!["Approved", "Partially Adjusted"].includes(adv.status)) {
      const e = new Error("ADVANCE_NOT_USABLE");
      e.advanceNumber = adv.advanceNumber;
      throw e;
    }
    if (amount > availableOf(adv) + 0.001) {
      const e = new Error("ADVANCE_INSUFFICIENT_BALANCE");
      e.advanceNumber = adv.advanceNumber;
      e.available = availableOf(adv);
      throw e;
    }

    adv.allocationRequest.push({
      paymentId: payment._id,
      invoiceNumber: payment.invoiceNumber,
      requestAmount: amount,
      requestedAt: new Date(),
    });
    adv.totalAllocationRequestAmount = round2((adv.totalAllocationRequestAmount || 0) + amount);
    adv.updateLogs.push({
      updatedBy: userId,
      remark: `₹${amount} reserved for payment on invoice ${payment.invoiceNumber} (awaiting approval).`,
    });
    await adv.save({ session });
    stored.push({ advanceId: adv._id, advanceNumber: adv.advanceNumber, amount });
  }
  return stored;
};

/** Remove every reservation a pending payment holds (edit / delete / reject). */
export const releaseAdvances = async ({ payment, userId, session, reason }) => {
  for (const alloc of payment.advanceAllocations || []) {
    const adv = await SupplierAdvance.findById(alloc.advanceId).session(session);
    if (!adv) continue;
    const idx = adv.allocationRequest.findIndex((r) => String(r.paymentId) === String(payment._id));
    if (idx === -1) continue;
    const [req] = adv.allocationRequest.splice(idx, 1);
    adv.totalAllocationRequestAmount = Math.max(0, round2((adv.totalAllocationRequestAmount || 0) - req.requestAmount));
    adv.updateLogs.push({ updatedBy: userId, remark: `₹${req.requestAmount} reservation released: ${reason}` });
    await adv.save({ session });
  }
};

/** Payment approved: turn reservations into real adjustments. */
export const settleAdvances = async ({ payment, userId, session }) => {
  for (const alloc of payment.advanceAllocations || []) {
    const adv = await SupplierAdvance.findById(alloc.advanceId).session(session);
    if (!adv) throw new Error("ADVANCE_NOT_FOUND");
    const idx = adv.allocationRequest.findIndex((r) => String(r.paymentId) === String(payment._id));
    if (idx === -1) throw new Error("ADVANCE_REQUEST_NOT_FOUND");
    const [req] = adv.allocationRequest.splice(idx, 1);

    adv.totalAllocationRequestAmount = Math.max(0, round2((adv.totalAllocationRequestAmount || 0) - req.requestAmount));
    adv.pendingAdjustmentAmount = round2(adv.pendingAdjustmentAmount - req.requestAmount);
    adv.totalAdjustedAmount = round2((adv.totalAdjustedAmount || 0) + req.requestAmount);
    if (adv.pendingAdjustmentAmount < 0) throw new Error("ADVANCE_INSUFFICIENT_BALANCE");

    adv.adjustments.push({
      paymentId: payment._id,
      invoiceNumber: payment.invoiceNumber,
      adjustedAmount: req.requestAmount,
      adjustedAt: new Date(),
      adjustedBy: userId,
      remark: `Adjusted against invoice ${payment.invoiceNumber}`,
    });
    adv.status = getAdvanceStatus(adv);
    adv.updateLogs.push({ updatedBy: userId, remark: `₹${req.requestAmount} adjusted against invoice ${payment.invoiceNumber}.` });
    await adv.save({ session });
  }
};

/** Give back approved adjustments (used when an invoice with approved advance-funded payments is deleted). */
export const restoreAdjustedAdvances = async ({ payment, userId, session, reason }) => {
  for (const alloc of payment.advanceAllocations || []) {
    const adv = await SupplierAdvance.findById(alloc.advanceId).session(session);
    if (!adv) continue;
    const idx = adv.adjustments.findIndex((a) => String(a.paymentId) === String(payment._id));
    if (idx === -1) continue;
    const [adj] = adv.adjustments.splice(idx, 1);
    adv.pendingAdjustmentAmount = round2(adv.pendingAdjustmentAmount + adj.adjustedAmount);
    adv.totalAdjustedAmount = Math.max(0, round2(adv.totalAdjustedAmount - adj.adjustedAmount));
    adv.status = getAdvanceStatus(adv);
    adv.updateLogs.push({ updatedBy: userId, remark: `₹${adj.adjustedAmount} restored: ${reason}` });
    await adv.save({ session });
  }
};

/** Approved / partially adjusted advances of a supplier that still have free balance. */
export const findUsableAdvances = async ({ supplierName, excludePaymentId = null }) => {
  const advances = await SupplierAdvance.find({
    supplierName: supplierNameFilter(supplierName),
    status: { $in: ["Approved", "Partially Adjusted"] },
  }).sort({ createdAt: 1 }).lean(); // oldest advance first

  return advances
    .map((a) => {
      // If we are editing a payment, its own reservation is "free" for that payment.
      const own = excludePaymentId
        ? (a.allocationRequest || []).find((r) => String(r.paymentId) === String(excludePaymentId))?.requestAmount || 0
        : 0;
      const available = Math.max(0, round2(a.pendingAdjustmentAmount - (a.totalAllocationRequestAmount || 0) + own));
      return {
        advanceId: a._id,
        advanceNumber: a.advanceNumber,
        advanceAmount: a.advanceAmount,
        availableAmount: available,
        status: a.status,
        createdAt: a.createdAt,
      };
    })
    .filter((a) => a.availableAmount > 0);
};

/** Shared message map so every controller answers advance errors the same way. */
export const advanceErrorResponse = (error) => {
  switch (error.message) {
    case "ADVANCE_INPUT_INVALID":
      return [400, "The advance details are not valid."];
    case "ADVANCE_NOT_FOUND":
      return [404, "The selected advance payment could not be found."];
    case "ADVANCE_SUPPLIER_MISMATCH":
      return [400, "The selected advance belongs to a different supplier."];
    case "ADVANCE_NOT_USABLE":
      return [400, `Advance ${error.advanceNumber || ""} is not approved yet, so it cannot be used.`.replace("  ", " ")];
    case "ADVANCE_INSUFFICIENT_BALANCE":
      return [400, `Advance ${error.advanceNumber || ""} does not have enough available balance${error.available !== undefined ? ` (available ₹${error.available})` : ""}.`.replace("  ", " ")];
    case "ADVANCE_REQUEST_NOT_FOUND":
      return [409, "The payment's advance reservation could not be found."];
    case "ADVANCE_EXCEEDS_PAYMENT":
      return [400, "The advance used cannot be more than the payment amount."];
    default:
      return null;
  }
};
