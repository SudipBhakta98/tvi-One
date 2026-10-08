import SupplierAdvance from "../../models/supplierAdvanceModel.js";
import { findUsableAdvances, supplierNameFilter, round2 } from "../../utils/advanceSettlement.js";

/**
 * GET /getSupplierAdvanceBalance?supplierName=ABC&excludePaymentId=...
 *
 * Tells the payment screens how much advance a supplier still has.
 * Only APPROVED advances can be used; advances still waiting for approval are
 * reported separately so the user can be warned.
 * excludePaymentId: when editing a payment, its own reservation counts as free.
 */
export const getSupplierAdvanceBalance = async (req, res) => {
  try {
    const supplierName = String(req.query.supplierName || "").trim();
    const excludePaymentId = req.query.excludePaymentId || null;

    if (!supplierName) {
      return res.status(400).json({ success: false, message: "Please provide the supplier name." });
    }

    const [advances, waiting] = await Promise.all([
      findUsableAdvances({ supplierName, excludePaymentId }),
      SupplierAdvance.find({ supplierName: supplierNameFilter(supplierName), status: "Pending" })
        .select("advanceNumber advanceAmount")
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        supplierName,
        totalAvailable: round2(advances.reduce((s, a) => s + a.availableAmount, 0)),
        advances,
        waitingApproval: {
          count: waiting.length,
          amount: round2(waiting.reduce((s, a) => s + a.advanceAmount, 0)),
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to load supplier advance balance." });
  }
};
