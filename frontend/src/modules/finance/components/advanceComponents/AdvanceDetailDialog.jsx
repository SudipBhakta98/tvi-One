import React, { useEffect, useState } from "react";
import { X, AlertCircle, CheckCircle2 } from "lucide-react";
import { supplierAdvanceApi } from "../../api.js";

const inr = (v) => "₹" + (Number(v) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const fmtDate = (raw) => {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

export const advanceStatusStyle = {
  Pending: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Partially Adjusted": "bg-amber-50 text-amber-700 border-amber-200",
  "Fully Adjusted": "bg-slate-100 text-slate-600 border-slate-300",
  Cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

export function AdvanceStatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${advanceStatusStyle[status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {status === "Pending" ? "Awaiting Approval" : status}
    </span>
  );
}

const Stat = ({ label, value, tone = "text-slate-900" }) => (
  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">{label}</div>
    <div className={`text-lg font-black ${tone}`}>{value}</div>
  </div>
);

export default function AdvanceDetailDialog({ advanceId, onClose, onChanged }) {
  const [adv, setAdv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const res = await supplierAdvanceApi.details(advanceId);
      setAdv(res.data?.data || null);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load advance details.");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [advanceId]);

  const act = async (status) => {
    const verb = status === "Approved" ? "approve" : "cancel";
    if (!window.confirm(`Are you sure you want to ${verb} this advance payment?`)) return;
    try {
      setActing(true);
      setError("");
      await supplierAdvanceApi.updateStatus(advanceId, status);
      setOk(`Advance ${status === "Approved" ? "approved" : "cancelled"} successfully.`);
      onChanged?.();
      await load();
    } catch (e) {
      setError(e.response?.data?.message || `Failed to ${verb} advance.`);
    } finally {
      setActing(false);
    }
  };

  const reserved = Number(adv?.totalAllocationRequestAmount || 0);
  const available = Math.max(0, Number(adv?.pendingAdjustmentAmount || 0) - reserved);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5 bg-slate-900/80 font-sans" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[92vh] bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col text-xs" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Advance: {adv?.advanceNumber || "…"}</h2>
            {adv && <AdvanceStatusBadge status={adv.status} />}
          </div>
          <div className="flex items-center gap-2">
            {adv?.status === "Pending" && (
              <>
                <button disabled={acting} onClick={() => act("Approved")} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold disabled:opacity-50">Approve</button>
                <button disabled={acting} onClick={() => act("Cancelled")} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-xs font-semibold disabled:opacity-50">Cancel Advance</button>
              </>
            )}
            <button onClick={onClose} title="Close" className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"><X size={16} /></button>
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto bg-slate-50/50">
          {error && <div className="p-3 rounded-md border border-rose-200 bg-rose-50 text-rose-700 font-semibold flex gap-2"><AlertCircle size={14} className="mt-0.5" />{error}</div>}
          {ok && <div className="p-3 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold flex gap-2"><CheckCircle2 size={14} className="mt-0.5" />{ok}</div>}
          {loading && !adv && <div className="text-center py-8 text-slate-400">Loading…</div>}

          {adv && (
            <>
              <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-500">
                  <div>Supplier: <span className="text-slate-900 font-bold">{adv.supplierName}</span></div>
                  <div>Date: <span className="text-slate-900 font-bold font-mono">{fmtDate(adv.paymentId?.paymentDate || adv.createdAt)}</span></div>
                  <div>Method: <span className="text-slate-900 font-bold">{adv.paymentId?.paymentMethod || "—"}{adv.paymentId?.transactionNumber ? ` · ${adv.paymentId.transactionNumber}` : ""}</span></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label="Advance Paid" value={inr(adv.advanceAmount)} tone="text-indigo-600" />
                  <Stat label="Settled" value={inr(adv.totalAdjustedAmount)} tone="text-slate-700" />
                  <Stat label="Reserved (Pending)" value={inr(reserved)} tone="text-amber-600" />
                  <Stat label="Available" value={inr(available)} tone={available > 0 ? "text-emerald-600" : "text-slate-400"} />
                </div>
                {adv.status === "Pending" && (
                  <p className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2">
                    This advance must be approved before it can be used against supplier invoices.
                  </p>
                )}
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 pb-2 border-b border-slate-100">
                  Settlements ({adv.adjustments?.length || 0})
                </div>
                {!adv.adjustments?.length ? (
                  <div className="text-center py-6 text-slate-400 border border-dashed border-slate-200 rounded-md bg-slate-50">Not used against any invoice yet.</div>
                ) : (
                  <table className="w-full text-left">
                    <thead><tr className="text-[10px] uppercase text-slate-500"><th className="py-1">Invoice</th><th>Date</th><th>By</th><th className="text-right">Amount</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {adv.adjustments.map((a, i) => (
                        <tr key={a._id || i}>
                          <td className="py-1.5 font-mono font-bold">{a.invoiceNumber || "—"}</td>
                          <td>{fmtDate(a.adjustedAt)}</td>
                          <td>{a.adjustedBy?.name || "—"}</td>
                          <td className="text-right font-bold text-slate-900">{inr(a.adjustedAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {adv.allocationRequest?.length > 0 && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-2">Reserved by payments awaiting approval</div>
                  {adv.allocationRequest.map((r, i) => (
                    <div key={r._id || i} className="flex justify-between py-1 border-b border-amber-100 last:border-0">
                      <span className="font-mono font-bold">{r.invoiceNumber || "—"}</span>
                      <span className="font-bold">{inr(r.requestAmount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {adv.updateLogs?.length > 0 && (
                <details className="p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
                  <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-700">Activity log ({adv.updateLogs.length})</summary>
                  <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                    {[...adv.updateLogs].reverse().map((l, i) => (
                      <div key={l._id || i} className="flex gap-2"><span className="font-mono text-slate-400 shrink-0">{fmtDate(l.updatedAt)}</span><span>{l.remark}{l.updatedBy?.name ? ` — ${l.updatedBy.name}` : ""}</span></div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
