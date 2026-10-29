import React, { useState, useEffect } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { creditApi } from "../../api.js";
import { useToast } from "../../../../core/notifications/ToastContext";

const initialFormState = {
  creditNoteNumber: "",
  creditNoteAmount: "",
  creditNoteDate: "",
};

const TEXT_FIELDS = [
  ["creditNoteNumber", "Credit Note Number *", "CN-2026-001"],
];

const DECIMAL_FIELDS = [
  ["creditNoteAmount", "Credit Note Amount (₹) *"],
];

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-300 px-4 py-3 text-base font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

const formatMoney = (value) => `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;

export default function CreateCreditDialog({ isOpen, onClose, onSuccess }) {
  const toast = useToast();
  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [errorData, setErrorData] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setFormData(initialFormState);
      setErrorData(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDecimalChange = (event) => {
    const { name, value } = event.target;
    if (value === "") return setFormData((prev) => ({ ...prev, [name]: "" }));
    if (!/^\d*\.?\d{0,2}$/.test(value)) return;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorData(null);

    const trimmedNumber = formData.creditNoteNumber.trim();
    const parsedAmount = Number(formData.creditNoteAmount);

    // Client-side validations
    if (!trimmedNumber) {
      return setErrorData({ message: "Credit Note Number is required." });
    }
    if (formData.creditNoteAmount === "" || isNaN(parsedAmount) || parsedAmount <= 0) {
      return setErrorData({ message: "Please provide a valid Credit Note Amount greater than 0." });
    }
    if (!formData.creditNoteDate) {
      return setErrorData({ message: "Credit Note Date is required." });
    }

    try {
      setLoading(true);

      const payload = {
        creditNoteNumber: trimmedNumber,
        creditNoteAmount: parsedAmount,
        creditNoteDate: formData.creditNoteDate,
      };

      const response = await creditApi.createCredit(payload);
      const successMessage = response.data?.message || "Credit Note created successfully.";
      
      toast.success(successMessage);
      onSuccess?.(successMessage);
      onClose();
    } catch (err) {
      const backendData = err.response?.data || {};
      const mainMsg = backendData.message || err.message || "Failed to create Credit Note.";
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
            <h2 className="text-xl font-black text-slate-900">Create Credit Note</h2>
            <p className="text-xs text-slate-600 mt-0.5">Record a new credit note entry.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            >
              <X size={18} />
            </button>
          </div>
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
                {TEXT_FIELDS.map(([name, label, placeholder]) => (
                  <label key={name} className="block">
                    <span className="block text-sm font-black text-slate-800 mb-2">{label}</span>
                    <input
                      type="text"
                      name={name}
                      value={formData[name]}
                      onChange={handleChange}
                      placeholder={placeholder}
                      className={`${INPUT_CLASS} bg-white`}
                      required
                      disabled={loading}
                    />
                  </label>
                ))}

                {DECIMAL_FIELDS.map(([name, label]) => (
                  <label key={name} className="block">
                    <span className="block text-sm font-black text-slate-800 mb-2">{label}</span>
                    <input
                      name={name}
                      value={formData[name]}
                      onChange={handleDecimalChange}
                      inputMode="decimal"
                      placeholder="e.g. 5000"
                      className={`${INPUT_CLASS} font-mono`}
                      required
                      disabled={loading}
                    />
                  </label>
                ))}

                <label className="block">
                  <span className="block text-sm font-black text-slate-800 mb-2">Credit Note Date *</span>
                  <input
                    type="date"
                    name="creditNoteDate"
                    value={formData.creditNoteDate}
                    onChange={handleChange}
                    className={`${INPUT_CLASS} bg-white`}
                    required
                    disabled={loading}
                  />
                </label>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <div className="text-sm font-black text-slate-900">Summary overview</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <div className="text-xs font-bold text-slate-500">Credit Note Amount</div>
                    <div className="text-lg font-black text-indigo-700 mt-1">
                      {formatMoney(formData.creditNoteAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500">Credit Note Date</div>
                    <div className="text-lg font-black text-slate-900 mt-1">
                      {formData.creditNoteDate || "Not specified"}
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
                  {loading ? "Saving..." : "Create Credit Note"}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}