import React, { useEffect, useMemo, useState } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { paymentApi, payablesApi } from "../../api.js";
import { useToast } from "../../../../core/notifications/ToastContext";

const today = () => new Date().toISOString().slice(0, 10);

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-300 px-4 py-3 text-base font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

const formatMoney = (value) => `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;

export default function MakeAdvanceDialog({ isOpen, onClose, onSuccess, knownSuppliers = [] }) {
  const toast = useToast();
  const [form, setForm] = useState({
    supplierName: "",
    paidAmount: "",
    paymentDate: today(),
    paymentMethod: "BANK",
    transactionNumber: "",
    remark: "",
  });
  const [loading, setLoading] = useState(false);
  const [errorData, setErrorData] = useState(null);
  const [payableSuppliers, setPayableSuppliers] = useState([]);

  // Load supplier names from payables each time the dialog opens
  useEffect(() => {
    if (!isOpen) {
      setForm({
        supplierName: "",
        paidAmount: "",
        paymentDate: today(),
        paymentMethod: "BANK",
        transactionNumber: "",
        remark: "",
      });
      setErrorData(null);
      return;
    }
    payablesApi
      .getAnalytics()
      .then((response) => setPayableSuppliers((response.data?.data || []).map((invoice) => invoice.supplierName)))
      .catch(() => setPayableSuppliers([]));
  }, [isOpen]);

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

  const handleDecimalChange = (event) => {
    const { name, value } = event.target;
    if (value === "") return setForm((prev) => ({ ...prev, [name]: "" }));
    if (!/^\d*\.?\d{0,2}$/.test(value)) return;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorData(null);

    if (!form.supplierName.trim()) return setErrorData({ message: "Please provide the supplier name." });
    if (!(Number(form.paidAmount) > 0)) return setErrorData({ message: "Advance amount must be greater than 0." });
    if (!form.paymentDate) return setErrorData({ message: "Please provide a valid payment date." });
    if (!isCash && !form.transactionNumber.trim())
      return setErrorData({ message: "Transaction number is required for this payment method." });

    try {
      setLoading(true);
      const response = await paymentApi.createSupplierAdvance({
        ...form,
        supplierName: form.supplierName.trim(),
        paidAmount: Number(form.paidAmount),
      });

      const successMessage = response.data?.message || "Advance payment created successfully.";
      toast.success(successMessage);
      onSuccess?.(successMessage);
      onClose();
    } catch (err) {
      const backendData = err.response?.data || {};
      const mainMsg = backendData.message || err.message || "Failed to make advance payment.";
      const detailErrors = backendData.errors || [];

      setErrorData({
        message: mainMsg,
        errors: detailErrors,
      });

      toast.error(detailErrors.length > 0 ? detailErrors[0] : mainMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
      <div className="relative w-full max-w-6xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">Make Advance Payment</h2>
            <p className="text-xs text-slate-600 mt-0.5">No invoice or GRN needed. It can be settled against this supplier's invoices later.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            title="Close"
          >
            <X size={18} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            {errorData && (
              <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 font-sans">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-rose-600 mt-0.5 shrink-0" size={20} />
                  <div className="flex-1">
                    <h3 className="text-sm font-black text-rose-900">{errorData.message}</h3>

                    {errorData.errors && errorData.errors.length > 0 && (
                      <ul className="mt-2 list-disc list-inside space-y-1 text-xs font-semibold text-rose-800">
                        {errorData.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <label className="block md:col-span-2">
                  <span className="block text-sm font-black text-slate-800 mb-2">Supplier Name *</span>
                  <input
                    list="advance-supplier-list"
                    value={form.supplierName}
                    onChange={set("supplierName")}
                    placeholder="Select or type supplier"
                    required
                    disabled={loading}
                    className={`${INPUT_CLASS} bg-white`}
                  />
                  <datalist id="advance-supplier-list">
                    {supplierSuggestions.map((n) => <option key={n} value={n} />)}
                  </datalist>
                  <span className="block text-xs font-semibold text-slate-500 mt-1">
                    Use the same spelling as the supplier's invoices so the advance is offered on their payables.
                  </span>
                </label>

                <label className="block">
                  <span className="block text-sm font-black text-slate-800 mb-2">Payment Date *</span>
                  <input
                    type="date"
                    value={form.paymentDate}
                    onChange={set("paymentDate")}
                    required
                    disabled={loading}
                    className={`${INPUT_CLASS} bg-white`}
                  />
                </label>

                <label className="block">
                  <span className="block text-sm font-black text-slate-800 mb-2">Advance Amount (₹) *</span>
                  <input
                    name="paidAmount"
                    type="text"
                    inputMode="decimal"
                    value={form.paidAmount}
                    onChange={handleDecimalChange}
                    placeholder="e.g. 500"
                    required
                    disabled={loading}
                    className={`${INPUT_CLASS} font-mono`}
                  />
                </label>

                <label className="block">
                  <span className="block text-sm font-black text-slate-800 mb-2">Payment Method *</span>
                  <select
                    value={form.paymentMethod}
                    onChange={set("paymentMethod")}
                    disabled={loading}
                    className={`${INPUT_CLASS} bg-white`}
                  >
                    <option value="BANK">BANK</option>
                    <option value="CHEQUE">CHEQUE</option>
                    <option value="ONLINE">ONLINE</option>
                    <option value="UPI">UPI</option>
                    <option value="CASH">CASH</option>
                  </select>
                </label>

                <label className="block">
                  <span className="block text-sm font-black text-slate-800 mb-2">
                    Txn Number {isCash ? <span className="text-slate-400 font-normal">(Optional)</span> : <span className="text-rose-600">*</span>}
                  </span>
                  <input
                    value={form.transactionNumber}
                    onChange={set("transactionNumber")}
                    disabled={isCash || loading}
                    placeholder={isCash ? "N/A for Cash" : "e.g. TXN123456"}
                    className={`${INPUT_CLASS} font-mono disabled:opacity-50 disabled:bg-slate-100`}
                  />
                </label>

                <label className="block md:col-span-3">
                  <span className="block text-sm font-black text-slate-800 mb-2">Remark</span>
                  <input
                    value={form.remark}
                    onChange={set("remark")}
                    placeholder="Optional note"
                    disabled={loading}
                    className={`${INPUT_CLASS} bg-white`}
                  />
                </label>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <div className="text-sm font-black text-slate-900">Summary overview</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <div className="text-xs font-bold text-slate-500">Advance Amount</div>
                    <div className="text-lg font-black text-indigo-700 mt-1">
                      {formatMoney(form.paidAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500">Payment Details</div>
                    <div className="text-sm font-black text-slate-900 mt-1">
                      {form.paymentMethod} {form.transactionNumber ? `(${form.transactionNumber})` : ""}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-black text-slate-800 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-7 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {loading ? "Saving..." : "Make Advance Payment"}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}