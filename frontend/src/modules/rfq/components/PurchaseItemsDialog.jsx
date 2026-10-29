import { Plus, Trash2 } from "lucide-react";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { Alert, GhostButton, Modal, PrimaryButton } from "../../../components/ui";
import { FormField, TextInput } from "./FormControls";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { rfqApiBase } from "./rfqConfig";
import { useRows } from "../hooks/useRows";
import { stageLabel } from "./rfqConfig";

const blankItem = () => ({ item_name: "", quantity: 1, remarks: "" });

/** Optional purchase items for a Capex / Tooling stage. Saving with no items is valid. */
export default function PurchaseItemsDialog({ rfq, rfqId, stage, items, onClose, onSaved }) {
  const initialRows = items.length ? items.map(({ item_name, quantity, remarks }) => ({ item_name, quantity, remarks })) : [blankItem()];
  const { rows, update, add, remove } = useRows(blankItem, initialRows);
  const { run, busy, error } = useAsyncAction();

  const save = () => run(async () => {
    await api.put(`${rfq?.parent_rfq ? rfqApiBase(rfq) : `${ENDPOINTS.RFQ.BASE}/${rfqId || rfq?._id}`}/purchase-items`, { stage, items: rows });
    await onSaved();
    onClose();
  });

  return <Modal open onClose={onClose} title="Purchase Items" subtitle={`${stageLabel(stage)} · optional`}>
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      {rows.map((row, index) => <div key={index} className="grid grid-cols-[1fr_84px_28px] items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
        <FormField label="Item"><TextInput value={row.item_name} onChange={(e) => update(index, { item_name: e.target.value })} /></FormField>
        <FormField label="Qty"><TextInput type="number" min="1" value={row.quantity} onChange={(e) => update(index, { quantity: e.target.value })} /></FormField>
        <button type="button" onClick={() => remove(index)} aria-label="Remove item" className="mb-2 text-slate-600 hover:text-rose-600"><Trash2 size={15} /></button>
        <div className="col-span-3"><FormField label="Remarks"><TextInput value={row.remarks} onChange={(e) => update(index, { remarks: e.target.value })} /></FormField></div>
      </div>)}
      <button type="button" onClick={add} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600"><Plus size={13} /> Add item</button>
      <div className="flex justify-end gap-2">
        <GhostButton type="button" onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton disabled={busy} onClick={save}>{busy ? "Saving..." : "Save Items"}</PrimaryButton>
      </div>
    </div>
  </Modal>;
}
