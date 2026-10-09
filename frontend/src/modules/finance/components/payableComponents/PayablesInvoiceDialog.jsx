import React, { useEffect, useState } from "react";
import { payablesApi, paymentApi } from "../../api.js";
import { usePayables } from "../../contexts/PayableContext.jsx";
import AddPaymentDialog from "../paymentComponets/AddPaymentDialog.jsx";
import EditPayableDialog from "./EditPayableDialog.jsx";
import AddDebitDialog from "../debitComponents/AddDebitDialog.jsx";
import PaymentCard from "../paymentComponets/PaymentCard.jsx";
import DebitCard from "../debitComponents/DebitCard.jsx";
import { formatCurrency, formatDisplayDate } from "../../utils/financeFormat.js";

const PERCENT = 100;

// GST % worked back from the stored amounts, so it is right whatever format the rate is stored in.
const gstPercentOf = (gstAmount, subTotal) =>
  Number(subTotal) > 0 ? Number(((Number(gstAmount) / Number(subTotal)) * PERCENT).toFixed(4)) : 0;

// Small tile of the "Invoice Breakdown" row. `note` is an optional line under the value.
const BreakdownTile = ({ label, value, valueClass = "text-slate-900", note }) => (
  <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200 min-w-0">
    <span className="text-slate-500 block text-[10px] uppercase font-semibold">{label}</span>
    <span className={`text-base font-bold ${valueClass}`}>{formatCurrency(value)}</span>
    {note && (
      <span className="block text-[10px] text-slate-500 truncate" title={note}>
        {note}
      </span>
    )}
  </div>
);

// Tile of the summary row.
const SummaryTile = ({ label, value, valueClass }) => (
  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">{label}</div>
    <div className={`text-lg font-black ${valueClass}`}>{formatCurrency(value)}</div>
  </div>
);

function StatusBadge({ status }) {
  const norm = String(status || "").toLowerCase();
  const configMap = {
    paid: {
      label: "Paid",
      classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    partial: {
      label: "Partial",
      classes: "bg-amber-50 text-amber-700 border-amber-200",
    },
    unpaid: {
      label: "Unpaid",
      classes: "bg-rose-50 text-rose-700 border-rose-200",
    },
  };
  const config = configMap[norm] || {
    label: status || "Unknown",
    classes: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${config.classes}`}
    >
      {config.label}
    </span>
  );
}

function DueDaysBadge({ status, dueDays }) {
  if (String(status || "").toLowerCase() === "paid" || dueDays == null) {
    return <span className="text-slate-400">—</span>;
  }
  const days = Number(dueDays);
  let label = `${days}d left`;
  let classes = "bg-emerald-50 text-emerald-700 border-emerald-200";

  if (days < 0) {
    label = `${Math.abs(days)}d overdue`;
    classes = "bg-rose-50 text-rose-700 border-rose-200 font-bold";
  } else if (days < 15) {
    classes = "bg-amber-50 text-amber-700 border-amber-200";
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] whitespace-nowrap ${classes}`}
    >
      {label}
    </span>
  );
}

export default function PayablesInvoiceDialog({
  invoice: initialInvoice,
  onClose,
  onDetailsFetched,
  onRecordChanged,
}) {
  const { detailsData, storeDetails, removeInvoice } = usePayables();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  // Dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showAddDebit, setShowAddDebit] = useState(false);

  // Supplier advance available for this invoice's supplier
  const [advanceInfo, setAdvanceInfo] = useState(null);
  const [preselectAdvance, setPreselectAdvance] = useState(false);

  const fetchInvoiceDetails = async (isMounted = true) => {
    try {
      setLoading(true);
      setError(null);
      const response = await payablesApi.getDetails(initialInvoice.invoiceNumber, initialInvoice.grnNumber);
      storeDetails(response.data);

      // Advance balance of this supplier (does not block the screen if it fails)
      const supplier = (initialInvoice.supplierName ?? "").trim();
      if (supplier) {
        paymentApi
          .getSupplierAdvanceBalance(supplier)
          .then((r) => isMounted && setAdvanceInfo(r.data?.data || null))
          .catch(() => isMounted && setAdvanceInfo(null));
      }

      if (isMounted && onDetailsFetched) {
        onDetailsFetched({
          ...initialInvoice,
          ...(response.data?.data || {}),
        });
      }
    } catch (err) {
      if (isMounted)
        setError(err.response?.data?.message || "Failed to fetch details.");
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialInvoice) return;
    let isMounted = true;
    storeDetails(null); // clear the previous invoice's payments and debits while this one loads
    fetchInvoiceDetails(isMounted);
    return () => {
      isMounted = false;
    };
  }, [initialInvoice]);

  if (!initialInvoice) return null;

  const activeInvoice = initialInvoice;
  const paymentHistoryList = detailsData?.payments || [];
  const debitHistoryList = detailsData?.debits || [];
  const totalPaidAmount = detailsData?.totalPaidAmount || 0;
  const totalPendingPaymentAmount = detailsData?.totalPendingPaymentAmount || 0;
  const totalDebitAmount = detailsData?.totalDebitAmount || 0;

  // Check if outstanding balance is zero or less
  const outstandingBalance = Number(activeInvoice.outstanding || 0);
  const isZeroOutstanding = outstandingBalance <= 0;

  // Check if outstanding amount is equal to or less than total pending payment amount
  const isFullyCoveredByPending = outstandingBalance <= totalPendingPaymentAmount;

  const handleRefresh = () => {
    if (onRecordChanged) onRecordChanged();
    fetchInvoiceDetails();
  };

  const handleConfirmDelete = async () => {
    try {
      setLoading(true);
      setError(null);
      const targetId = activeInvoice._id || activeInvoice.id;
      await payablesApi.delete(targetId);

      if (removeInvoice) {
        removeInvoice(targetId);
      }

      if (onRecordChanged) onRecordChanged();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete record.");
      setShowDeleteConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Full Overlay Container - Sharp background without blur */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5 bg-slate-900/80 font-sans"
      onClick={onClose}
    >
      {/* Main Modal Shell - Standardized to layout dimensions */}
      <div
        className="w-[98vw] max-w-[1720px] h-[94vh] max-h-[94vh] bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col text-xs relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* DELETE CONFIRMATION OVERLAY */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3">
            <div className="max-w-md w-full bg-white border border-slate-200 p-5 rounded-lg shadow-xl space-y-3 text-center">
              <div className="text-3xl">⚠️</div>
              <h3 className="text-sm font-bold text-slate-900">
                Delete Invoice #{activeInvoice.invoiceNumber}?
              </h3>
              <p className="text-xs text-slate-500">
                This will permanently delete this payable record along with all associated payments and debit notes.
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={loading}
                  className="px-3.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={loading}
                  className="px-3.5 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  {loading ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EDIT DIALOG OVERLAY */}
        {showEditDialog && (
          <EditPayableDialog
            invoice={activeInvoice}
            onClose={() => setShowEditDialog(false)}
            onSuccess={(msg) => {
              setSuccessMsg(msg || "Updated successfully.");
              handleRefresh();
            }}
          />
        )}

        {/* ADD DEBIT DIALOG OVERLAY */}
        {showAddDebit && (
          <AddDebitDialog
            invoice={activeInvoice}
            totalPendingPaymentAmount={totalPendingPaymentAmount}
            onClose={() => setShowAddDebit(false)}
            onSuccess={(msg) => {
              setSuccessMsg(msg || "Debit note created successfully.");
              handleRefresh();
            }}
          />
        )}

        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Invoice: {activeInvoice.invoiceNumber || "—"}
            </h2>
            <StatusBadge status={activeInvoice.status} />
            <DueDaysBadge
              status={activeInvoice.status}
              dueDays={activeInvoice.dueDays}
            />
            {loading && (
              <span className="text-xs text-indigo-600 animate-pulse font-semibold">
                Syncing...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditDialog(true)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md text-xs font-semibold transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-xs font-semibold transition-colors"
            >
              Delete
            </button>
            <button
              className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors flex items-center justify-center text-xs shrink-0 font-bold"
              onClick={onClose}
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* METADATA BAR */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2 shrink-0">
          <div>
            Supplier:{" "}
            <span className="text-slate-800 font-bold">
              {activeInvoice.supplierName || "—"}
            </span>
          </div>
          <div>
            GRN:{" "}
            <span className="text-slate-800 font-bold">
              {activeInvoice.grnNumber ?? "—"}
            </span>
          </div>
          <div>
            Date:{" "}
            <span className="text-slate-800 font-bold font-mono">
              {formatDisplayDate(activeInvoice.invoiceDate)}
            </span>
          </div>
        </div>

        {/* LEDGER OPERATIONS ACTION BAR */}
        <div className="px-4 py-2 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Ledger Operations
          </span>
          <div className="flex gap-2 items-center">
            {String(activeInvoice.status || "").toLowerCase() === "paid" || isZeroOutstanding ? (
              <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-md font-semibold">
                ✅ Invoice Fully Settled
              </span>
            ) : isFullyCoveredByPending ? (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-md font-semibold">
                ⏳ Outstanding fully covered by pending payments
              </span>
            ) : (
              <>
                {Number(advanceInfo?.totalAvailable) > 0 && (
                  <button
                    onClick={() => {
                      setPreselectAdvance(true);
                      setShowAddPayment(true);
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-semibold shadow-sm transition-colors"
                  >
                    💰 Pay with Advance
                  </button>
                )}
                <button
                  onClick={() => {
                    setPreselectAdvance(false);
                    setShowAddPayment(true);
                  }}
                  disabled={isZeroOutstanding}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  💵 Add Payment
                </button>

                {showAddPayment && (
                  <AddPaymentDialog
                    invoice={activeInvoice}
                    totalPendingPaymentAmount={totalPendingPaymentAmount}
                    preselectAdvance={preselectAdvance}
                    onClose={() => setShowAddPayment(false)}
                    onSuccess={(msg) => {
                      setSuccessMsg(msg || "Payment created successfully.");
                      handleRefresh();
                    }}
                  />
                )}
                <button
                  onClick={() => setShowAddDebit(true)}
                  disabled={isZeroOutstanding}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  📑 Add Debit
                </button>
              </>
            )}
          </div>
        </div>

        {/* MAIN BODY AREA */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-slate-50/50">
          {error && (
            <div className="p-3 rounded-md border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold">
              ⚠️ {error}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold">
              ✅ {successMsg}
            </div>
          )}

          {/* SUPPLIER ADVANCE NOTICE */}
          {!isZeroOutstanding && Number(advanceInfo?.totalAvailable) > 0 && (
            <div className="p-3 rounded-lg border-2 border-amber-300 bg-amber-50 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs">
                <div className="font-extrabold text-amber-900">
                  💰 {activeInvoice.supplierName} has{" "}
                  {formatCurrency(advanceInfo.totalAvailable)} advance available
                </div>
                <div className="font-semibold text-amber-800">
                  {advanceInfo.advances
                    .map((a) => `${a.advanceNumber} (${formatCurrency(a.availableAmount)})`)
                    .join(" · ")}
                  {" — "}it is only applied when you choose it while making a payment.
                </div>
              </div>
            </div>
          )}

          {/* UNIFIED BREAKDOWN & SETTLEMENT SUMMARY */}
          <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-4 shadow-sm">
            {/* 1. Breakdown Row */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Invoice Breakdown
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
                <BreakdownTile label="Total" value={activeInvoice.totalAmount} />
                <BreakdownTile label="Sub Total" value={activeInvoice.subTotal} />
                <BreakdownTile
                  label={`GST (${gstPercentOf(activeInvoice.gstAmount, activeInvoice.subTotal)}%)`}
                  value={activeInvoice.gstAmount}
                />
                <BreakdownTile
                  label="Other Amount"
                  value={activeInvoice.otherAmount ?? 0}
                  note={activeInvoice.otherAmountDescription}
                />
                <BreakdownTile
                  label="Debit Note"
                  value={activeInvoice.debitAmount}
                  valueClass="text-rose-600"
                />
                <BreakdownTile
                  label={`TDS (${Number(activeInvoice.tdsRate ?? 0)}%)`}
                  value={activeInvoice.tdsAmount}
                  valueClass="text-amber-600"
                />
              </div>
            </div>

            <div className="border-t border-slate-200" />

            {/* 2. Settlement Summary Row */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Settlement Summary
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <SummaryTile
                  label="Net Payable"
                  value={
                    activeInvoice.actualPayableAmount ?? activeInvoice.payableAmount
                  }
                  valueClass="text-indigo-600"
                />
                <SummaryTile label="Settled" value={totalPaidAmount} valueClass="text-emerald-600" />
                <SummaryTile label="Pending" value={totalPendingPaymentAmount} valueClass="text-amber-600" />
                <SummaryTile
                  label="Outstanding"
                  value={activeInvoice.outstanding}
                  valueClass={outstandingBalance > 0 ? "text-rose-600" : "text-slate-400"}
                />
              </div>
            </div>
          </div>

          {/* PAYMENT & DEBIT CARDS SECTION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PAYMENTS COLUMN */}
            <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Payments ({paymentHistoryList.length})
                </span>
                {paymentHistoryList.length > 0 && (
                  <span className="text-xs text-slate-500">
                    Pending: <strong className="text-amber-600">{formatCurrency(totalPendingPaymentAmount)}</strong>
                  </span>
                )}
              </div>

              {paymentHistoryList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-md bg-slate-50 text-xs">
                  No payment records found.
                </div>
              ) : (
                <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
                  {paymentHistoryList.map((paymentItem, index) => (
                    <PaymentCard
                      key={paymentItem._id || index}
                      payment={paymentItem}
                      invoice={activeInvoice}
                      totalPendingPaymentAmount={totalPendingPaymentAmount}
                      onRefresh={handleRefresh}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* DEBITS COLUMN */}
            <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Debit Notes ({debitHistoryList.length})
                </span>
                {totalDebitAmount > 0 && (
                  <span className="text-xs text-rose-600 font-bold">
                    Total: {formatCurrency(totalDebitAmount)}
                  </span>
                )}
              </div>

              {debitHistoryList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-md bg-slate-50 text-xs">
                  No debit records found.
                </div>
              ) : (
                <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
                  {debitHistoryList.map((debitItem, index) => (
                    <DebitCard
                      key={debitItem._id || index}
                      debit={debitItem}
                      invoice={activeInvoice}
                      totalPendingPaymentAmount={totalPendingPaymentAmount}
                      onRefresh={handleRefresh}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-4 py-3 bg-white border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-md text-xs transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}