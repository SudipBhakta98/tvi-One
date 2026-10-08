import React from "react";
import { Wallet } from "lucide-react";

const inr = (v) => "₹" + (Number(v) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

/**
 * Shows the supplier's available advance and lets the user choose how much of
 * each advance to use for this payment. NOTHING is applied automatically: the
 * user must tick "Use advance" first.
 *
 * Props
 *  - supplierName
 *  - advances        [{ advanceId, advanceNumber, availableAmount }]
 *  - waitingApproval { count, amount }   advances not approved yet (cannot be used)
 *  - enabled / onToggle(enabled)
 *  - amounts         { [advanceId]: "500" }
 *  - onAmountsChange(next)
 *  - paidAmount      total payment amount typed by the user
 *  - locked          hide the toggle; the advance is always used
 */
export default function AdvanceUsagePanel({
  supplierName,
  advances = [],
  waitingApproval,
  enabled,
  onToggle,
  amounts,
  onAmountsChange,
  paidAmount,
  disabled,
  locked = false, // "Pay with Advance" mode: advance is always used, no toggle
}) {
  const totalAvailable = advances.reduce((s, a) => s + Number(a.availableAmount || 0), 0);
  const hasWaiting = (waitingApproval?.count || 0) > 0;

  if (totalAvailable <= 0 && !hasWaiting) return null;

  const used = advances.reduce((s, a) => s + (Number(amounts?.[a.advanceId]) || 0), 0);
  const paid = Number(paidAmount) || 0;

  // Suggest: fill advances oldest-first, up to the payment amount.
  const autoFill = () => {
    let left = paid;
    const next = {};
    advances.forEach((a) => {
      const take = Math.min(left, Number(a.availableAmount));
      next[a.advanceId] = take > 0 ? String(take) : "";
      left -= take;
    });
    onAmountsChange(next);
  };

  const handleToggle = (checked) => {
    onToggle(checked);
    if (checked) autoFill();
    else onAmountsChange({});
  };

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 space-y-2.5 shadow-sm">
      <div className="flex items-start gap-2">
        <Wallet size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          {totalAvailable > 0 ? (
            <>
              <p className="text-xs font-extrabold text-amber-900">
                {supplierName} has {inr(totalAvailable)} advance available
              </p>
              {!locked && (
                <p className="text-[11px] font-semibold text-amber-800">
                  It is not applied automatically. Tick the box below if you want to settle
                  this payment from the advance.
                </p>
              )}
            </>
          ) : (
            <p className="text-xs font-extrabold text-amber-900">
              No approved advance available for {supplierName}
            </p>
          )}
          {hasWaiting && (
            <p className="text-[11px] font-semibold text-amber-700 mt-0.5">
              {inr(waitingApproval.amount)} more ({waitingApproval.count} advance
              {waitingApproval.count > 1 ? "s" : ""}) is waiting for approval and cannot be used yet.
            </p>
          )}
        </div>
      </div>

      {totalAvailable > 0 && (
        <>
          {!locked && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!enabled}
              disabled={disabled}
              onChange={(e) => handleToggle(e.target.checked)}
              className="h-4 w-4 accent-indigo-600"
            />
            <span className="text-xs font-bold text-slate-800">Use advance for this payment</span>
          </label>
          )}

          {enabled && (
            <div className="space-y-2 pt-1">
              {advances.map((a) => {
                const val = amounts?.[a.advanceId] ?? "";
                const over = Number(val) > Number(a.availableAmount) + 0.001;
                return (
                  <div key={a.advanceId} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-mono font-bold text-slate-800 truncate">{a.advanceNumber}</div>
                      <div className="text-[10px] font-semibold text-slate-500">Available {inr(a.availableAmount)}</div>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={disabled}
                      value={val}
                      placeholder="0.00"
                      onChange={(e) =>
                        onAmountsChange({
                          ...amounts,
                          [a.advanceId]: e.target.value
                            .replace(/[^0-9.]/g, "")
                            .replace(/(\..*)\./g, "$1")
                            .replace(/^(\d+)\.(\d{0,2}).*$/, "$1.$2"),
                        })
                      }
                      className={`w-28 bg-white border-2 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold outline-none ${
                        over ? "border-rose-500 text-rose-700" : "border-slate-300 focus:border-indigo-600"
                      }`}
                    />
                  </div>
                );
              })}
              <div className="flex justify-between text-[11px] font-bold border-t border-amber-200 pt-1.5">
                <span className="text-slate-600">Settled from advance</span>
                <span className="font-mono text-indigo-700">{inr(used)}</span>
              </div>
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-slate-600">{locked ? "Remaining to cover" : "Remaining (Credit Note)"}</span>
                <span className="font-mono text-slate-800">{inr(Math.max(0, paid - used))}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Convert the { advanceId: "amount" } map into the API payload. */
export const buildAdvancePayload = (enabled, amounts) =>
  enabled
    ? Object.entries(amounts || {})
        .map(([advanceId, amount]) => ({ advanceId, amount: Number(amount) || 0 }))
        .filter((a) => a.amount > 0)
    : [];

/** Validation shared by the add + edit payment forms. Returns an error string or "". */
export const validateAdvanceUsage = ({ enabled, amounts, advances, paidAmount }) => {
  if (!enabled) return "";
  const paid = Number(paidAmount) || 0;
  let total = 0;
  for (const a of advances) {
    const v = Number(amounts?.[a.advanceId]) || 0;
    if (v > Number(a.availableAmount) + 0.001) {
      return `Only ${inr(a.availableAmount)} is available in ${a.advanceNumber}.`;
    }
    total += v;
  }
  if (total > paid + 0.001) {
    return `Advance used (${inr(total)}) cannot be more than the payment amount (${inr(paid)}).`;
  }
  return "";
};
