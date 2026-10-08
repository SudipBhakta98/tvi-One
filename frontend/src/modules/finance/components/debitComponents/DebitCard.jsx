import React, { useState } from "react";
import { debitApi } from "../../api.js";
import { formatCurrency, formatDateDMY } from "../../utils/financeFormat.js";

export default function DebitCard({ debit, onRefresh, invoice, totalPendingPaymentAmount = 0 }) {
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    debitAmount: "",
    description: "",
    remark: "",
  });

  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const debitId = debit._id || debit.id;
  const debitAmount = Number(debit.debitAmount || 0);
  const debitDate = debit.createdAt || debit.date;

  // While editing, exclude the current debit's pending effect by restoring
  // its original amount, then subtract all pending payments.
  const invoiceOutstanding = Number(invoice?.outstanding ?? debit.invoiceOutstanding ?? 0);
  const totalPendingPayments = Number(totalPendingPaymentAmount || 0);
  const maxAllowedDebit = Math.max(0, invoiceOutstanding + debitAmount - totalPendingPayments);

  const numericEditingDebit = Number(editForm.debitAmount) || 0;
  const isDebitExceedingMax = numericEditingDebit > maxAllowedDebit;

  const creatorName =
    debit.createdBy?.name ||
    debit.createdBy?.username ||
    (typeof debit.createdBy === "string" ? debit.createdBy : "—");

  const clearFeedback = () => setFeedback({ type: "", message: "" });

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this debit note?")) return;
    clearFeedback();
    try {
      setLoading(true);
      const res = await debitApi.deleteDebit(debitId);

      setFeedback({
        type: "success",
        message: res?.data?.message || "Debit note deleted successfully.",
      });

      setTimeout(() => {
        setShowModal(false);
        onRefresh();
      }, 1200);
    } catch (err) {
      const serverMsg =
        err.response?.data?.errors?.join(", ") ||
        err.response?.data?.message ||
        "Failed to delete debit note.";
      setFeedback({ type: "error", message: serverMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    clearFeedback();

    if (!editForm.remark.trim()) {
      setFeedback({
        type: "error",
        message: "Please provide a remark for the update log.",
      });
      return;
    }

    if (numericEditingDebit <= 0) {
      setFeedback({ type: "error", message: "Debit amount must be greater than zero." });
      return;
    }

    if (isDebitExceedingMax) {
      setFeedback({
        type: "error",
        message: `Debit amount (₹${numericEditingDebit}) cannot exceed the max allowed limit (₹${maxAllowedDebit}).`,
      });
      return;
    }

    try {
      setLoading(true);
      const res = await debitApi.updateDebit(debitId, editForm);

      setFeedback({
        type: "success",
        message: res?.data?.message || "Debit note updated successfully.",
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
        "Failed to update debit note.";
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
            <span className="font-bold text-rose-600 font-mono text-sm">
              {formatCurrency(debitAmount)}
            </span>
            <span className="text-[10px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200 truncate">
              GRN: {debit.grnNumber || "—"}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 truncate break-words">
            {debit.description || "No description provided"}
          </p>
        </div>

        <button
          onClick={() => {
            clearFeedback();
            setEditForm({
              debitAmount: debit.debitAmount || 0,
              description: debit.description || "",
              remark: "",
            });
            setShowModal(true);
          }}
          className="px-2.5 py-1 rounded bg-red-600/20 hover:bg-red-600 text-rose-600 hover:text-slate-900 border border-rose-300/30 text-[10px] font-bold transition-all shrink-0"
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
                <span>📑</span> Debit Note Details
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
              {/* SERVER RESPONSE BANNER */}
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
                <>
                  {/* MAIN AMOUNT & DATE DISPLAY */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50/50 p-2 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-slate-500 text-[9px] uppercase font-bold block">
                        Debit Amount
                      </span>
                      <span className="text-base font-black text-rose-600">
                        {formatCurrency(debitAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[9px] uppercase font-bold block">
                        Created At
                      </span>
                      <span className="font-mono text-slate-700">
                        {formatDateDMY(debitDate)}
                      </span>
                    </div>
                  </div>

                  {/* SCHEMA FIELDS DETAILS */}
                  <div className="space-y-1.5 bg-slate-50/30 p-2 rounded-lg border border-slate-200/50">
                    <div className="flex justify-between border-b border-slate-200/50 pb-1">
                      <span className="text-slate-500">Invoice Number:</span>
                      <span className="font-mono text-slate-700 font-semibold truncate ml-2">
                        {debit.invoiceNumber || "—"}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-slate-200/50 pb-1">
                      <span className="text-slate-500">GRN Number:</span>
                      <span className="font-mono text-slate-700 font-semibold truncate ml-2">
                        {debit.grnNumber || "—"}
                      </span>
                    </div>

                    <div className="flex justify-between pb-0.5">
                      <span className="text-slate-500">Debited By:</span>
                      <span className="text-slate-700 font-semibold truncate ml-2">
                        {creatorName}
                      </span>
                    </div>
                  </div>

                  {/* DESCRIPTION */}
                  <div className="w-full">
                    <span className="text-slate-500 text-[10px] uppercase font-bold block mb-1">
                      Description:
                    </span>
                    <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-slate-700 leading-relaxed whitespace-pre-wrap break-words max-h-40 overflow-y-auto w-full">
                      {debit.description || "No description provided."}
                    </div>
                  </div>

                  {/* ACTIONS */}
                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                    <button
                      onClick={handleDelete}
                      disabled={loading}
                      className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-slate-900 font-bold rounded text-[11px] transition-colors disabled:opacity-50"
                    >
                      {loading ? "Deleting..." : "Delete"}
                    </button>
                    <button
                      onClick={() => {
                        clearFeedback();
                        setIsEditing(true);
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-900 font-bold rounded text-[11px] transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </>
              ) : (
                /* EDIT FORM */
                <form onSubmit={handleUpdate} className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-400 font-medium">
                        Debit Amount (₹) <span className="text-rose-600">*</span>
                      </label>
                      <span className="text-[10px] text-amber-400 font-mono font-semibold" title="Max Allowed Debit">
                        Max: ₹{maxAllowedDebit.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={editForm.debitAmount}
                      onChange={(e) =>
                        setEditForm({ ...editForm, debitAmount: e.target.value })
                      }
                      className={`w-full bg-slate-50 border rounded px-2.5 py-1.5 text-slate-700 focus:outline-none font-mono ${
                        isDebitExceedingMax
                          ? "border-rose-300 text-rose-600"
                          : "border-slate-700 focus:border-indigo-500"
                      }`}
                    />
                    {isDebitExceedingMax && (
                      <p className="mt-1 text-[10px] text-rose-600 font-semibold">
                        Cannot exceed max allowed limit: ₹{maxAllowedDebit}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm({ ...editForm, description: e.target.value })
                      }
                      className="w-full bg-slate-50 border border-slate-700 rounded px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-indigo-500 resize-none break-words"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">
                      Update Remark <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Reason for this update (required for log)..."
                      value={editForm.remark}
                      onChange={(e) =>
                        setEditForm({ ...editForm, remark: e.target.value })
                      }
                      className="w-full bg-slate-50 border border-slate-700 rounded px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-indigo-500"
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
                      disabled={loading || isDebitExceedingMax}
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