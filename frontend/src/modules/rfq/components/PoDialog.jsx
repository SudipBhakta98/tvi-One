import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert, GhostButton, Modal, PrimaryButton } from "../../../components/ui";
import { FormField, TextInput } from "./FormControls";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useRows } from "../hooks/useRows";

const blankDelivery = () => ({ date: "", quantity: "" });

/** Customer PO details: PO number, total quantity and any number of delivery schedules (date + quantity). */
export default function PoDialog({ onClose, onConfirm }) {
  const [poNumber, setPoNumber] = useState("");
  const [poQty, setPoQty] = useState("");
  const { rows, update, add, remove } = useRows(blankDelivery, [blankDelivery()]);
  const { run, busy, error } = useAsyncAction();

  const scheduledQty = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const remainingQty = Number(poQty || 0) - scheduledQty;

  const confirm = () => run(async () => {
    if (!poNumber.trim()) throw new Error("PO number is required.");
    if (!(Number(poQty) > 0)) throw new Error("PO quantity must be greater than zero.");
    if (rows.some((row) => !row.date || !(Number(row.quantity) > 0))) throw new Error("Every delivery schedule needs a date and a quantity.");
    if (remainingQty < 0) throw new Error(`Scheduled quantity (${scheduledQty}) exceeds the PO quantity (${poQty}).`);
    await onConfirm({
      po_number: poNumber.trim(),
      po_qty: Number(poQty),
      delivery_schedule: rows.map((row) => ({ date: row.date, quantity: Number(row.quantity) })),
    });
  });

  return <Modal open onClose={onClose} title="Customer PO Details" subtitle="Record the PO number, quantity and the customer's delivery schedules.">
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="PO Number"><TextInput required value={poNumber} onChange={(e) => setPoNumber(e.target.value)} /></FormField>
        <FormField label="PO Quantity"><TextInput type="number" min="1" required value={poQty} onChange={(e) => setPoQty(e.target.value)} /></FormField>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase text-slate-600">Delivery Schedules</h4>
          <span className={`text-xs font-semibold ${remainingQty < 0 ? "text-rose-600" : "text-slate-600"}`}>Scheduled {scheduledQty} · Remaining {remainingQty}</span>
        </div>
        {rows.map((row, index) => <div key={index} className="grid grid-cols-[1fr_1fr_28px] items-end gap-2">
          <FormField label="Delivery Date"><TextInput type="date" value={row.date} onChange={(e) => update(index, { date: e.target.value })} /></FormField>
          <FormField label="Quantity"><TextInput type="number" min="1" value={row.quantity} onChange={(e) => update(index, { quantity: e.target.value })} /></FormField>
          <button type="button" disabled={rows.length === 1} onClick={() => remove(index)} aria-label="Remove schedule" className="mb-2 text-slate-600 hover:text-rose-600 disabled:opacity-30"><Trash2 size={15} /></button>
        </div>)}
        <button type="button" onClick={add} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600"><Plus size={13} /> Add schedule</button>
      </div>

      <div className="flex justify-end gap-2">
        <GhostButton type="button" onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton disabled={busy} onClick={confirm}>{busy ? "Submitting..." : "Submit PO"}</PrimaryButton>
      </div>
    </div>
  </Modal>;
}
