import React, { useEffect, useMemo, useState } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { paymentApi, payablesApi } from "../../api.js";

const today = () => new Date().toISOString().slice(0, 10);

const inputCls =
  "w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-bold placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-indigo-600 focus:bg-white transition shadow-sm";
const labelCls = "block text-[11px] font-bold text-slate-700 uppercase tracking-wider";

export default function MakeAdvanceDialog({ isOpen, onClose, onSuccess, knownSuppliers = [] }) {
  const [form, setForm] = useState({
    supplierName: "",
    paidAmount: "",
    paymentDate: today(),
    paymentMethod: "BANK",
    transactionNumber: "",
    remark: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payableSuppliers, setPayableSuppliers] = useState([]);

  // Load supplier names from payables each time the dialog opens (suggestions only, so a failure is ignored).
  useEffect(() => {
    if (!isOpen) return;
    payablesApi
      .getAnalytics()
      .then((response) => setPayableSuppliers((response.data?.data || []).map((invoice) => invoice.supplierName)))
      .catch(() => setPayableSuppliers([]));
  }, [isOpen]);

  // Suggest supplier names already used in payables / advances so the name
  // matches exactly and the advance shows up on that supplier's invoices.
  const supplierSuggestions = useMemo(() => {
    const names = new Set(knownSuppliers);
    payableSuppliers.forEach((name) => {
      const trimmed = String(name ?? "").trim();
      if (trimmed) names.add(trimmed);
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [payableSuppliers, knownSuppliers]);

  if (!isOpen) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isCash = form.paymentMethod === "CASH";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.supplierName.trim()) return setError("Please provide the supplier name.");
    if (!(Number(form.paidAmount) > 0)) return setError("Advance amount must be greater than 0.");
    if (!form.paymentDate) return setError("Please provide a valid payment date.");
    if (!isCash && !form.transactionNumber.trim())
      return setError("Transaction number is required for this payment method.");

    try {
      setLoading(true);
      await paymentApi.createSupplierAdvance({
        ...form,
        supplierName: form.supplierName.trim(),
        paidAmount: Number(form.paidAmount),
      });
      setForm({ supplierName: "", paidAmount: "", paymentDate: today(), paymentMethod: "BANK", transactionNumber: "", remark: "" });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to make advance payment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5 bg-slate-900/80 font-sans" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white border-2 border-slate-300 shadow-2xl overflow-hidden flex flex-col text-xs relative animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-slate-200 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Make Advance Payment</h2>
            <p className="text-[11px] font-semibold text-slate-500">No invoice or GRN needed. It can be settled against this supplier's invoices later.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-7 h-7 rounded-md bg-slate-200/70 hover:bg-slate-300 text-slate-700 transition-colors flex items-center justify-center shrink-0 border border-slate-300"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-slate-100/60">
          {error && (
            <div className="p-3 rounded-lg border-2 border-rose-300 bg-rose-50 text-rose-800 text-xs font-bold flex items-center gap-2 shadow-sm">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-4 rounded-xl border-2 border-slate-300 bg-white space-y-4 shadow-sm">
            <div className="space-y-1">
              <label className={labelCls}>Supplier Name <span className="text-rose-600">*</span></label>
              <input
                list="advance-supplier-list"
                value={form.supplierName}
                onChange={set("supplierName")}
                placeholder="Select or type supplier"
                required
                disabled={loading}
                className={inputCls}
              />
              <datalist id="advance-supplier-list">
                {supplierSuggestions.map((n) => <option key={n} value={n} />)}
              </datalist>
              <p className="text-[10px] text-slate-500 font-semibold">
                Use the same spelling as the supplier's invoices so the advance is offered on their payables.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelCls}>Advance Amount (₹) <span className="text-rose-600">*</span></label>
                <input type="number" step="any" min="0.01" value={form.paidAmount} onChange={set("paidAmount")} placeholder="e.g. 500" required disabled={loading} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Payment Date <span className="text-rose-600">*</span></label>
                <input type="date" value={form.paymentDate} onChange={set("paymentDate")} required disabled={loading} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelCls}>Payment Method <span className="text-rose-600">*</span></label>
                <select value={form.paymentMethod} onChange={set("paymentMethod")} disabled={loading} className={inputCls}>
                  <option value="BANK">BANK</option>
                  <option value="CHEQUE">CHEQUE</option>
                  <option value="ONLINE">ONLINE</option>
                  <option value="UPI">UPI</option>
                  <option value="CASH">CASH</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelCls}>
                  Txn Number {isCash ? <span className="text-slate-400 font-normal">(Optional)</span> : <span className="text-rose-600">*</span>}
                </label>
                <input
                  value={form.transactionNumber}
                  onChange={set("transactionNumber")}
                  disabled={isCash || loading}
                  placeholder={isCash ? "N/A for Cash" : "e.g. TXN123456"}
                  className={`${inputCls} font-mono disabled:opacity-50 disabled:bg-slate-100`}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelCls}>Remark</label>
              <input value={form.remark} onChange={set("remark")} placeholder="Optional note" disabled={loading} className={inputCls} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-slate-300">
            <button type="button" onClick={onClose} disabled={loading} className="px-4 py-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-800 font-bold text-xs border-2 border-slate-300 transition-colors shadow-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-sm border border-indigo-700 disabled:opacity-50">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Saving..." : "Make Advance Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
