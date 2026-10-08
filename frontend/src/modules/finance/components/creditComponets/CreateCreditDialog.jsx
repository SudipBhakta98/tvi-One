import React, { useState } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { creditApi } from "../../api.js";

export default function CreateCreditDialog({ isOpen, onClose, onSuccess }) {
  const [creditNoteNumber, setCreditNoteNumber] = useState("");
  const [creditNoteAmount, setCreditNoteAmount] = useState("");
  const [creditNoteDate, setCreditNoteDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedNumber = creditNoteNumber.trim();
    const parsedAmount = Number(creditNoteAmount);

    // Validation checks matching backend controllers
    if (!trimmedNumber) {
      setError("Please provide the Credit Note Number.");
      return;
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please provide a Credit Note Amount greater than 0.");
      return;
    }

    if (!creditNoteDate) {
      setError("Please provide a valid Credit Note Date.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        creditNoteNumber: trimmedNumber,
        creditNoteAmount: parsedAmount,
        creditNoteDate: creditNoteDate, // YYYY-MM-DD from HTML date input
      };

      await creditApi.createCredit(payload);

      // Reset and trigger refresh on parent
      setCreditNoteNumber("");
      setCreditNoteAmount("");
      setCreditNoteDate("");

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Failed to create Credit Note."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5 bg-slate-900/80 font-sans"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white border-2 border-slate-300 shadow-2xl  overflow-hidden flex flex-col text-xs relative animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Create Credit Note
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-7 h-7 rounded-md bg-slate-200/70 hover:bg-slate-300 text-slate-700 hover:text-slate-900 transition-colors flex items-center justify-center text-xs shrink-0 font-bold border border-slate-300"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-slate-100/60">
          {error && (
            <div className="p-3 rounded-lg border-2 border-rose-300 bg-rose-50 text-rose-800 text-xs font-bold flex items-center gap-2 shadow-sm">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Content Card */}
          <div className="p-4 rounded-xl border-2 border-slate-300 bg-white space-y-4 shadow-sm">
            {/* Credit Note Number */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Credit Note Number <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={creditNoteNumber}
                onChange={(e) => setCreditNoteNumber(e.target.value)}
                placeholder="e.g. CN-2026-001"
                required
                disabled={loading}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-bold placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-indigo-600 focus:bg-white transition font-mono shadow-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Credit Note Amount */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Amount (₹) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={creditNoteAmount}
                  onChange={(e) => setCreditNoteAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  required
                  disabled={loading}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-extrabold placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-indigo-600 focus:bg-white transition shadow-sm"
                />
              </div>

              {/* Credit Note Date */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Credit Note Date <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  value={creditNoteDate}
                  onChange={(e) => setCreditNoteDate(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-bold outline-none focus:border-indigo-600 focus:bg-white transition shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-slate-300">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-800 font-bold text-xs border-2 border-slate-300 transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-sm border border-indigo-700 disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Creating..." : "Create Credit Note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}