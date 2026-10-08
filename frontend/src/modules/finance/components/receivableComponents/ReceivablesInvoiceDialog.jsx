import React, { useEffect, useState } from "react";
import { receivablesApi } from "../../api.js";
import { useReceivables } from "../../contexts/ReceivableContext.jsx";
import { formatCurrency, formatDisplayDate } from "../../utils/financeFormat.js";
import { StatusBadge, DueDaysBadge } from "./ReceivableBadges.jsx";
import EditReceivableDialog from "./EditReceivableDialog.jsx";
import AddCollectionDialog from "../collectionComponents/AddCollectionDialog.jsx";
import CollectionCard from "../collectionComponents/CollectionCard.jsx";

const SummaryTile = ({ label, value, color }) => (
  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">{label}</div>
    <div className={`text-lg font-black ${color}`}>{formatCurrency(value)}</div>
  </div>
);

const BreakdownTile = ({ label, value }) => (
  <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200">
    <span className="text-slate-500 block text-[10px] uppercase font-semibold">{label}</span>
    <span className="text-base font-bold text-slate-900">{formatCurrency(value)}</span>
  </div>
);

export default function ReceivablesInvoiceDialog({ invoice, onClose, onRecordChanged }) {
  const { detailsData, storeDetails, removeInvoice } = useReceivables();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddCollection, setShowAddCollection] = useState(false);

  const invoiceNumber = invoice.invoice_number ?? invoice.invoiceNumber;
  const grnNumber = invoice.grn_number ?? invoice.grnNumber;

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await receivablesApi.getDetails(invoiceNumber, grnNumber);
      storeDetails(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [invoiceNumber, grnNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  const { collections, totalCollectedAmount, totalTdsAmount, totalPendingAmount } = detailsData;
  const outstanding = Number(invoice.outstanding || 0);
  const isSettled = String(invoice.status || "").toLowerCase() === "collected" || outstanding <= 0;
  const isFullyCoveredByPending = outstanding <= totalPendingAmount;

  const handleRefresh = () => {
    onRecordChanged?.();
    fetchDetails();
  };

  const handleConfirmDelete = async () => {
    try {
      setLoading(true);
      const targetId = invoice._id || invoice.id;
      await receivablesApi.delete(targetId);
      removeInvoice(targetId);
      onRecordChanged?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete record.");
      setShowDeleteConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5 bg-slate-900/80 font-sans" onClick={onClose}>
      <div
        className="w-[98vw] max-w-[1200px] h-[94vh] max-h-[94vh] bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col text-xs relative"
        onClick={(e) => e.stopPropagation()}
      >
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3">
            <div className="max-w-md w-full bg-white border border-slate-200 p-5 rounded-lg shadow-xl space-y-3 text-center">
              <div className="text-3xl">⚠️</div>
              <h3 className="text-sm font-bold text-slate-900">Delete Invoice #{invoiceNumber}?</h3>
              <p className="text-xs text-slate-500">
                This will permanently delete this receivable record along with all its collections.
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <button onClick={() => setShowDeleteConfirm(false)} disabled={loading} className="px-3.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200">
                  Cancel
                </button>
                <button onClick={handleConfirmDelete} disabled={loading} className="px-3.5 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs disabled:opacity-50">
                  {loading ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showEditDialog && (
          <EditReceivableDialog
            invoice={invoice}
            onClose={() => setShowEditDialog(false)}
            onSuccess={(msg) => {
              setSuccessMsg(msg || "Updated successfully.");
              handleRefresh();
            }}
          />
        )}

        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Invoice: {invoiceNumber || "—"}</h2>
            <StatusBadge status={invoice.status} />
            <DueDaysBadge status={invoice.status} dueDays={invoice.due_days ?? invoice.dueDays} />
            {loading && <span className="text-xs text-indigo-600 animate-pulse font-semibold">Syncing...</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowEditDialog(true)} className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md text-xs font-semibold">
              Edit
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-xs font-semibold">
              Delete
            </button>
            <button className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center text-xs font-bold" onClick={onClose} title="Close">
              ✕
            </button>
          </div>
        </div>

        {/* METADATA BAR */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2 shrink-0">
          <div>
            Customer: <span className="text-slate-800 font-bold">{invoice.customer_name ?? invoice.customerName ?? "—"}</span>
          </div>
          <div>
            GRN: <span className="text-slate-800 font-bold">{grnNumber ?? "—"}</span>
          </div>
          <div>
            Date: <span className="text-slate-800 font-bold font-mono">{formatDisplayDate(invoice.invoice_date ?? invoice.invoiceDate)}</span>
          </div>
        </div>

        {/* LEDGER OPERATIONS */}
        <div className="px-4 py-2 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ledger Operations</span>
          <div className="flex gap-2 items-center">
            {isSettled ? (
              <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-md font-semibold">✅ Invoice Fully Collected</span>
            ) : isFullyCoveredByPending ? (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-md font-semibold">⏳ Outstanding fully covered by pending collections</span>
            ) : (
              <button onClick={() => setShowAddCollection(true)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold shadow-sm">
                💵 Add Collection
              </button>
            )}
          </div>
        </div>

        {showAddCollection && (
          <AddCollectionDialog
            invoice={invoice}
            totalPendingAmount={totalPendingAmount}
            onClose={() => setShowAddCollection(false)}
            onSuccess={() => {
              setSuccessMsg("Collection submitted and is waiting for approval.");
              handleRefresh();
            }}
          />
        )}

        {/* BODY */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-slate-50/50">
          {error && <div className="p-3 rounded-md border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold">⚠️ {error}</div>}
          {successMsg && <div className="p-3 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold">✅ {successMsg}</div>}

          <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-4 shadow-sm">
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Invoice Breakdown</h4>
              <div className="grid grid-cols-3 gap-3">
                <BreakdownTile label="Sub Total" value={invoice.sub_total ?? invoice.subTotal} />
                <BreakdownTile label="GST" value={invoice.gst_amount ?? invoice.gstAmount} />
                <BreakdownTile label="Total" value={invoice.total_amount ?? invoice.totalAmount} />
              </div>
            </div>

            <div className="border-t border-slate-200" />

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Collection Summary</h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <SummaryTile label="Total Receivable" value={invoice.total_amount ?? invoice.totalAmount} color="text-indigo-600" />
                <SummaryTile label="Collected" value={totalCollectedAmount} color="text-emerald-600" />
                <SummaryTile label="TDS Deducted" value={totalTdsAmount} color="text-amber-600" />
                <SummaryTile label="Pending Approval" value={totalPendingAmount} color="text-amber-600" />
                <SummaryTile label="Outstanding" value={outstanding} color={outstanding > 0 ? "text-rose-600" : "text-slate-400"} />
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Collections ({collections.length})</span>
              {collections.length > 0 && (
                <span className="text-xs text-slate-500">
                  Pending: <strong className="text-amber-600">{formatCurrency(totalPendingAmount)}</strong>
                </span>
              )}
            </div>

            {collections.length === 0 ? (
              <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-md bg-slate-50 text-xs">
                No collection records found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[45vh] overflow-y-auto pr-1">
                {collections.map((collection) => (
                  <CollectionCard
                    key={collection._id}
                    collection={collection}
                    invoice={invoice}
                    totalPendingAmount={totalPendingAmount}
                    onRefresh={handleRefresh}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 bg-white border-t border-slate-200 flex justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-md text-xs shadow-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
