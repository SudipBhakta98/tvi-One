// src/components/creditComponents/CreditNoteDialog.jsx

import React, { useEffect, useState } from "react";
import { creditApi, paymentApi } from "../../api.js";
import { useToast } from "../../../../core/notifications/ToastContext";
import { formatCurrency, formatDateDMY } from "../../utils/financeFormat.js";

const resolveUserName = (userObjOrId) => {
  if (!userObjOrId) return null;
  if (typeof userObjOrId === "object") {
    return userObjOrId.name || userObjOrId.email || null;
  }
  return String(userObjOrId);
};

function CreditStatusBadge({ status }) {
  const norm = String(status || "").toLowerCase();
  const configMap = {
    allocated: {
      label: "Fully Allocated",
      classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    partial: {
      label: "Partially Allocated",
      classes: "bg-amber-50 text-amber-700 border-amber-200",
    },
    unallocated: {
      label: "Unallocated",
      classes: "bg-rose-50 text-rose-700 border-rose-200",
    },
    pending_request: {
      label: "Pending Request",
      classes: "bg-indigo-50 text-indigo-700 border-indigo-200",
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

const getCalculatedStatus = (data) => {
  if (!data) return "unallocated";
  const total = Number(data.creditNoteAmount) || 0;
  const allocated = Number(data.totalAllocatedAmount) || 0;
  const pending = Number(data.pendingAllocationAmount) || 0;

  if (allocated === 0 && pending === total) return "unallocated";
  if (allocated > 0 && pending > 0) return "partial";
  if (allocated >= total || pending === 0) return "allocated";
  return "pending_request";
};

export default function CreditNoteDialog({
  creditNoteNumber: initialCreditNoteNumber,
  creditNote: initialCreditNote,
  onClose,
  onDetailsFetched,
  onRecordChanged,
  canManage = true,
}) {
  const { success: showSuccess } = useToast();

  const [loading, setLoading] = useState(false);
  const [detailsData, setDetailsData] = useState(null);
  const [showLogs, setShowLogs] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState({
    id: null,
    type: null,
  });

  const targetCreditNoteNumber =
    initialCreditNoteNumber ||
    initialCreditNote?.creditNoteNumber ||
    initialCreditNote?.credit_note_number;

  const activeCredit = detailsData || initialCreditNote || {};

  const [editForm, setEditForm] = useState({
    creditNoteNumber: targetCreditNoteNumber || "",
    creditNoteAmount: activeCredit.creditNoteAmount || "",
    creditNoteDate: activeCredit.creditNoteDate
      ? activeCredit.creditNoteDate.slice(0, 10)
      : "",
    remark: activeCredit.remark || "",
  });

  const fetchCreditDetails = async (isMounted = true) => {
    if (!targetCreditNoteNumber) return;
    try {
      setLoading(true);
      const response = await creditApi.creditDetails(targetCreditNoteNumber);
      const data = response.data?.data || response.data;
      setDetailsData(data);

      if (data) {
        setEditForm({
          creditNoteNumber: data.creditNoteNumber || targetCreditNoteNumber,
          creditNoteAmount: data.creditNoteAmount || "",
          creditNoteDate: data.creditNoteDate
            ? data.creditNoteDate.slice(0, 10)
            : "",
          remark: data.remark || "",
        });
      }

      if (isMounted && onDetailsFetched) {
        onDetailsFetched(data);
      }
    } catch (err) {
      if (isMounted) {
        showSuccess(
          err.response?.data?.message || "Failed to fetch credit note details.",
          "error"
        );
      }
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchCreditDetails(isMounted);
    return () => {
      isMounted = false;
    };
  }, [targetCreditNoteNumber]);

  if (!targetCreditNoteNumber) return null;

  const allocationsList = activeCredit.allocations || [];
  const pendingRequestsList = activeCredit.allocationRequest || [];
  const updateLogsList = activeCredit.updateLogs || [];
  const status = getCalculatedStatus(activeCredit);

  const handleApproveRequest = async (requestId, paymentId) => {
    if (!canManage) return;
    try {
      setActionLoadingId({ id: requestId, type: "approve" });

      if (!paymentId) {
        throw new Error("Payment reference ID is missing for this request.");
      }

      const response = await paymentApi.updatePaymentStatus(paymentId, {
        status: "Approved",
        remarks: "Approved via credit note allocation request",
      });

      const serverMsg =
        response.data?.message || "Allocation request approved successfully.";
      showSuccess(serverMsg, "success");

      if (onRecordChanged) onRecordChanged();
      await fetchCreditDetails();
    } catch (err) {
      const serverErr =
        err.response?.data?.message ||
        err.message ||
        "Failed to approve request.";
      showSuccess(serverErr, "error");
    } finally {
      setActionLoadingId({ id: null, type: null });
    }
  };

  const handleRejectRequest = async (requestId, paymentId) => {
    if (!canManage) return;
    try {
      setActionLoadingId({ id: requestId, type: "reject" });

      if (!paymentId) {
        throw new Error("Payment reference ID is missing for this request.");
      }

      const response = await paymentApi.updatePaymentStatus(paymentId, {
        status: "Rejected",
        remarks: "Rejected via credit note allocation request",
      });

      const serverMsg =
        response.data?.message || "Allocation request rejected successfully.";
      showSuccess(serverMsg, "success");

      if (onRecordChanged) onRecordChanged();
      await fetchCreditDetails();
    } catch (err) {
      const serverErr =
        err.response?.data?.message ||
        err.message ||
        "Failed to reject request.";
      showSuccess(serverErr, "error");
    } finally {
      setActionLoadingId({ id: null, type: null });
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    try {
      setLoading(true);

      const response = await creditApi.updateCredit(targetCreditNoteNumber, {
        newCreditNoteNumber:
          editForm.creditNoteNumber !== targetCreditNoteNumber
            ? editForm.creditNoteNumber
            : undefined,
        creditNoteAmount: Number(editForm.creditNoteAmount),
        creditNoteDate: editForm.creditNoteDate,
        remark: editForm.remark,
      });

      const serverMsg =
        response.data?.message || "Credit note updated successfully.";
      showSuccess(serverMsg, "success");

      setShowEditModal(false);
      if (onRecordChanged) onRecordChanged();
      await fetchCreditDetails();
    } catch (err) {
      const serverErr =
        err.response?.data?.message || "Failed to update credit note.";
      showSuccess(serverErr, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!canManage) return;
    try {
      setLoading(true);
      const response = await creditApi.deleteCredit(targetCreditNoteNumber);

      const serverMsg =
        response.data?.message || "Credit note deleted successfully.";
      showSuccess(serverMsg, "success");

      if (onRecordChanged) onRecordChanged();
      onClose();
    } catch (err) {
      const serverErr =
        err.response?.data?.message || "Failed to delete record.";
      showSuccess(serverErr, "error");
      setShowDeleteConfirm(false);
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
        className="w-[98vw] max-w-[1720px] h-[94vh] max-h-[94vh] bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col text-xs relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* DELETE CONFIRMATION OVERLAY */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3">
            <div className="max-w-md w-full bg-white border border-slate-200 p-5 rounded-lg shadow-xl space-y-3 text-center">
              <div className="text-3xl">⚠️</div>
              <h3 className="text-sm font-bold text-slate-900">
                Delete Credit Note #{targetCreditNoteNumber}?
              </h3>
              <p className="text-xs text-slate-500">
                This will permanently delete this credit note record along with
                its allocations and requests.
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

        {/* EDIT MODAL OVERLAY */}
        {showEditModal && (
         <div 
  className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5 bg-slate-900/80 font-sans"
  onClick={() => setShowEditModal(false)}
>
  <div 
    className="w-full max-w-xl bg-white border-2 border-slate-300 shadow-2xl  overflow-hidden flex flex-col text-xs relative animate-in fade-in zoom-in-95 duration-150"
    onClick={(e) => e.stopPropagation()}
  >
    {/* Modal Header */}
    <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-slate-200 bg-slate-50 shrink-0">
      <h2 className="text-base font-bold text-slate-900 tracking-tight">
        Edit Credit Note #{targetCreditNoteNumber}
      </h2>
      <button
        type="button"
        onClick={() => setShowEditModal(false)}
        disabled={loading}
        className="w-7 h-7 rounded-md bg-slate-200/70 hover:bg-slate-300 text-slate-700 hover:text-slate-900 transition-colors flex items-center justify-center text-xs shrink-0 font-bold border border-slate-300"
        title="Close"
      >
        ✕
      </button>
    </div>

    {/* Modal Form */}
    <form onSubmit={handleEditSubmit} className="p-5 space-y-4 bg-slate-100/60 text-left">
      {/* Form Content Card */}
      <div className="p-4 rounded-xl border-2 border-slate-300 bg-white space-y-4 shadow-sm">
        {/* Credit Note Number */}
        <div className="space-y-1">
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Credit Note Number <span className="text-rose-600">*</span>
          </label>
          <input
            type="text"
            value={editForm.creditNoteNumber}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                creditNoteNumber: e.target.value,
              })
            }
            required
            disabled={loading}
            className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-bold placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:bg-white transition font-mono shadow-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Amount */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Amount (₹) <span className="text-rose-600">*</span>
            </label>
            <input
              type="number"
              step="any"
              min="0.01"
              value={editForm.creditNoteAmount}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  creditNoteAmount: e.target.value,
                })
              }
              required
              disabled={loading}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-extrabold placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:bg-white transition shadow-sm"
            />
          </div>

          {/* Date */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Date
            </label>
            <input
              type="date"
              value={editForm.creditNoteDate}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  creditNoteDate: e.target.value,
                })
              }
              disabled={loading}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-bold outline-none focus:border-indigo-600 focus:bg-white transition shadow-sm"
            />
          </div>
        </div>

        {/* Remark */}
        <div className="space-y-1">
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Remark <span className="text-rose-600">*</span>
          </label>
          <textarea
            value={editForm.remark}
            required
            disabled={loading}
            onChange={(e) =>
              setEditForm({ ...editForm, remark: e.target.value })
            }
            rows={3}
            placeholder="Reason for changes..."
            className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-medium placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-indigo-600 focus:bg-white transition resize-none shadow-sm"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-slate-300">
        <button
          type="button"
          onClick={() => setShowEditModal(false)}
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
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  </div>
</div>
        )}

        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Credit Note: {targetCreditNoteNumber}
            </h2>
            <CreditStatusBadge status={status} />
            {loading && (
              <span className="text-xs text-indigo-600 animate-pulse font-semibold">
                Syncing...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canManage && <>
              <button
                onClick={() => setShowEditModal(true)}
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
            </>}
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
            Created By:{" "}
            <span className="text-slate-800 font-bold">
              {activeCredit.createdBy?.name || "System"}
            </span>
            {activeCredit.createdBy?.email && (
              <span className="text-slate-500 ml-1">
                ({activeCredit.createdBy.email})
              </span>
            )}
          </div>
          <div>
            Credit Note Date:{" "}
            <span className="text-slate-800 font-bold font-mono">
              {formatDateDMY(
                activeCredit.creditNoteDate || activeCredit.createdAt
              )}
            </span>
          </div>
        </div>

        {/* MAIN BODY AREA */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-slate-50/50">
          {/* UNIFIED OVERVIEW SUMMARY */}
          <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-4 shadow-sm">
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Credit Overview
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">
                    Total Amount
                  </div>
                  <div className="text-lg font-black text-indigo-600">
                    {formatCurrency(activeCredit.creditNoteAmount)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">
                    Allocated Amount
                  </div>
                  <div className="text-lg font-black text-emerald-600">
                    {formatCurrency(activeCredit.totalAllocatedAmount)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">
                    Pending Requests
                  </div>
                  <div className="text-lg font-black text-amber-600">
                    {formatCurrency(activeCredit.totalAllocationRequestAmount)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">
                    Unallocated Balance
                  </div>
                  <div
                    className={`text-lg font-black ${
                      Number(activeCredit.pendingAllocationAmount || 0) > 0
                        ? "text-slate-900"
                        : "text-slate-400"
                    }`}
                  >
                    {formatCurrency(activeCredit.pendingAllocationAmount)}
                  </div>
                </div>
              </div>
            </div>

            {activeCredit.remark && (
              <>
                <div className="border-t border-slate-200" />
                <div className="text-xs">
                  <span className="text-slate-500 font-semibold block mb-1">
                    Remark:
                  </span>
                  <span className="text-slate-800 leading-relaxed block bg-slate-50 p-2.5 rounded-md border border-slate-200">
                    {activeCredit.remark}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* ALLOCATIONS & REQUESTS SECTION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* APPROVED ALLOCATIONS COLUMN */}
            <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Approved Allocations ({allocationsList.length})
                </span>
                {allocationsList.length > 0 && (
                  <span className="text-xs text-emerald-600 font-bold">
                    Total: {formatCurrency(activeCredit.totalAllocatedAmount)}
                  </span>
                )}
              </div>

              {allocationsList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-md bg-slate-50 text-xs">
                  No approved allocations found.
                </div>
              ) : (
                <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
                  {allocationsList.map((item, index) => {
                    const payment = item.paymentId || {};
                    const paymentByName = resolveUserName(payment.paymentBy);
                    const approvedByName = resolveUserName(payment.approvedBy);

                    return (
                      <div
                        key={item._id || index}
                        className="p-3 rounded-md bg-slate-50 border border-slate-200 space-y-2 text-xs"
                      >
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-bold">
                              Allocated Amount
                            </span>
                            <span className="font-extrabold text-sm text-emerald-600">
                              {formatCurrency(
                                item.allocatedAmount || item.amount
                              )}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block uppercase font-bold">
                              Payment Date
                            </span>
                            <span className="text-slate-800 font-mono text-xs">
                              {formatDateDMY(
                                payment.paymentDate || item.createdAt
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-slate-700 bg-white p-2 rounded-md border border-slate-200">
                          <div>
                            <span className="text-[10px] text-slate-500 block">
                              Invoice
                            </span>
                            <strong className="font-mono text-slate-900 text-xs">
                              {payment.invoiceNumber || "—"}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">
                              GRN
                            </span>
                            <strong className="font-mono text-slate-700 text-xs">
                              {payment.grnNumber || "—"}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">
                              Supplier
                            </span>
                            <strong className="font-mono text-slate-700 text-xs truncate block">
                              {payment.supplierName || "—"}
                            </strong>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px] text-slate-500 pt-0.5">
                          <div>
                            Paid Amount:{" "}
                            <span className="font-semibold text-slate-800 font-mono">
                              {formatCurrency(payment.paidAmount)}
                            </span>
                          </div>
                          {paymentByName && (
                            <div className="text-right">
                              Payment By:{" "}
                              <span className="text-slate-800 font-medium">
                                {paymentByName}
                              </span>
                            </div>
                          )}
                          {payment.paymentMethod && (
                            <div>
                              Method:{" "}
                              <span className="text-slate-800 font-medium">
                                {payment.paymentMethod}
                              </span>
                            </div>
                          )}
                          {payment.transactionNumber && (
                            <div className="text-right truncate">
                              Txn:{" "}
                              <span className="font-mono text-slate-800">
                                {payment.transactionNumber}
                              </span>
                            </div>
                          )}
                          {approvedByName && (
                            <div className="col-span-2 text-slate-500 text-[10px] pt-1 border-t border-slate-200">
                              Approved By: {approvedByName}{" "}
                              {payment.approvedAt &&
                                `on ${formatDateDMY(payment.approvedAt)}`}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* PENDING ALLOCATION REQUESTS COLUMN */}
            <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Pending Requests ({pendingRequestsList.length})
                </span>
                {pendingRequestsList.length > 0 && (
                  <span className="text-xs text-amber-600 font-bold">
                    Total:{" "}
                    {formatCurrency(activeCredit.totalAllocationRequestAmount)}
                  </span>
                )}
              </div>

              {pendingRequestsList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-md bg-slate-50 text-xs">
                  No pending allocation requests.
                </div>
              ) : (
                <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
                  {pendingRequestsList.map((item, index) => {
                    const payment = item.paymentId || {};
                    const requestId = item._id;
                    const paymentId = payment._id;
                    const paymentByName = resolveUserName(payment.paymentBy);
                    const isApproving =
                      actionLoadingId.id === requestId &&
                      actionLoadingId.type === "approve";
                    const isRejecting =
                      actionLoadingId.id === requestId &&
                      actionLoadingId.type === "reject";

                    return (
                      <div
                        key={requestId || index}
                        className="p-3 rounded-md bg-slate-50 border border-slate-200 space-y-2 text-xs"
                      >
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-bold">
                              Requested Amount
                            </span>
                            <span className="font-extrabold text-sm text-amber-600">
                              {formatCurrency(
                                payment.requestAmount || item.requestAmount
                              )}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block uppercase font-bold">
                              Payment Date
                            </span>
                            <span className="text-slate-800 font-mono text-xs">
                              {formatDateDMY(
                                payment.paymentDate || item.createdAt
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-slate-700 bg-white p-2 rounded-md border border-slate-200">
                          <div>
                            <span className="text-[10px] text-slate-500 block">
                              Invoice
                            </span>
                            <strong className="font-mono text-slate-900 text-xs">
                              {payment.invoiceNumber || "—"}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">
                              GRN
                            </span>
                            <strong className="font-mono text-slate-700 text-xs">
                              {payment.grnNumber || "—"}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">
                              Supplier
                            </span>
                            <strong className="font-mono text-slate-700 text-xs truncate block">
                              {payment.supplierName || "—"}
                            </strong>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px] text-slate-500">
                          <div>
                            Paid Amount:{" "}
                            <span className="font-semibold text-slate-800 font-mono">
                              {formatCurrency(payment.paidAmount)}
                            </span>
                          </div>
                          {paymentByName && (
                            <div className="text-right">
                              Payment By:{" "}
                              <span className="text-slate-800 font-medium">
                                {paymentByName}
                              </span>
                            </div>
                          )}
                          {payment.paymentMethod && (
                            <div>
                              Method:{" "}
                              <span className="text-slate-800 font-medium">
                                {payment.paymentMethod}
                              </span>
                            </div>
                          )}
                          {payment.transactionNumber && (
                            <div className="text-right truncate">
                              Txn:{" "}
                              <span className="font-mono text-slate-800">
                                {payment.transactionNumber}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* APPROVE & REJECT ACTION BUTTONS */}
                        {canManage && <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                          <button
                            onClick={() =>
                              handleApproveRequest(requestId, paymentId)
                            }
                            disabled={!!actionLoadingId.id}
                            className="flex-1 py-1.5 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 text-xs font-semibold shadow-sm transition-colors disabled:opacity-40"
                          >
                            {isApproving ? "Approving..." : "Approve"}
                          </button>
                          <button
                            onClick={() =>
                              handleRejectRequest(requestId, paymentId)
                            }
                            disabled={!!actionLoadingId.id}
                            className="flex-1 py-1.5 px-3 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors disabled:opacity-40"
                          >
                            {isRejecting ? "Rejecting..." : "Reject"}
                          </button>
                        </div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* UPDATE LOGS / AUDIT SECTION */}
          {updateLogsList.length > 0 && (
            <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors"
              >
                <span>
                  {showLogs ? "▼" : "►"} Audit Log / History (
                  {updateLogsList.length})
                </span>
              </button>

              {showLogs && (
                <div className="mt-2 space-y-1.5 max-h-[18vh] overflow-y-auto pr-1 border-t border-slate-200 pt-2">
                  {updateLogsList.map((log, i) => (
                    <div
                      key={log._id || i}
                      className="text-xs bg-slate-50 p-2 rounded-md border border-slate-200 flex justify-between text-slate-500"
                    >
                      <div>
                        <span className="text-slate-800 font-semibold">
                          {resolveUserName(log.updatedBy) || "System"}
                        </span>
                        {log.note && (
                          <span className="ml-2 text-slate-600">
                            - {log.note}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-slate-500">
                        {formatDateDMY(log.updatedAt || log.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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