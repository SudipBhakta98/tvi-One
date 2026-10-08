import React, { useState, useEffect } from "react";
import { paymentApi, creditApi } from "../../api.js";
import { formatCurrency, formatDateDMY } from "../../utils/financeFormat.js";
import AdvanceUsagePanel, {
  buildAdvancePayload,
  validateAdvanceUsage,
} from "../advanceComponents/AdvanceUsagePanel.jsx";

// Formats date to YYYY-MM-DD for HTML input[type="date"]
const formatDateForInput = (raw) => {
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().split("T")[0];
};

const getUserDisplayName = (userObj) => {
  if (!userObj) return "—";
  if (typeof userObj === "string") return userObj;
  return userObj.name || userObj.username || userObj.email || "—";
};

function MethodBadge({ method }) {
  if (!method) return <span className="text-slate-500">—</span>;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide bg-indigo-50 text-indigo-600 border-indigo-500/20">
      {method}
    </span>
  );
}

function PaymentStatusBadge({ status }) {
  if (!status) return null;
  const norm = String(status).toLowerCase();
  let classes = "bg-slate-500/10 text-slate-400 border-slate-500/20";
  if (norm === "approved")
    classes = "bg-emerald-50 text-emerald-600 border-emerald-200";
  if (norm === "pending")
    classes = "bg-amber-500/10 text-amber-400 border-amber-500/20";
  if (norm === "rejected")
    classes = "bg-rose-50 text-rose-600 border-rose-300/20";

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${classes}`}
    >
      {status}
    </span>
  );
}

export default function PaymentCard({ payment, onRefresh, invoice, totalPendingPaymentAmount = 0 }) {
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editForm, setEditForm] = useState({});

  const [availableCredits, setAvailableCredits] = useState([]);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // Supplier advance used by this payment (editable while it is not approved)
  const [advances, setAdvances] = useState([]);
  const [waitingApproval, setWaitingApproval] = useState(null);
  const [useAdvance, setUseAdvance] = useState(false);
  const [advanceAmounts, setAdvanceAmounts] = useState({});

  const paymentId = payment._id || payment.id;
  const isApproved = payment.status === "Approved";
  const isNonCash = editForm.paymentMethod && editForm.paymentMethod !== "CASH";

  // While editing, exclude the current payment from the pending total
  // because it is being replaced by the new amount.
  const baseInvoiceOutstanding = Number(invoice?.outstanding ?? payment.invoiceOutstanding ?? 0);
  const originalPaymentAmount = Number(payment.paidAmount || 0);
  const totalPendingPayments = Number(totalPendingPaymentAmount || 0);
  const otherPendingPayments = Math.max(0, totalPendingPayments - originalPaymentAmount);
  const maxAllowedOutstanding = Math.max(0, baseInvoiceOutstanding - otherPendingPayments);

  // Selected credit limit calculation
  const selectedCreditObj = availableCredits.find(
    (c) => c.creditNoteNumber === editForm.creditNoteNumber
  );
  const maxCreditAllowed = Number(selectedCreditObj?.pendingRequestAmount || 0);

  const numericEditingPaid = Number(editForm.paidAmount) || 0;
  const isPaidExceedingInvoice = numericEditingPaid > maxAllowedOutstanding;

  const advanceUsed = useAdvance
    ? advances.reduce((sum, a) => sum + (Number(advanceAmounts[a.advanceId]) || 0), 0)
    : 0;
  const creditPortion = Math.max(
    0,
    Math.round((numericEditingPaid - advanceUsed) * 100) / 100
  );
  const needsCredit = creditPortion > 0;
  const advanceError = validateAdvanceUsage({
    enabled: useAdvance,
    amounts: advanceAmounts,
    advances,
    paidAmount: numericEditingPaid,
  });

  // The payment's own credit request is freed when it is edited.
  const ownCreditBack =
    editForm.creditNoteNumber &&
    editForm.creditNoteNumber === payment.creditNoteNumber &&
    payment.status === "Pending"
      ? Math.max(0, originalPaymentAmount - Number(payment.advanceAmount || 0))
      : 0;
  const isPaidExceedingCredit =
    needsCredit &&
    editForm.creditNoteNumber &&
    creditPortion > maxCreditAllowed + ownCreditBack;

  const clearFeedback = () => setFeedback({ type: "", message: "" });

  // Fetch pending and partially allocated credits on mount of modal/edit
  useEffect(() => {
    let isMounted = true;
    const fetchCredits = async () => {
      try {
        setLoadingCredits(true);
        const res = await creditApi.pendingAndPartialCredits();
        if (isMounted) {
          setAvailableCredits(res.data?.data || []);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Failed to load credit notes", err);
        }
      } finally {
        if (isMounted) {
          setLoadingCredits(false);
        }
      }
    };
    fetchCredits();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load the supplier's advance while editing (own reservation counts as free)
  useEffect(() => {
    if (!isEditing) return undefined;
    let active = true;
    (async () => {
      try {
        const res = await paymentApi.getSupplierAdvanceBalance(
          payment.supplierName,
          payment.status === "Pending" ? paymentId : undefined
        );
        if (!active) return;
        const d = res.data?.data;
        const list = d?.advances || [];
        setAdvances(list);
        setWaitingApproval(d?.waitingApproval || null);

        const existing = {};
        (payment.advanceAllocations || []).forEach((a) => {
          if (list.some((x) => String(x.advanceId) === String(a.advanceId))) {
            existing[a.advanceId] = String(a.amount);
          }
        });
        setUseAdvance(Object.keys(existing).length > 0);
        setAdvanceAmounts(existing);
      } catch (err) {
        console.error("Failed to load supplier advance", err);
      }
    })();
    return () => {
      active = false;
    };
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this payment entry?")) return;
    clearFeedback();
    try {
      setLoading(true);
      const res = await paymentApi.deletePayment(paymentId);

      setFeedback({
        type: "success",
        message: res?.data?.message || "Payment entry deleted successfully.",
      });

      setTimeout(() => {
        setShowModal(false);
        onRefresh();
      }, 1200);
    } catch (err) {
      const serverMsg =
        err.response?.data?.errors?.join(", ") ||
        err.response?.data?.message ||
        "Failed to delete payment.";
      setFeedback({ type: "error", message: serverMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    clearFeedback();

    if (!editForm.remark || !editForm.remark.trim()) {
      setFeedback({
        type: "error",
        message: "Please provide a reason (remark) for updating the payment.",
      });
      return;
    }

    if (numericEditingPaid <= 0) {
      setFeedback({ type: "error", message: "Paid amount must be greater than zero." });
      return;
    }

    if (isPaidExceedingInvoice) {
      setFeedback({
        type: "error",
        message: `Paid amount (₹${numericEditingPaid}) cannot exceed the allowed limit (₹${maxAllowedOutstanding}).`,
      });
      return;
    }

    if (advanceError) {
      setFeedback({ type: "error", message: advanceError });
      return;
    }

    if (needsCredit && !editForm.creditNoteNumber) {
      setFeedback({
        type: "error",
        message:
          advanceUsed > 0
            ? `₹${creditPortion} is not covered by the advance. Please select a Credit Note for the remaining amount.`
            : "Please select a Credit Note.",
      });
      return;
    }

    if (isPaidExceedingCredit) {
      setFeedback({
        type: "error",
        message: `Credit note amount (₹${creditPortion}) cannot exceed the credit note's available pending amount (₹${maxCreditAllowed + ownCreditBack}).`,
      });
      return;
    }

    try {
      setLoading(true);
      const res = await paymentApi.updatePayment(paymentId, {
        ...editForm,
        creditNoteNumber: needsCredit ? editForm.creditNoteNumber : "",
        advanceAllocations: buildAdvancePayload(useAdvance, advanceAmounts),
      });

      setFeedback({
        type: "success",
        message: res?.data?.message || "Payment updated successfully and sent for approval again.",
      });

      setTimeout(() => {
        setIsEditing(false);
        setShowModal(false);
        onRefresh();
      }, 1200);
    } catch (err) {
      const serverMsg =
        err.response?.data?.errors?.join(", ") ||
        err.response?.data?.message ||
        "Failed to update payment.";
      setFeedback({ type: "error", message: serverMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* SUMMARY CARD */}
      <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/40 hover:border-slate-700 transition flex items-center justify-between gap-2 overflow-hidden">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-emerald-600 font-mono text-sm">
              {formatCurrency(payment.paidAmount)}
            </span>
            <MethodBadge method={payment.paymentMethod} />
            <PaymentStatusBadge status={payment.status} />
          </div>
          <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">
            <span>
              Supplier: <strong className="text-slate-700 font-semibold">{payment.supplierName || "—"}</strong>
            </span>
            <span>
              Invoice: <strong className="text-slate-700 font-mono">{payment.invoiceNumber || "—"}</strong>
            </span>
            <span>
              Date: <strong className="text-slate-700 font-mono">{formatDateDMY(payment.paymentDate)}</strong>
            </span>
          </div>
        </div>
        <button
          onClick={() => {
            clearFeedback();
            setEditForm({
              ...payment,
              remark: "",
              paymentDate: formatDateForInput(payment.paymentDate),
            });
            setShowModal(true);
          }}
          className="px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600 text-indigo-600 hover:text-slate-900 border border-indigo-500/30 text-[10px] font-bold transition-all shrink-0"
        >
          View
        </button>
      </div>

      {/* DETAIL & EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50/80 backdrop-blur-sm p-2.5">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden text-xs flex flex-col max-h-[90vh]">
            {/* HEADER */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50/60 shrink-0">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                💳 Payment Details
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setIsEditing(false);
                  clearFeedback();
                }}
                className="text-slate-400 hover:text-slate-900 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* BODY */}
            <div className="p-2.5 space-y-2 overflow-y-auto">
              {/* FEEDBACK DISPLAY */}
              {feedback.message && (
                <div
                  className={`p-2.5 rounded border text-[11px] font-medium leading-relaxed flex items-start justify-between gap-2 ${
                    feedback.type === "success"
                      ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                      : "bg-red-950/60 border-red-800 text-rose-600"
                  }`}
                >
                  <span>{feedback.message}</span>
                  <button
                    onClick={clearFeedback}
                    className="text-slate-400 hover:text-slate-900 shrink-0 font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              {!isEditing ? (
                <div className="space-y-2 text-slate-700">
                  {/* MAIN AMOUNT & STATUS DISPLAY */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50/50 p-2 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-slate-500 text-[9px] uppercase font-bold block">Paid Amount</span>
                      <span className="text-base font-black text-emerald-600">{formatCurrency(payment.paidAmount)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[9px] uppercase font-bold block">Status</span>
                      <PaymentStatusBadge status={payment.status} />
                    </div>
                    <div className="pt-2 border-t border-slate-200/60">
                      <span className="text-slate-500 text-[9px] uppercase font-bold block">Payment Method</span>
                      <MethodBadge method={payment.paymentMethod} />
                    </div>
                    <div className="pt-2 border-t border-slate-200/60">
                      <span className="text-slate-500 text-[9px] uppercase font-bold block">Payment Date</span>
                      <span className="font-mono text-slate-700">{formatDateDMY(payment.paymentDate)}</span>
                    </div>
                  </div>

                  {/* SCHEMA DETAILS */}
                  <div className="space-y-1.5 bg-slate-50/30 p-2 rounded-lg border border-slate-200/50">
                    <div className="flex justify-between border-b border-slate-200/50 pb-1">
                      <span className="text-slate-500">Supplier Name:</span>
                      <span className="text-slate-700 font-semibold truncate ml-2">{payment.supplierName || "—"}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/50 pb-1">
                      <span className="text-slate-500">Invoice Number:</span>
                      <span className="font-mono text-slate-700 font-semibold truncate ml-2">{payment.invoiceNumber || "—"}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/50 pb-1">
                      <span className="text-slate-500">GRN Number:</span>
                      <span className="font-mono text-slate-700 font-semibold truncate ml-2">{payment.grnNumber || "—"}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/50 pb-1">
                      <span className="text-slate-500">Transaction No:</span>
                      <span className="font-mono text-slate-700 truncate ml-2">{payment.transactionNumber || "—"}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/50 pb-1">
                      <span className="text-slate-500">Credit Note No:</span>
                      <span className="font-mono text-slate-700 truncate ml-2">
                        {payment.creditNoteNumber
                          ? `${payment.creditNoteNumber} (${formatCurrency(Number(payment.paidAmount || 0) - Number(payment.advanceAmount || 0))})`
                          : "—"}
                      </span>
                    </div>
                    {Number(payment.advanceAmount) > 0 && (
                      <div className="flex justify-between border-b border-slate-200/50 pb-1">
                        <span className="text-slate-500">Settled from Advance:</span>
                        <span className="font-mono text-indigo-700 font-semibold truncate ml-2">
                          {formatCurrency(payment.advanceAmount)}
                          {payment.advanceAllocations?.length
                            ? ` (${payment.advanceAllocations.map((a) => a.advanceNumber).join(", ")})`
                            : ""}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-b border-slate-200/50 pb-1">
                      <span className="text-slate-500">Created By:</span>
                      <span className="text-slate-700 font-semibold truncate ml-2">{getUserDisplayName(payment.paymentBy)}</span>
                    </div>
                    <div className="flex justify-between pb-0.5">
                      <span className="text-slate-500">Approved / Actioned By:</span>
                      <span className="text-slate-700 font-semibold truncate ml-2">{getUserDisplayName(payment.approvedBy)}</span>
                    </div>
                  </div>

                  {/* LOGS COUNT DISPLAY */}
                  {payment.updateLogs && payment.updateLogs.length > 0 && (
                    <div className="bg-slate-50/20 p-2 rounded border border-slate-200/40 text-[10px] text-slate-400">
                      ℹ️ Revised <strong>{payment.updateLogs.length}</strong> time(s). Last remark: "
                      <em>{payment.updateLogs[payment.updateLogs.length - 1]?.remark}</em>"
                    </div>
                  )}

                  {/* ACTIONS */}
                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                    <button
                      onClick={handleDelete}
                      disabled={loading}
                      className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-slate-900 font-bold rounded text-[11px] disabled:opacity-50 transition-colors"
                    >
                      {loading ? "Deleting..." : "Delete"}
                    </button>
                    {!isApproved ? (
                      <button
                        onClick={() => {
                          clearFeedback();
                          setIsEditing(true);
                        }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-900 font-bold rounded text-[11px] transition-colors"
                      >
                        Edit
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500 italic flex items-center">
                        Approved entries cannot be edited
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* EDIT FORM */
                <form onSubmit={handleUpdate} className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-400 font-medium">
                          Paid Amount (₹) <span className="text-rose-600">*</span>
                        </label>
                        <span className="text-[10px] text-amber-400 font-mono font-semibold" title="Max Allowed Amount">
                          Max: ₹{maxAllowedOutstanding.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        required
                        value={editForm.paidAmount || ""}
                        onChange={(e) => setEditForm({ ...editForm, paidAmount: e.target.value })}
                        className={`w-full bg-slate-50 border rounded px-2 py-1 text-slate-700 font-mono focus:outline-none ${
                          isPaidExceedingInvoice
                            ? "border-rose-300 text-rose-600"
                            : "border-slate-700 focus:border-indigo-500"
                        }`}
                      />
                      {isPaidExceedingInvoice && (
                        <p className="mt-1 text-[10px] text-rose-600 font-semibold">
                          Cannot exceed max allowed limit: ₹{maxAllowedOutstanding}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">
                        Payment Date <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={editForm.paymentDate || ""}
                        onChange={(e) => setEditForm({ ...editForm, paymentDate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-700 rounded px-2 py-1 text-slate-700 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">
                      Supplier Name <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.supplierName || ""}
                      onChange={(e) => setEditForm({ ...editForm, supplierName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-700 rounded px-2.5 py-1 text-slate-700 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">
                      Payment Method <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={editForm.paymentMethod || "CASH"}
                      onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-700 rounded px-2.5 py-1 text-slate-700 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="CASH">CASH</option>
                      <option value="BANK">BANK</option>
                      <option value="CHEQUE">CHEQUE</option>
                      <option value="ONLINE">ONLINE</option>
                      <option value="UPI">UPI</option>
                    </select>
                  </div>

                  {/* SUPPLIER ADVANCE */}
                  <AdvanceUsagePanel
                    supplierName={payment.supplierName}
                    advances={advances}
                    waitingApproval={waitingApproval}
                    enabled={useAdvance}
                    onToggle={setUseAdvance}
                    amounts={advanceAmounts}
                    onAmountsChange={setAdvanceAmounts}
                    paidAmount={numericEditingPaid}
                    disabled={loading}
                  />
                  {advanceError && (
                    <p className="text-[10px] text-rose-600 font-semibold">{advanceError}</p>
                  )}

                  {/* CREDIT NOTE SELECTION */}
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">
                      Credit Note Number{" "}
                      {!needsCredit && <span className="text-slate-400">(not needed – fully settled from advance)</span>}
                    </label>
                    <select
                      disabled={!needsCredit}
                      value={needsCredit ? editForm.creditNoteNumber || "" : ""}
                      onChange={(e) => setEditForm({ ...editForm, creditNoteNumber: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-700 rounded px-2.5 py-1 text-slate-700 focus:outline-none focus:border-indigo-500 font-mono"
                    >
                      <option value="">
                        {loadingCredits ? "Loading credits..." : "-- Select Credit Note (Optional) --"}
                      </option>
                      {availableCredits.map((credit) => (
                        <option key={credit.creditNoteNumber} value={credit.creditNoteNumber}>
                          {credit.creditNoteNumber} (Avail: ₹{credit.pendingRequestAmount})
                        </option>
                      ))}
                    </select>
                    {isPaidExceedingCredit && (
                      <p className="mt-1 text-[10px] text-rose-600 font-semibold">
                        Credit note part (₹{creditPortion}) cannot exceed credit balance ₹{maxCreditAllowed + ownCreditBack}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">
                        Transaction No {isNonCash && needsCredit && <span className="text-rose-600">*</span>}
                      </label>
                      <input
                        type="text"
                        required={isNonCash && needsCredit}
                        value={editForm.transactionNumber || ""}
                        onChange={(e) => setEditForm({ ...editForm, transactionNumber: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-700 rounded px-2.5 py-1 text-slate-700 font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* MANDATORY REMARK FIELD REQUIRED BY CONTROLLER */}
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">
                      Reason for Update (Remark) <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Explain why this payment record is being modified..."
                      value={editForm.remark || ""}
                      onChange={(e) => setEditForm({ ...editForm, remark: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-700 rounded px-2.5 py-1 text-slate-700 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        clearFeedback();
                      }}
                      className="px-3 py-1.5 bg-slate-800 text-slate-700 font-bold rounded text-[11px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading || isPaidExceedingInvoice || isPaidExceedingCredit || !!advanceError}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-slate-900 font-bold rounded text-[11px] disabled:opacity-50"
                    >
                      {loading ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}