import React, { useMemo, useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import { receivablesApi } from "../../api.js";

const PERCENT = 100;

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * PERCENT) / PERCENT;

// GST % worked back from the stored amounts, so it is right whatever format the API sends the rate in.
const gstPercentOf = (gstAmount, subTotal) =>
  Number(subTotal) > 0 ? Number(((Number(gstAmount) / Number(subTotal)) * PERCENT).toFixed(4)) : 0;

const EDIT_INPUT_CLASS =
  "w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-bold outline-none focus:border-indigo-600 focus:bg-white transition shadow-sm";

// Labelled field of the form.
const EditField = ({ label, labelClass = "text-slate-700", children }) => (
  <div className="space-y-1">
    <label className={`block text-[11px] font-bold uppercase tracking-wider ${labelClass}`}>{label}</label>
    {children}
  </div>
);

const MONO_INPUT_CLASS = `${EDIT_INPUT_CLASS} font-mono`;

export default function EditReceivableDialog({ invoice, onClose, onSuccess }) {
  const subTotal = invoice?.subTotal ?? "";
  const gstAmount = invoice?.gstAmount ?? 0;

  const [editForm, setEditForm] = useState({
    customerName: invoice?.customerName || "",
    subTotal,
    gstRate: String(gstPercentOf(gstAmount, subTotal)),
    otherAmount: invoice?.otherAmount ?? "0",
    otherAmountDescription: invoice?.otherAmountDescription ?? "",
    remark: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Total = Sub Total + GST + Other Amount, always in sync with the inputs
  const totalAmount = useMemo(() => {
    const sub = Number(editForm.subTotal);
    if (Number.isNaN(sub) || sub < 0) return "";
    const gstAmount = round2(sub * ((Number(editForm.gstRate) || 0) / PERCENT));
    return round2(sub + gstAmount + (Number(editForm.otherAmount) || 0)).toFixed(2);
  }, [editForm.subTotal, editForm.gstRate, editForm.otherAmount]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  // Decimal input handler
  const handleDecimalChange = (e) => {
    const { name } = e.target;

    let value = e.target.value
      .replace(/[^0-9.]/g, "")
      .replace(/(\..*)\./g, "$1")
      .replace(/^(\d+)\.(\d{0,2}).*$/, "$1.$2");

    // GST: 0 - 100
    if (name === "gstRate" && Number(value) > PERCENT) value = String(PERCENT);

    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const decimalInput = (name, placeholder) => (
    <input
      type="text"
      inputMode="decimal"
      name={name}
      value={editForm[name]}
      onChange={handleDecimalChange}
      placeholder={placeholder}
      disabled={loading}
      className={MONO_INPUT_CLASS}
    />
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!editForm.remark.trim()) return setError("Remark is required for updating this invoice.");
    if (Number(editForm.subTotal) < 0) return setError("Sub Total cannot be negative.");
    if (Number(editForm.gstRate) > PERCENT) return setError("GST Rate cannot be greater than 100%.");

    try {
      setLoading(true);

      const targetId = invoice._id || invoice.id;

      const payload = {
        ...editForm,
        subTotal: Number(editForm.subTotal),
        gstRate: Number(editForm.gstRate),
        otherAmount: Number(editForm.otherAmount || 0),
        otherAmountDescription: editForm.otherAmountDescription.trim(),
        totalAmount: Number(totalAmount),
      };

      const res = await receivablesApi.update(targetId, payload);

      onSuccess?.(res.data?.message);
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
                {invoice?.invoiceNumber || "N/A"}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EditField label="Customer Name">
                <input
                  type="text"
                  name="customerName"
                  value={editForm.customerName}
                  onChange={handleChange}
                  disabled={loading}
                  className={EDIT_INPUT_CLASS}
                />
              </EditField>
              <EditField label="Sub Total (₹)">{decimalInput("subTotal", "0.00")}</EditField>

              <EditField label="GST Rate (%)">{decimalInput("gstRate", "18.00")}</EditField>
              <EditField label="Total Amount (₹)" labelClass="text-emerald-700">
                <input
                  type="text"
                  name="totalAmount"
                  value={totalAmount}
                  readOnly
                  className="w-full bg-emerald-50/60 border-2 border-emerald-300 rounded-lg px-3.5 py-2 text-xs text-emerald-900 font-extrabold outline-none cursor-not-allowed font-mono shadow-sm"
                />
              </EditField>

              <EditField label="Other Amount (₹)">{decimalInput("otherAmount", "0.00")}</EditField>
              <EditField label="Other Amount Description">
                <input
                  type="text"
                  name="otherAmountDescription"
                  value={editForm.otherAmountDescription}
                  onChange={handleChange}
                  placeholder="e.g. Packing charges"
                  disabled={loading}
                  className={EDIT_INPUT_CLASS}
                />
              </EditField>
            </div>

            {/* REMARK */}
            <EditField label={<>Remark <span className="text-rose-600">*</span></>} labelClass="text-amber-700">
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
            </EditField>
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