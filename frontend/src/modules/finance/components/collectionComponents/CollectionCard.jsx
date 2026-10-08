import React, { useState } from "react";
import { collectionApi } from "../../api.js";
import { CollectionStatusBadge } from "../receivableComponents/ReceivableBadges.jsx";
import { formatCurrency, formatDisplayDate, decimalOnly } from "../../utils/financeFormat.js";

const INPUT_CLASS =
  "w-full bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-900 font-mono font-semibold outline-none focus:border-indigo-600";


const toDateInput = (raw) => new Date(raw).toISOString().split("T")[0];

/** One collection on an invoice. Not-yet-approved collections can be edited or deleted. */
export default function CollectionCard({ collection, invoice, totalPendingAmount, onRefresh }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [form, setForm] = useState({ receivedAmount: "", tdsAmount: "", collectionDate: "", remark: "" });

  const received = Number(collection.receivedAmount || 0);
  const tds = Number(collection.tdsAmount || 0);
  const isApproved = collection.status === "Approved";

  // This collection's own pending amount must not count against its own edit.
  const ownPendingAmount = collection.status === "Pending" ? received + tds : 0;
  const maxAllowedCollection = Math.max(0, Number(invoice?.outstanding || 0) - (Number(totalPendingAmount || 0) - ownPendingAmount));
  const editedSettled = (Number(form.receivedAmount) || 0) + (Number(form.tdsAmount) || 0);

  const startEdit = () => {
    setFeedback(null);
    setForm({
      receivedAmount: String(received),
      tdsAmount: String(tds),
      collectionDate: toDateInput(collection.collectionDate),
      remark: "",
    });
    setIsEditing(true);
  };

  const setAmount = (name) => (e) => setForm((prev) => ({ ...prev, [name]: decimalOnly(e.target.value) }));

  const run = async (action, failureMessage) => {
    setSaving(true);
    setFeedback(null);
    try {
      await action();
      setIsEditing(false);
      onRefresh?.();
    } catch (err) {
      setFeedback(err.response?.data?.message || failureMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!form.remark.trim()) return setFeedback("Remark is required for updating this collection.");
    if (!(Number(form.receivedAmount) > 0)) return setFeedback("Received amount must be greater than 0.");
    if (editedSettled > maxAllowedCollection) {
      return setFeedback(`Received + TDS (₹${editedSettled}) cannot be more than the maximum allowed (₹${maxAllowedCollection}).`);
    }

    run(
      () =>
        collectionApi.updateCollection(collection._id, {
          receivedAmount: Number(form.receivedAmount),
          tdsAmount: Number(form.tdsAmount) || 0,
          collectionDate: form.collectionDate,
          remark: form.remark.trim(),
        }),
      "Failed to update the collection.",
    );
  };

  const handleDelete = () => {
    if (!window.confirm("Delete this collection?")) return;
    run(() => collectionApi.deleteCollection(collection._id), "Failed to delete the collection.");
  };

  return (
    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-slate-900">{formatCurrency(received)}</span>
          <CollectionStatusBadge status={collection.status} />
        </div>
        <span className="text-[10px] text-slate-400 font-mono">{formatDisplayDate(collection.collectionDate)}</span>
      </div>

      <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-4 gap-y-0.5">
        <span>
          TDS: <strong className="text-amber-600 font-mono">{formatCurrency(tds)}</strong>
        </span>
        <span>
          Settled: <strong className="text-slate-700 font-mono">{formatCurrency(received + tds)}</strong>
        </span>
        <span>
          By: <strong className="text-slate-700">{collection.collectionBy?.name || "—"}</strong>
        </span>
        {collection.approvedBy && (
          <span>
            {collection.status === "Rejected" ? "Rejected" : "Approved"} by:{" "}
            <strong className="text-slate-700">{collection.approvedBy.name}</strong>
          </span>
        )}
      </div>

      {feedback && <div className="text-[11px] font-bold text-rose-600">{feedback}</div>}

      {isEditing ? (
        <div className="space-y-2 pt-1 border-t border-slate-200">
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Received (₹)</span>
              <input type="text" inputMode="decimal" value={form.receivedAmount} onChange={setAmount("receivedAmount")} className={INPUT_CLASS} />
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase">TDS (₹)</span>
              <input type="text" inputMode="decimal" value={form.tdsAmount} onChange={setAmount("tdsAmount")} className={INPUT_CLASS} />
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Date</span>
              <input
                type="date"
                value={form.collectionDate}
                onChange={(e) => setForm((prev) => ({ ...prev, collectionDate: e.target.value }))}
                className={INPUT_CLASS}
              />
            </label>
          </div>
          <textarea
            rows={2}
            value={form.remark}
            onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
            placeholder="Reason for this update (required)..."
            className="w-full bg-white border border-amber-300 rounded-md px-2 py-1 text-xs outline-none focus:border-amber-500 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsEditing(false)} disabled={saving} className="px-3 py-1 rounded-md bg-white border border-slate-300 text-slate-700 font-semibold text-[11px]">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] disabled:opacity-50">
              {saving ? "Saving..." : "Save & Resubmit"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          {isApproved ? (
            <span className="text-[10px] text-slate-400 italic">Approved entries cannot be edited</span>
          ) : (
            <>
              <button type="button" onClick={startEdit} disabled={saving} className="px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-[11px]">
                Edit
              </button>
              <button type="button" onClick={handleDelete} disabled={saving} className="px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-[11px]">
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
