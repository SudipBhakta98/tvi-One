import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { collectionApi } from "../../api.js";
import { formatCurrency, decimalOnly } from "../../utils/financeFormat.js";

const SUCCESS_CLOSE_DELAY_MS = 1500;
const LABEL_CLASS = "block text-[11px] font-bold text-slate-700 uppercase tracking-wider";
const INPUT_CLASS =
  "w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-bold outline-none focus:border-indigo-600 focus:bg-white transition shadow-sm";
const LOCKED_INPUT_CLASS =
  "w-full bg-slate-100 border-2 border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-500 font-mono font-bold outline-none cursor-not-allowed";


export default function AddCollectionDialog({ invoice, totalPendingAmount = 0, onClose, onSuccess }) {
  const totalAmount = Number(invoice?.total_amount ?? invoice?.totalAmount ?? 0);
  const outstanding = Number(invoice?.outstanding ?? 0);
  const maxAllowedCollection = Math.max(0, outstanding - Number(totalPendingAmount || 0));

  const [formData, setFormData] = useState({
    invoiceNumber: invoice?.invoice_number ?? invoice?.invoiceNumber ?? "",
    grnNumber: invoice?.grn_number ?? invoice?.grnNumber ?? "",
    customerName: invoice?.customer_name ?? invoice?.customerName ?? "",
    receivedAmount: maxAllowedCollection > 0 ? String(maxAllowedCollection) : "",
    tdsAmount: "",
    collectionDate: new Date().toISOString().split("T")[0],
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const received = Number(formData.receivedAmount) || 0;
  const tds = Number(formData.tdsAmount) || 0;
  const settledAmount = Math.round((received + tds) * 100) / 100;
  const isExceeding = settledAmount > maxAllowedCollection;

  const setAmount = (name) => (e) => setFormData((prev) => ({ ...prev, [name]: decimalOnly(e.target.value) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isExceeding) {
      setIsSuccess(false);
      setMessage(`Received + TDS (₹${settledAmount}) cannot be more than the maximum allowed collection (₹${maxAllowedCollection}).`);
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const res = await collectionApi.createCollection({
        invoiceNumber: formData.invoiceNumber,
        grnNumber: formData.grnNumber,
        receivedAmount: received,
        tdsAmount: tds,
        collectionDate: formData.collectionDate,
      });
      setIsSuccess(true);
      setMessage(res.data?.message || "Collection submitted successfully.");
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, SUCCESS_CLOSE_DELAY_MS);
    } catch (err) {
      setIsSuccess(false);
      const data = err.response?.data;
      setMessage([data?.message || "Something went wrong while creating the collection.", ...(data?.errors || [])].join(" "));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5 bg-slate-900/80 font-sans" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white border-2 border-slate-300 shadow-2xl overflow-hidden flex flex-col text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Add Collection</h2>
            <p className="text-[11px] font-semibold text-slate-500">
              Invoice: <span className="font-mono text-slate-800">{formData.invoiceNumber || "N/A"}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-7 h-7 rounded-md bg-slate-200/70 hover:bg-slate-300 text-slate-700 flex items-center justify-center border border-slate-300"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pt-4 grid grid-cols-3 gap-3 bg-slate-100/60">
          {[
            ["Total Amount", totalAmount, "text-amber-700", "border-slate-300 bg-white"],
            ["Outstanding", outstanding, "text-slate-900", "border-slate-300 bg-white"],
            ["Max Allowed", maxAllowedCollection, "text-rose-700", "border-rose-300 bg-rose-50"],
          ].map(([label, value, color, box]) => (
            <div key={label} className={`p-3 rounded-lg border-2 shadow-sm flex flex-col ${box}`}>
              <span className="text-slate-600 font-bold text-[10px] uppercase tracking-wider">{label}</span>
              <span className={`${color} font-extrabold text-xs font-mono mt-0.5 truncate`}>₹{value.toLocaleString("en-IN")}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-slate-100/60 text-left">
          {message && (
            <div
              className={`p-3 rounded-lg border-2 text-xs font-bold flex items-start gap-2 shadow-sm ${
                isSuccess ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-rose-50 border-rose-300 text-rose-800"
              }`}
            >
              {isSuccess ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
              <span>{message}</span>
            </div>
          )}

          <div className="p-4 rounded-xl border-2 border-slate-300 bg-white space-y-4 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Invoice Number</label>
                <input type="text" value={formData.invoiceNumber} disabled className={LOCKED_INPUT_CLASS} />
              </div>
              <div className="space-y-1">
                <label className={LABEL_CLASS}>GRN Number</label>
                <input type="text" value={formData.grnNumber} disabled className={LOCKED_INPUT_CLASS} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Customer Name</label>
                <input type="text" value={formData.customerName} disabled className={LOCKED_INPUT_CLASS} />
              </div>
              <div className="space-y-1">
                <label className={LABEL_CLASS}>
                  Collection Date <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  value={formData.collectionDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, collectionDate: e.target.value }))}
                  required
                  disabled={loading}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={LABEL_CLASS}>
                  Received Amount (₹) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.receivedAmount}
                  onChange={setAmount("receivedAmount")}
                  required
                  disabled={loading}
                  placeholder="0.00"
                  className={`${INPUT_CLASS} font-mono ${isExceeding ? "border-rose-500 text-rose-700 bg-rose-50" : ""}`}
                />
              </div>
              <div className="space-y-1">
                <label className={LABEL_CLASS}>TDS Amount (₹)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.tdsAmount}
                  onChange={setAmount("tdsAmount")}
                  disabled={loading}
                  placeholder="0.00"
                  className={`${INPUT_CLASS} font-mono ${isExceeding ? "border-rose-500 text-rose-700 bg-rose-50" : ""}`}
                />
              </div>
            </div>

            <div className="flex justify-between text-[11px] font-bold border-t border-slate-200 pt-2">
              <span className="text-slate-600">Settled on invoice (Received + TDS)</span>
              <span className={`font-mono ${isExceeding ? "text-rose-600" : "text-indigo-700"}`}>{formatCurrency(settledAmount)}</span>
            </div>
            {isExceeding && (
              <p className="text-[10px] text-rose-600 font-bold">Cannot exceed max allowed collection ₹{maxAllowedCollection}</p>
            )}
          </div>

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
              disabled={loading || received <= 0 || isExceeding}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-sm border border-indigo-700 disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Submitting..." : "Submit Collection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
