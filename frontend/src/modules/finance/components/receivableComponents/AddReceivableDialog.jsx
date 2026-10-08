import React, { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, X, AlertCircle } from "lucide-react";
import { receivablesApi } from "../../api.js";
import BulkUploadWorkspace from "../common/BulkUploadWorkspace.jsx";
import { BULK_RECEIVABLE_COLUMN_GUIDE, BULK_RECEIVABLE_FORMAT_NOTES, parseBulkReceivableFile } from "../../utils/bulkReceivableParser.js";
import { useToast } from "../../../../core/notifications/ToastContext";

const initialFormState = {
  invoiceNumber: "",
  grnNumber: "",
  customerName: "",
  invoiceDate: "",
  subTotal: "",
  gstRate: "18", // percent, as typed by the user
};

const formatMoney = (value) => `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

// Form percent (18) -> fraction (0.18) that the backend expects.
const percentToFraction = (percent) => Number((Number(percent || 0) / 100).toFixed(6));

export default function AddReceivableDialog({ isOpen, onClose, onSuccess }) {
  const toast = useToast();
  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);

  // Structured error state for holding detailed server errors
  const [errorData, setErrorData] = useState(null);
  const [bulkMode, setBulkMode] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setFormData(initialFormState);
      setErrorData(null);
      setBulkMode(false);
    }
  }, [isOpen]);

  // Derived values: always in sync, no effect needed.
  const { gstAmount, totalAmount } = useMemo(() => {
    const sub = parseFloat(formData.subTotal);
    const gst = parseFloat(formData.gstRate);
    if (Number.isNaN(sub) || sub < 0) return { gstAmount: 0, totalAmount: "" };
    const gstAmt = round2(sub * ((Number.isNaN(gst) ? 0 : gst) / 100));
    return { gstAmount: gstAmt, totalAmount: round2(sub + gstAmt).toFixed(2) };
  }, [formData.subTotal, formData.gstRate]);

  if (!isOpen) return null;

  if (bulkMode) {
    return (
      <BulkUploadWorkspace
        title="Bulk Add Receivable Invoices"
        dataLabel="receivable"
        partyLabel="Customer"
        partyField="customerName"
        columnGuide={BULK_RECEIVABLE_COLUMN_GUIDE}
        formatNotes={BULK_RECEIVABLE_FORMAT_NOTES}
        parseFile={parseBulkReceivableFile}
        createInvoices={(rows) => receivablesApi.create({ invoices: rows })}
        templateFileName="receivable-bulk-upload-template.csv"
        onBack={() => setBulkMode(false)}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDecimalChange = (event) => {
    const { name, value } = event.target;
    if (value === "") return setFormData((prev) => ({ ...prev, [name]: "" }));
    if (!/^\d*\.?\d{0,2}$/.test(value)) return;
    if (name === "gstRate" && Number(value) > 100) return;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorData(null);

    // Client-side validations
    if (!formData.invoiceNumber.trim()) return setErrorData({ message: "Invoice Number is required." });
    if (!formData.grnNumber.trim()) return setErrorData({ message: "GRN Number is required." });
    if (!formData.customerName.trim()) return setErrorData({ message: "Customer Name is required." });
    if (!formData.invoiceDate) return setErrorData({ message: "Invoice Date is required." });
    if (formData.subTotal === "" || Number(formData.subTotal) < 0) {
      return setErrorData({ message: "Sub Total must be a valid non-negative number." });
    }
    if (formData.gstRate === "") return setErrorData({ message: "GST Rate is required." });
    if (Number(formData.gstRate) > 100) {
      return setErrorData({ message: "GST rate cannot exceed 100%." });
    }

    try {
      setLoading(true);

      // GST rate is sent as a fraction (18% -> 0.18), same as bulk.
      const response = await receivablesApi.create({
        invoiceNumber: formData.invoiceNumber.trim(),
        grnNumber: formData.grnNumber.trim(),
        customerName: formData.customerName.trim(),
        invoiceDate: formData.invoiceDate,
        subTotal: Number(formData.subTotal),
        gstRate: percentToFraction(formData.gstRate),
        totalAmount: Number(totalAmount),
      });

      const successMessage = response.data?.message || "Receivable created successfully.";
      toast.success(successMessage);
      onSuccess?.(successMessage);
      onClose();
    } catch (err) {
      const backendData = err.response?.data || {};
      const mainMsg = backendData.message || "Failed to create receivable invoice.";
      const detailErrors = backendData.errors || backendData.failedInvoice?.errors || [];

      setErrorData({
        message: mainMsg,
        errors: detailErrors,
        failedInvoice: backendData.failedInvoice,
      });

      toast.error(detailErrors.length > 0 ? detailErrors[0] : mainMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed top-14 left-64 right-0 bottom-0 z-50 bg-slate-50 overflow-y-auto">
      <div className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Add Receivable Invoice</h2>
            <p className="text-sm text-slate-600 mt-0.5">Create one customer invoice or switch to bulk upload.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBulkMode(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-black text-white hover:bg-indigo-700"
            >
              <FileSpreadsheet size={18} /> Bulk Receivable Add
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-700"
            >
              <X size={18} /> Close
            </button>
          </div>
        </header>

        <main className="flex-1 p-6">
          <div className="max-w-5xl mx-auto rounded-xl border border-slate-200 bg-white shadow-sm p-6 md:p-8">
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

                    {errorData.failedInvoice && (
                      <div className="mt-3 pt-2 border-t border-rose-200/60 text-xs font-medium text-rose-700 flex flex-wrap gap-x-4 gap-y-1">
                        <span><strong>Invoice:</strong> {errorData.failedInvoice.invoiceNumber}</span>
                        <span><strong>GRN:</strong> {errorData.failedInvoice.grnNumber}</span>
                        <span><strong>Customer:</strong> {errorData.failedInvoice.customerName || errorData.failedInvoice.supplierName}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  ["invoiceNumber", "Invoice Number *", "INV-2026-001"],
                  ["grnNumber", "GRN Number *", "GRN-9942"],
                  ["customerName", "Customer Name *", "XYZ Enterprises"],
                  ["invoiceDate", "Invoice Date *", ""],
                ].map(([name, label, placeholder]) => (
                  <label key={name} className="block">
                    <span className="block text-sm font-black text-slate-800 mb-2">{label}</span>
                    <input
                      type={name === "invoiceDate" ? "date" : "text"}
                      name={name}
                      value={formData[name]}
                      onChange={handleChange}
                      placeholder={placeholder}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      required
                    />
                  </label>
                ))}
                <label className="block">
                  <span className="block text-sm font-black text-slate-800 mb-2">Sub Total (₹) *</span>
                  <input
                    name="subTotal"
                    value={formData.subTotal}
                    onChange={handleDecimalChange}
                    inputMode="decimal"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base font-semibold font-mono text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    required
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-black text-slate-800 mb-2">GST Rate (%) *</span>
                  <input
                    name="gstRate"
                    value={formData.gstRate}
                    onChange={handleDecimalChange}
                    inputMode="decimal"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base font-semibold font-mono text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    required
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="block text-sm font-black text-slate-800 mb-2">Total Amount (₹)</span>
                  <input
                    name="totalAmount"
                    value={totalAmount}
                    readOnly
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-base font-black font-mono text-slate-900"
                  />
                </label>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <div className="text-sm font-black text-slate-900">Calculated invoice summary</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <div className="text-xs font-bold text-slate-500">Sub Total</div>
                    <div className="text-lg font-black text-slate-900 mt-1">{formatMoney(formData.subTotal)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500">GST</div>
                    <div className="text-lg font-black text-slate-900 mt-1">{formatMoney(gstAmount)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500">Total</div>
                    <div className="text-lg font-black text-indigo-700 mt-1">{formatMoney(totalAmount)}</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-black text-slate-800 hover:bg-slate-100"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-emerald-600 px-7 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Create Receivable Invoice"}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}