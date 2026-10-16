import { useState } from "react";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { Alert, GhostButton, Modal, PrimaryButton } from "../../../components/ui";
import { FormField, TextInput } from "./FormControls";
import AttachmentField from "./AttachmentField";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { STAGES, attachmentLabel, stageLabel } from "./rfqConfig";

const dateInput = (value) => (value ? String(value).slice(0, 10) : "");

/** Corrects a submitted stage (NPD Manager / Admin / Super User): its dates, attachments, and the quoted value or PO details of the stages that have them. */
export default function EditStageDialog({ stage, rfq, entry, onClose, onSaved }) {
  const hasTarget = STAGES.find(([key]) => key === stage)?.[2]; // customer-driven stages have no target date
  const [targetDate, setTargetDate] = useState(dateInput(entry?.target_date));
  const [submitDate, setSubmitDate] = useState(dateInput(entry?.completed_date));
  const [files, setFiles] = useState(rfq.stage_attachments?.[stage] || []);
  const [price, setPrice] = useState(rfq.costing?.quoted_price ?? "");
  const [poNumber, setPoNumber] = useState(rfq.purchase_order?.po_number ?? "");
  const [poQty, setPoQty] = useState(rfq.purchase_order?.po_qty ?? "");
  const { run, busy, error } = useAsyncAction();

  const save = async () => {
    const saved = await run(async () => {
      const payload = { completed_date: submitDate, attachments: files };
      if (hasTarget && targetDate) payload.target_date = targetDate;
      if (stage === "COSTING") payload.quoted_price = Number(price);
      if (stage === "CUSTOMER_PO_RECEIVED") Object.assign(payload, { po_number: poNumber, po_qty: Number(poQty) });
      await api.put(`${ENDPOINTS.RFQ.BASE}/${rfq._id}/stages/${stage}`, payload);
    });
    if (saved) await onSaved();
  };

  return <Modal open onClose={onClose} title={`Edit — ${stageLabel(stage)}`} subtitle={`${rfq.rfq_number} · ${rfq.project_name}`} size="lg">
    <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        {hasTarget && <FormField label="Target Date"><TextInput type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></FormField>}
        <FormField label="Submit Date"><TextInput type="date" required value={submitDate} onChange={(e) => setSubmitDate(e.target.value)} /></FormField>
        {stage === "COSTING" && <FormField label="Quoted Value"><TextInput type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></FormField>}
        {stage === "CUSTOMER_PO_RECEIVED" && <>
          <FormField label="PO Number"><TextInput value={poNumber} onChange={(e) => setPoNumber(e.target.value)} /></FormField>
          <FormField label="PO Quantity"><TextInput type="number" min="1" value={poQty} onChange={(e) => setPoQty(e.target.value)} /></FormField>
        </>}
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold text-slate-600">{attachmentLabel(stage)}</div>
        <AttachmentField items={files} onChange={setFiles} />
      </div>
      <div className="flex justify-end gap-2">
        <GhostButton type="button" onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton type="button" disabled={busy || !submitDate} onClick={save}>{busy ? "Saving..." : "Save changes"}</PrimaryButton>
      </div>
    </div>
  </Modal>;
}
