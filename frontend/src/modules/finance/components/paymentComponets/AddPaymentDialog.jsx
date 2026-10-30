import React, { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { paymentApi, creditApi } from "../../api.js";
import { canManageCreditNotes } from "../../constants/financeRoles.js";
import AdvanceUsagePanel, {
  buildAdvancePayload,
  validateAdvanceUsage,
} from "../advanceComponents/AdvanceUsagePanel.jsx";

export default function AddPaymentDialog({
  invoice,
  totalPendingPaymentAmount = 0,
  preselectAdvance = false,
  onClose,
  onSuccess,
}) {
  // "Pay with Advance" and "Add Payment" are separate modes: advance only, or credit note only.
  const isAdvanceMode = preselectAdvance;
  const canManageCredits = canManageCreditNotes();

  // Extract outstanding limit safely from invoice prop
  const maxOutstanding = Number(invoice?.outstanding ?? 0);
  const pendingPaymentAmount = Number(totalPendingPaymentAmount || 0);
  const netPayable = Number(
    invoice?.actual_payable_amount ??
      invoice?.actualPayableAmount ??
      invoice?.payableAmount ??
      0
  );
  const maxAllowedPayment = Math.max(0, maxOutstanding - pendingPaymentAmount);

  const [formData, setFormData] = useState({
    invoiceNumber: invoice?.invoice_number || invoice?.invoiceNumber || "",
    grnNumber: invoice?.grn_number || invoice?.grnNumber || "",
    supplierName: invoice?.supplier_name || invoice?.supplierName || "",
    paidAmount: maxAllowedPayment > 0 ? maxAllowedPayment : "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "BANK",
    creditNoteNumber: "",
    transactionNumber: "",
  });

  const [availableCredits, setAvailableCredits] = useState([]);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState("");
  const [serverErrors, setServerErrors] = useState([]);
  const [isSuccess, setIsSuccess] = useState(false);

  // ---- Supplier advance (never applied automatically) ----
  const [advances, setAdvances] = useState([]);
  const [waitingApproval, setWaitingApproval] = useState(null);
  const useAdvance = isAdvanceMode;
  const [advanceAmounts, setAdvanceAmounts] = useState({});

  // Look up the supplier's advance balance (re-checked if the supplier name is edited)
  useEffect(() => {
    const name = String(formData.supplierName || "").trim();
    setAdvanceAmounts({});
    if (!name) {
      setAdvances([]);
      setWaitingApproval(null);
      return undefined;
    }
    let active = true;
    const t = setTimeout(async () => {
      try {
        const res = await paymentApi.getSupplierAdvanceBalance(name);
        if (!active) return;
        const d = res.data?.data;
        setAdvances(d?.advances || []);
        setWaitingApproval(d?.waitingApproval || null);
      } catch (err) {
        if (active) {
          setAdvances([]);
          setWaitingApproval(null);
          console.error("Failed to load supplier advance", err);
        }
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [formData.supplierName]);

  // Fetch pending and partially allocated credits on mount
  useEffect(() => {
    let isMounted = true;
    const fetchCredits = async () => {
      if (!canManageCredits) return;
      try {
        setLoadingCredits(true);
        const res = await creditApi.pendingAndPartialCredits();
        if (isMounted) {
          setAvailableCredits(res.data?.data || []);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Failed to load credit notes", err);
        }
      } finally {
        if (isMounted) {
          setLoadingCredits(false);
        }
      }
    };
    fetchCredits();
    return () => {
      isMounted = false;
    };
  }, []);

  // Find selected credit object to check its max available limit
  const selectedCreditObj = availableCredits.find(
    (c) => c.creditNoteNumber === formData.creditNoteNumber
  );
  const maxCreditAllowed = Number(selectedCreditObj?.pendingRequestAmount ?? 0);

  // Validation checks
  const numericPaid = Number(formData.paidAmount) || 0;
  const isPaidExceedingInvoice = numericPaid > maxAllowedPayment;

  // Advance mode: fill the advances oldest-first for the paid amount (user can still adjust the split)
  useEffect(() => {
    if (!isAdvanceMode) return;
    let left = numericPaid;
    const next = {};
    advances.forEach((a) => {
      const take = Math.min(left, Number(a.availableAmount));
      next[a.advanceId] = take > 0 ? String(take) : "";
      left -= take;
    });
    setAdvanceAmounts(next);
  }, [advances, isAdvanceMode, numericPaid]);

  const advanceUsed = useAdvance
    ? advances.reduce((sum, a) => sum + (Number(advanceAmounts[a.advanceId]) || 0), 0)
    : 0;
  const creditPortion = isAdvanceMode ? 0 : numericPaid;
  const advanceCoverError =
    isAdvanceMode && Math.abs(advanceUsed - numericPaid) > 0.001
      ? `Advance used must be equal to the payment amount (₹${numericPaid}).`
      : "";
  const advanceError =
    validateAdvanceUsage({
      enabled: useAdvance,
      amounts: advanceAmounts,
      advances,
      paidAmount: numericPaid,
    }) || advanceCoverError;
  const needsCredit = !isAdvanceMode;
  const needsTxn = needsCredit && formData.paymentMethod !== "CASH";
  const isPaidExceedingCredit =
    needsCredit && formData.creditNoteNumber && creditPortion > maxCreditAllowed;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();

    if (advanceError) {
      setIsSuccess(false);
      setServerMessage(advanceError);
      return;
    }

    if (needsCredit && !canManageCredits) {
      setIsSuccess(false);
      setServerMessage("Only Super User and Admin can allocate Credit Notes. Please contact an authorized user.");
      return;
    }

    if (needsCredit && !formData.creditNoteNumber) {
      setIsSuccess(false);
      setServerMessage("Please select a Credit Note.");
      return;
    }

    if (isPaidExceedingInvoice) {
      setIsSuccess(false);
      setServerMessage(
        `Paid amount (₹${numericPaid}) cannot be more than the maximum allowed payment (₹${maxAllowedPayment}).`
      );
      return;
    }

    if (isPaidExceedingCredit) {
      setIsSuccess(false);
      setServerMessage(
        `Credit note amount (₹${creditPortion}) cannot exceed the credit note's available pending amount (₹${maxCreditAllowed}).`
      );
      return;
    }

    setLoading(true);
    setServerMessage("");
    setServerErrors([]);
    setIsSuccess(false);

    try {
      const response = await paymentApi.createSinglePayment({
        ...formData,
        paymentMethod: isAdvanceMode ? "ADVANCE" : formData.paymentMethod,
        transactionNumber: isAdvanceMode ? "" : formData.transactionNumber,
        creditNoteNumber: needsCredit ? formData.creditNoteNumber : "",
        advanceAllocations: buildAdvancePayload(useAdvance, advanceAmounts),
      });
      setIsSuccess(true);
      setServerMessage(
        response.data?.message || "Payment submitted successfully."
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
        resData?.message || "Something went wrong while creating the payment."
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
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-slate-200 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              {isAdvanceMode ? "Pay with Advance" : "Record Single Payment"}
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

        {/* SUMMARY STATS BANNER */}
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
              Max Allowed
            </span>
            <span className="text-rose-700 font-extrabold text-xs font-mono mt-0.5 truncate">
              ₹{maxAllowedPayment.toLocaleString("en-IN")}
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

          {/* SUPPLIER ADVANCE */}
          {isAdvanceMode && (
            <>
              <AdvanceUsagePanel
                supplierName={formData.supplierName}
                advances={advances}
                waitingApproval={waitingApproval}
                enabled={useAdvance}
                onToggle={() => {}}
                amounts={advanceAmounts}
                onAmountsChange={setAdvanceAmounts}
                paidAmount={numericPaid}
                disabled={loading}
                locked
              />
              {advanceError && (
                <p className="text-[11px] text-rose-600 font-bold -mt-2">{advanceError}</p>
              )}
            </>
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

            {/* SUPPLIER & PAID AMOUNT */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Supplier Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  name="supplierName"
                  value={formData.supplierName}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-bold outline-none focus:border-indigo-600 focus:bg-white transition shadow-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Paid Amount (₹) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="paidAmount"
                  value={formData.paidAmount}
                  disabled={loading}
                  onChange={(e) =>
                    handleChange({
                      target: {
                        name: "paidAmount",
                        value: e.target.value
                          .replace(/[^0-9.]/g, "")
                          .replace(/(\..*)\./g, "$1")
                          .replace(/^(\d+)\.(\d{0,2}).*$/, "$1.$2"),
                      },
                    })
                  }
                  required
                  placeholder="0.00"
                  className={`w-full bg-slate-50 border-2 rounded-lg px-3.5 py-2 text-xs font-mono font-bold outline-none transition shadow-sm ${
                    isPaidExceedingInvoice || isPaidExceedingCredit
                      ? "border-rose-500 text-rose-700 bg-rose-50 focus:border-rose-600"
                      : "border-slate-300 text-slate-900 focus:border-indigo-600 focus:bg-white"
                  }`}
                />
                {isPaidExceedingInvoice && (
                  <p className="mt-1 text-[10px] text-rose-600 font-bold">
                    Cannot exceed max allowed payment ₹{maxAllowedPayment}
                  </p>
                )}
                {isPaidExceedingCredit && (
                  <p className="mt-1 text-[10px] text-rose-600 font-bold">
                    Credit note part (₹{creditPortion}) cannot exceed credit balance ₹{maxCreditAllowed}
                  </p>
                )}
              </div>
            </div>

            {/* DATE & METHOD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Payment Date <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  name="paymentDate"
                  value={formData.paymentDate}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-bold outline-none focus:border-indigo-600 focus:bg-white transition shadow-sm"
                />
              </div>

              {!isAdvanceMode && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Payment Method <span className="text-rose-600">*</span>
                  </label>
                  <select
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-bold outline-none focus:border-indigo-600 focus:bg-white transition shadow-sm"
                  >
                    <option value="BANK">BANK</option>
                    <option value="CHEQUE">CHEQUE</option>
                    <option value="ONLINE">ONLINE</option>
                    <option value="UPI">UPI</option>
                    <option value="CASH">CASH</option>
                  </select>
                </div>
              )}
            </div>

            {/* CREDIT NOTE & TXN NUMBER */}
            {!isAdvanceMode && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {canManageCredits ? <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Credit Note Number{" "}
                    {needsCredit ? (
                      <span className="text-rose-600">*</span>
                    ) : (
                      <span className="text-slate-400 font-normal">(Not needed)</span>
                    )}
                  </label>
                  <select
                    name="creditNoteNumber"
                    value={needsCredit ? formData.creditNoteNumber : ""}
                    onChange={handleChange}
                    required={needsCredit}
                    disabled={loading || !needsCredit}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-mono font-bold outline-none focus:border-indigo-600 focus:bg-white transition shadow-sm"
                  >
                    <option value=""
                    >
                      {loadingCredits
                        ? "Loading credits..."
                        : "-- Select Credit Note --"}
                    </option>
                    {availableCredits.map((credit) => (
                      <option
                        key={credit.creditNoteNumber}
                        value={credit.creditNoteNumber}
                        className="text-[12px] font-extrabold"
                      >
                        {credit.creditNoteNumber} - ( Avail : ₹
                        {credit.pendingRequestAmount})
                      </option>
                    ))}
                  </select>
                </div> : <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">Credit Note allocation is restricted to Super User and Admin.</p>}

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Txn Number{" "}
                    {formData.paymentMethod === "CASH" || !needsCredit ? (
                      <span className="text-slate-400 font-normal">(Optional)</span>
                    ) : (
                      <span className="text-rose-600">*</span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="transactionNumber"
                    value={formData.transactionNumber}
                    onChange={handleChange}
                    disabled={formData.paymentMethod === "CASH" || !needsCredit || loading}
                    required={needsTxn}
                    placeholder={
                      formData.paymentMethod === "CASH"
                        ? "N/A for Cash"
                        : !needsCredit
                        ? "N/A – settled from advance"
                        : "e.g. TXN123456"
                    }
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-mono font-bold outline-none focus:border-indigo-600 focus:bg-white transition shadow-sm disabled:opacity-50 disabled:bg-slate-100 cursor-text disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            )}
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
              disabled={
                loading ||
                numericPaid <= 0 ||
                isPaidExceedingInvoice ||
                isPaidExceedingCredit ||
                !!advanceError
              }
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-sm border border-indigo-700 disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Submitting..." : "Submit Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}