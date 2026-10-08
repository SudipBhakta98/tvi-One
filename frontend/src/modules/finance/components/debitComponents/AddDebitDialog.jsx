import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { debitApi } from "../../api.js";

export default function AddDebitDialog({
  invoice,
  totalPendingPaymentAmount,
  onClose,
  onSuccess,
}) {
  // Extract financial limits safely from invoice prop
  const maxOutstanding = Number(invoice?.outstanding ?? 0);
  const netPayable = Number(
    invoice?.actual_payable_amount ??
      invoice?.actualPayableAmount ??
      invoice?.payableAmount ??
      0
  );

  // Fallback calculation for payment pending amount if not explicitly passed as a prop
  const paymentsList = invoice?.payments || invoice?.paymentList || [];
  const paymentPending =
    totalPendingPaymentAmount !== undefined
      ? Number(totalPendingPaymentAmount)
      : paymentsList
          .filter((p) => String(p.status).toLowerCase() === "pending")
          .reduce((acc, p) => acc + Number(p.paidAmount || 0), 0);

  // Max allowed debit amount = (outstanding amount - payment pending amount)
  const maxAllowedDebit = Math.max(0, maxOutstanding - paymentPending);

  const [formData, setFormData] = useState({
    invoiceNumber: invoice?.invoice_number || invoice?.invoiceNumber || "",
    grnNumber: invoice?.grn_number || invoice?.grnNumber || "",
    debitAmount: "",
    description: "",
  });

  const [loading, setLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState("");
  const [serverErrors, setServerErrors] = useState([]);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validation check: Is entered debit amount strictly greater than max allowed debit?
  const numericDebit = Number(formData.debitAmount) || 0;
  const isDebitExceeding = numericDebit > maxAllowedDebit;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (numericDebit <= 0) {
      setIsSuccess(false);
      setServerMessage("Debit amount must be greater than zero.");
      return;
    }

    // Prevent submission if debit amount exceeds max allowed debit limit
    if (isDebitExceeding) {
      setIsSuccess(false);
      setServerMessage(
        `Debit amount (₹${numericDebit}) cannot exceed the max allowed debit (₹${maxAllowedDebit}).`
      );
      return;
    }

    setLoading(true);
    setServerMessage("");
    setServerErrors([]);
    setIsSuccess(false);

    try {
      const response = await debitApi.createDebit({
        invoiceNumber: formData.invoiceNumber,
        grnNumber: formData.grnNumber,
        debitAmount: numericDebit,
        description: formData.description.trim(),
      });

      setIsSuccess(true);
      setServerMessage(
        response.data?.message || "Debit note created successfully."
      );

      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setIsSuccess(false);
      const resData = err.response?.data;

      if (resData?.errors && Array.isArray(resData.errors)) {
        setServerErrors(resData.errors);
      }

      setServerMessage(
        resData?.message || "Something went wrong while creating the debit note."
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
        className="w-full max-w-xl bg-white border-2 border-slate-300 shadow-2xl overflow-hidden flex flex-col text-xs relative animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-slate-200 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Record Debit Note
            </h2>
            <p className="text-[11px] font-semibold text-slate-500">
              Invoice:{" "}
              <span className="font-mono text-slate-800">
                {formData.invoiceNumber || "N/A"}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-7 h-7 rounded-md bg-slate-200/70 hover:bg-slate-300 text-slate-700 hover:text-slate-900 transition-colors flex items-center justify-center text-xs shrink-0 font-bold border border-slate-300"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* FINANCIAL SUMMARY BANNERS */}
        <div className="px-5 pt-4 grid grid-cols-3 gap-3 bg-slate-100/60">
          <div className="p-3 rounded-lg bg-white border-2 border-slate-300 shadow-sm flex flex-col">
            <span className="text-slate-600 font-bold text-[10px] uppercase tracking-wider">
              Net Payable
            </span>
            <span className="text-amber-700 font-extrabold text-xs font-mono mt-0.5 truncate">
              ₹{netPayable.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-white border-2 border-slate-300 shadow-sm flex flex-col">
            <span className="text-slate-600 font-bold text-[10px] uppercase tracking-wider">
              Outstanding
            </span>
            <span className="text-slate-900 font-extrabold text-xs font-mono mt-0.5 truncate">
              ₹{maxOutstanding.toLocaleString("en-IN")}
            </span>
          </div>

          <div
            className="p-3 rounded-lg bg-rose-50 border-2 border-rose-300 shadow-sm flex flex-col"
            title="Outstanding - Payment Pending"
          >
            <span className="text-rose-800 font-bold text-[10px] uppercase tracking-wider">
              Max Allowed Debit
            </span>
            <span className="text-rose-700 font-extrabold text-xs font-mono mt-0.5 truncate">
              ₹{maxAllowedDebit.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* FORM CONTENT */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-slate-100/60 text-left">
          {/* SERVER MESSAGES & ERROR FEEDBACK */}
          {serverMessage && (
            <div
              className={`p-3 rounded-lg border-2 text-xs font-bold flex items-start gap-2 shadow-sm ${
                isSuccess
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                  : "bg-rose-50 border-rose-300 text-rose-800"
              }`}
            >
              {isSuccess ? (
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="shrink-0 text-rose-600 mt-0.5" />
              )}
              <div className="space-y-1">
                <div>{serverMessage}</div>
                {serverErrors.length > 0 && (
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] font-semibold">
                    {serverErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* INNER CARD CONTAINER */}
          <div className="p-4 rounded-xl border-2 border-slate-300 bg-white space-y-4 shadow-sm">
            {/* INVOICE & GRN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Invoice Number
                </label>
                <input
                  type="text"
                  name="invoiceNumber"
                  value={formData.invoiceNumber}
                  disabled
                  className="w-full bg-slate-100 border-2 border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-500 font-mono font-bold outline-none cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  GRN Number
                </label>
                <input
                  type="text"
                  name="grnNumber"
                  value={formData.grnNumber}
                  disabled
                  className="w-full bg-slate-100 border-2 border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-500 font-mono font-bold outline-none cursor-not-allowed"
                />
              </div>
            </div>

            {/* DEBIT AMOUNT */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Debit Amount (₹) <span className="text-rose-600">*</span>
                </label>
                <span className="text-[11px] text-amber-700 font-mono font-bold">
                  Max: ₹{maxAllowedDebit.toLocaleString("en-IN")}
                </span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                name="debitAmount"
                value={formData.debitAmount}
                disabled={loading}
                onChange={(e) =>
                  handleChange({
                    target: {
                      name: "debitAmount",
                      value: e.target.value
                        .replace(/[^0-9.]/g, "")
                        .replace(/(\..*)\./g, "$1")
                        .replace(/^(\d+)\.(\d{0,2}).*$/, "$1.$2"),
                    },
                  })
                }
                required
                placeholder="Enter the debit amount"
                className={`w-full bg-slate-50 border-2 rounded-lg px-3.5 py-2 text-xs font-mono font-bold outline-none transition shadow-sm ${
                  isDebitExceeding
                    ? "border-rose-500 text-rose-700 bg-rose-50 focus:border-rose-600"
                    : "border-slate-300 text-slate-900 focus:border-indigo-600 focus:bg-white"
                }`}
              />
              {isDebitExceeding && (
                <p className="mt-1 text-[10px] text-rose-600 font-bold">
                  Debit amount cannot exceed max allowed limit: ₹
                  {maxAllowedDebit.toLocaleString("en-IN")}
                </p>
              )}
            </div>

            {/* DESCRIPTION */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Description / Reason
              </label>
              <textarea
                rows={3}
                name="description"
                value={formData.description}
                onChange={handleChange}
                disabled={loading}
                placeholder="Reason for creating this debit note..."
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-medium placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-indigo-600 focus:bg-white transition resize-none shadow-sm"
              />
            </div>
          </div>

          {/* ACTION BUTTONS */}
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
              disabled={loading || isDebitExceeding || numericDebit <= 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-sm border border-rose-700 disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Submitting..." : "Submit Debit Note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}