import { useState } from "react";
import { Trash2 } from "lucide-react";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { Alert, GhostButton, Modal, PrimaryButton } from "../../../components/ui";
import { FormField, TextInput } from "./FormControls";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { BOM_STAGE } from "./rfqConfig";

const blankComponent = () => ({ component_name: "", component_description: "", per_unit_qty: 1, total_qty: "" });

/** Add / remove final BOM lines while "Define Actual BOM" is open. Total defaults to per-unit × PO quantity. */
export default function BomDialog({ rfq, components, onClose, onChanged }) {
  const [form, setForm] = useState(blankComponent);
  const { run, busy, error } = useAsyncAction();
  const bomLines = components.filter((component) => component.bom_stage === BOM_STAGE);
  const poQty = Number(rfq.purchase_order?.po_qty) || 1;
  const setField = (patch) => setForm((current) => ({ ...current, ...patch }));

  const addLine = () => run(async () => {
    const perUnit = Number(form.per_unit_qty);
    if (!form.component_name.trim()) throw new Error("Component name is required.");
    if (!(perUnit >= 1)) throw new Error("Per-unit quantity must be at least 1.");
    await api.post(ENDPOINTS.RFQ.COMPONENTS, {
      ...(rfq.parent_rfq ? { workflow_instance: rfq._id } : { rfq_item: rfq._id }), bom_stage: BOM_STAGE, component_name: form.component_name.trim(), component_description: form.component_description,
      per_unit_qty: perUnit, total_qty: Number(form.total_qty) || perUnit * poQty,
    });
    setForm(blankComponent());
    await onChanged();
  });
  const removeLine = (id) => run(async () => { await api.delete(`${ENDPOINTS.RFQ.COMPONENTS}/${id}`); await onChanged(); });

  return <Modal open onClose={onClose} title="Actual BOM" subtitle={`${rfq.rfq_number} · PO quantity ${poQty}`} size="xl">
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1.2fr_1.2fr_100px_120px_auto] md:items-end">
        <FormField label="Component"><TextInput value={form.component_name} onChange={(e) => setField({ component_name: e.target.value })} /></FormField>
        <FormField label="Description"><TextInput value={form.component_description} onChange={(e) => setField({ component_description: e.target.value })} /></FormField>
        <FormField label="Per Unit"><TextInput type="number" min="1" value={form.per_unit_qty} onChange={(e) => setField({ per_unit_qty: e.target.value })} /></FormField>
        <FormField label="Total Qty"><TextInput type="number" min="1" placeholder={String((Number(form.per_unit_qty) || 1) * poQty)} value={form.total_qty} onChange={(e) => setField({ total_qty: e.target.value })} /></FormField>
        <div className="mb-2"><PrimaryButton disabled={busy} onClick={addLine}>Add</PrimaryButton></div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600"><tr><th className="px-3 py-2">Component</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Per Unit</th><th className="px-3 py-2 text-right">Total</th><th className="w-10" /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {bomLines.map((line) => <tr key={line._id}>
              <td className="px-3 py-2 font-semibold text-slate-900">{line.component_name}</td>
              <td className="px-3 py-2 text-slate-600">{line.component_description || "—"}</td>
              <td className="px-3 py-2 text-right">{line.per_unit_qty}</td>
              <td className="px-3 py-2 text-right">{line.total_qty}</td>
              <td className="px-2"><button type="button" onClick={() => removeLine(line._id)} aria-label="Remove component" className="text-slate-600 hover:text-rose-600"><Trash2 size={14} /></button></td>
            </tr>)}
            {!bomLines.length && <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-600">No BOM components yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end"><GhostButton type="button" onClick={onClose}>Done</GhostButton></div>
    </div>
  </Modal>;
}
