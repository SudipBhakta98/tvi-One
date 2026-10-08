import React, { useEffect, useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import { receivablesApi } from "../../api.js";

export default function EditReceivableDialog({ invoice, onClose, onSuccess }) {
  const [editForm, setEditForm] = useState({
    customerName: invoice?.customer_name || invoice?.customerName || "",
    subTotal: invoice?.sub_total ?? invoice?.subTotal ?? "",
    gstAmount: invoice?.gst_amount ?? invoice?.gstAmount ?? "",
    totalAmount: invoice?.total_amount ?? invoice?.totalAmount ?? "",
    remark: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Total = Sub Total + GST
  useEffect(() => {
    const sub = Number(editForm.subTotal);
    const gst = Number(editForm.gstAmount) || 0;
    if (!isNaN(sub) && sub >= 0) {
      setEditForm((prev) => ({ ...prev, totalAmount: (Math.round((sub + gst) * 100) / 100).toFixed(2) }));
    }
  }, [editForm.subTotal, editForm.gstAmount]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Decimal input handler
  const handleDecimalChange = (e) => {
    const { name } = e.target;

    const value = e.target.value
      .replace(/[^0-9.]/g, "")
      .replace(/(\..*)\./g, "$1")
      .replace(/^(\d+)\.(\d{0,2}).*$/, "$1.$2");

    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!editForm.remark.trim()) {
      setError("Remark is required for updating this invoice.");
      return;
    }

    if (Number(editForm.subTotal) < 0) {
      setError("Sub Total cannot be negative.");
      return;
    }

    if (Number(editForm.gstAmount) < 0) {
      setError("GST cannot be negative.");
      return;
    }

    try {
      setLoading(true);

      const targetId = invoice._id || invoice.id;

      const payload = {
        ...editForm,
        subTotal: Number(editForm.subTotal),
        gstAmount: Number(editForm.gstAmount),
        totalAmount: Number(editForm.totalAmount),
      };

      const res = await receivablesApi.update(targetId, payload);

      if (onSuccess) {
        onSuccess(res.data?.message);
      }

      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update record.");
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
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-slate-200 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Edit Receivable Invoice
            </h2>
            <p className="text-[11px] font-semibold text-slate-500">
              Invoice:{" "}
              <span className="font-mono text-slate-800">
                {invoice?.invoice_number || invoice?.invoiceNumber || "N/A"}
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

        {/* FORM CONTENT */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-slate-100/60 text-left">
          {error && (
            <div className="p-3 rounded-lg border-2 border-rose-300 bg-rose-50 text-rose-800 text-xs font-bold flex items-center gap-2 shadow-sm">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* INNER CARD CONTAINER */}
          <div className="p-4 rounded-xl border-2 border-slate-300 bg-white space-y-4 shadow-sm">
            {/* SUPPLIER + SUBTOTAL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Customer Name
                </label>
                <input
                  type="text"
                  name="customerName"
                  value={editForm.customerName}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-bold outline-none focus:border-indigo-600 focus:bg-white transition shadow-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Sub Total (₹)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="subTotal"
                  value={editForm.subTotal}
                  onChange={handleDecimalChange}
                  placeholder="0.00"
                  disabled={loading}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-bold outline-none focus:border-indigo-600 focus:bg-white transition font-mono shadow-sm"
                />
              </div>
            </div>

            {/* GST + TOTAL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  GST (₹)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="gstAmount"
                  value={editForm.gstAmount}
                  onChange={handleDecimalChange}
                  placeholder="0.00"
                  disabled={loading}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-bold outline-none focus:border-indigo-600 focus:bg-white transition font-mono shadow-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                  Total Amount (₹)
                </label>
                <input
                  type="text"
                  name="totalAmount"
                  value={editForm.totalAmount}
                  readOnly
                  className="w-full bg-emerald-50/60 border-2 border-emerald-300 rounded-lg px-3.5 py-2 text-xs text-emerald-900 font-extrabold outline-none cursor-not-allowed font-mono shadow-sm"
                />
              </div>
            </div>

            {/* REMARK */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                Remark <span className="text-rose-600">*</span>
              </label>
              <textarea
                name="remark"
                value={editForm.remark}
                onChange={handleChange}
                required
                disabled={loading}
                rows={3}
                placeholder="Describe the reason for this update..."
                className="w-full bg-slate-50 border-2 border-amber-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-medium placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-amber-500 focus:bg-white transition resize-none shadow-sm"
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
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-sm border border-indigo-700 disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}