import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { Alert, GhostButton, Panel, PrimaryButton } from "../../../components/ui";
import { FormField, TextInput, TextAreaInput } from "../components/FormControls";
import RfqFullPage from "../components/RfqFullPage";
import AttachmentField from "../components/AttachmentField";
import ProjectOwnerSelect from "../components/ProjectOwnerSelect";
import { blankMain, blankSub, errorMessage } from "../components/rfqConfig";

const todayInput = () => new Date().toISOString().slice(0, 10);

const toFormPart = (part) => ({ ...blankMain(), ...part, drawing_attachments: part.drawing_attachments || [], sub_parts: (part.sub_parts || []).map((sub) => ({ ...blankSub(), ...sub, drawing_attachments: sub.drawing_attachments || [] })) });
const toFormDetails = (rfq) => ({
  customer: rfq.customer,
  project_owner: rfq.project_owner?._id || rfq.project_owner || "",
  project_name: rfq.project_name,
  rfq_dated: String(rfq.rfq_dated).slice(0, 10),
  description: rfq.description,
  rfq_send_by_name: rfq.rfq_send_by_name || "",
  rfq_send_by_contact_number: rfq.rfq_send_by_contact_number || "",
  rfq_send_by_email: rfq.rfq_send_by_email || "",
});

/** Creates a new RFQ, or — when `rfq` is passed — edits that RFQ's details and part structure (NPD Manager / Admin / Super User). */
export default function RfqCreatePage({ rfq, onClose, onCreated, onSaved }) {
  const isEdit = Boolean(rfq);
  const [form, setForm] = useState(() => (isEdit ? toFormDetails(rfq) : { customer: "", project_owner: "", project_name: "", rfq_dated: todayInput(), description: "", rfq_send_by_name: "", rfq_send_by_contact_number: "", rfq_send_by_email: "" }));
  const [mainParts, setMainParts] = useState(() => (rfq?.main_parts?.length ? rfq.main_parts.map(toFormPart) : [blankMain()]));
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const setField = (patch) => setForm((current) => ({ ...current, ...patch }));
  const updateMain = (mainIndex, patch) => setMainParts((parts) => parts.map((part, i) => (i === mainIndex ? { ...part, ...patch } : part)));
  const updateSub = (mainIndex, subIndex, patch) => setMainParts((parts) => parts.map((part, i) => (i === mainIndex
    ? { ...part, sub_parts: part.sub_parts.map((sub, j) => (j === subIndex ? { ...sub, ...patch } : sub)) }
    : part)));
  const removeMain = (mainIndex) => setMainParts((parts) => parts.filter((_, i) => i !== mainIndex));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!isEdit && !attachments.length) throw new Error("Upload at least one RFQ attachment.");
      const missingMain = mainParts.find((part) => !(part.drawing_attachments || []).length);
      if (missingMain) throw new Error(`Upload at least one drawing for main part ${missingMain.main_part_no || "(unnamed)"}.`);
      const missingSub = mainParts.flatMap((part) => part.sub_parts || []).find((sub) => sub.sub_part_no?.trim() && !(sub.drawing_attachments || []).length);
      if (missingSub) throw new Error(`Upload at least one drawing for sub part ${missingSub.sub_part_no}.`);
      const payload = {
        ...form,
        main_parts: mainParts.map((part) => ({
          ...part,
          volume_per_annum_nos: Number(part.volume_per_annum_nos),
          sub_parts: part.sub_parts.filter((sub) => sub.sub_part_no.trim()).map((sub) => ({ ...sub, qty_per_main_part: Number(sub.qty_per_main_part) })),
        })),
      };
      if (isEdit) {
        await api.put(`${ENDPOINTS.RFQ.BASE}/${rfq._id}`, payload);
        onSaved();
        return;
      }
      const response = await api.post(ENDPOINTS.RFQ.BASE, {
        ...payload,
        stage_attachments: attachments.length ? { CUSTOMER_RFQ_RECEIVED: attachments } : {},
      });
      onCreated(response.data.rfqItem._id);
    } catch (e) {
      setError(errorMessage(e, "Create failed"));
      setSaving(false);
    }
  };

  return <RfqFullPage title={isEdit ? `Edit RFQ ${rfq.rfq_number}` : "Create New RFQ"} subtitle={isEdit ? "Update RFQ details and part structure" : "Create the RFQ first. Start a batch workflow from its detail page when parts are ready."} onClose={onClose}>
    <form onSubmit={submit} className="space-y-3">
      {error && <Alert>{error}</Alert>}

      <Panel title="1 · RFQ Details">
        <div className="grid gap-3 md:grid-cols-3">
          <FormField label="Customer"><TextInput required value={form.customer} onChange={(e) => setField({ customer: e.target.value })} /></FormField>
          <FormField label="RFQ Date"><TextInput type="date" required value={form.rfq_dated} onChange={(e) => setField({ rfq_dated: e.target.value })} /></FormField>
          <FormField label="Project Name"><TextInput required value={form.project_name} onChange={(e) => setField({ project_name: e.target.value.toUpperCase() })} /></FormField>
          <FormField label="Project Owner"><ProjectOwnerSelect value={form.project_owner} onChange={(projectOwner) => setField({ project_owner: projectOwner })} /></FormField>
        </div>
        <div className="mt-3"><FormField label="Description"><TextAreaInput required rows={3} value={form.description} onChange={(e) => setField({ description: e.target.value })} /></FormField></div>

        <div className="mt-4 border-t border-slate-200 pt-3">
          <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-slate-700">RFQ Send By</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <FormField label="Name"><TextInput required value={form.rfq_send_by_name} onChange={(e) => setField({ rfq_send_by_name: e.target.value })} /></FormField>
            <FormField label="Contact Number"><TextInput required type="tel" value={form.rfq_send_by_contact_number} onChange={(e) => setField({ rfq_send_by_contact_number: e.target.value })} /></FormField>
            <FormField label="Email"><TextInput required type="email" value={form.rfq_send_by_email} onChange={(e) => setField({ rfq_send_by_email: e.target.value })} /></FormField>
          </div>
        </div>
      </Panel>

      {!isEdit && <Panel title="2 · Attachments *" toolbar={<span className="text-xs text-slate-600">Customer RFQ, drawings, specs (Excel, PDF, Word, text, images or links)</span>}>
        <AttachmentField items={attachments} onChange={setAttachments} />
        <p className="mt-1 text-[11px] text-rose-600">At least one RFQ attachment is required.</p>
      </Panel>}


      <Panel title={`${isEdit ? 2 : 3} · Part Structure`} toolbar={<span className="text-xs text-slate-500">{mainParts.length} main part(s)</span>}>
        <p className="mb-3 text-xs text-slate-600">One RFQ has many main parts; each main part can have any number of sub parts (optional).</p>
        <div className="space-y-3">
          {mainParts.map((part, mainIndex) => <div key={mainIndex} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-indigo-600">Main Part {mainIndex + 1}</span>
              {mainParts.length > 1 && <button type="button" onClick={() => removeMain(mainIndex)} aria-label="Remove main part" className="text-slate-600 hover:text-rose-600"><Trash2 size={15} /></button>}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Main Part No"><TextInput required value={part.main_part_no} onChange={(e) => updateMain(mainIndex, { main_part_no: e.target.value.toUpperCase() })} /></FormField>
              <FormField label="Annual Volume"><TextInput type="number" min="1" required value={part.volume_per_annum_nos} onChange={(e) => updateMain(mainIndex, { volume_per_annum_nos: e.target.value })} /></FormField>
              <FormField label="Description"><TextInput value={part.description} onChange={(e) => updateMain(mainIndex, { description: e.target.value })} /></FormField>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-2">
              <FormField label="Main Part Drawings *"><AttachmentField items={part.drawing_attachments || []} onChange={(items) => updateMain(mainIndex, { drawing_attachments: items })} /></FormField>
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-600">Sub Parts ({part.sub_parts.length})</span>
                <button type="button" onClick={() => updateMain(mainIndex, { sub_parts: [...part.sub_parts, blankSub()] })} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600"><Plus size={13} /> Add Sub Part</button>
              </div>
              {part.sub_parts.map((sub, subIndex) => <div key={subIndex} className="grid items-end gap-2 md:grid-cols-[1fr_1fr_90px_28px]">
                <FormField label="Sub Part No"><TextInput value={sub.sub_part_no} onChange={(e) => updateSub(mainIndex, subIndex, { sub_part_no: e.target.value.toUpperCase() })} /></FormField>
                <FormField label="Description"><TextInput value={sub.description} onChange={(e) => updateSub(mainIndex, subIndex, { description: e.target.value })} /></FormField>
                <FormField label="Qty"><TextInput type="number" min="1" value={sub.qty_per_main_part} onChange={(e) => updateSub(mainIndex, subIndex, { qty_per_main_part: e.target.value })} /></FormField>
                <button type="button" onClick={() => updateMain(mainIndex, { sub_parts: part.sub_parts.filter((_, j) => j !== subIndex) })} aria-label="Remove sub part" className="mb-2 text-slate-600 hover:text-rose-600"><Trash2 size={15} /></button>
                <div className="md:col-span-4 rounded-md border border-slate-200 bg-white p-2">
                  <FormField label={`Drawings * · ${sub.sub_part_no || `Sub Part ${subIndex + 1}`}`}><AttachmentField items={sub.drawing_attachments || []} onChange={(items) => updateSub(mainIndex, subIndex, { drawing_attachments: items })} /></FormField>
                </div>
              </div>)}
            </div>
          </div>)}
        </div>
        <div className="mt-4 flex justify-center border-t border-dashed border-slate-300 pt-4">
          <GhostButton type="button" onClick={() => setMainParts((parts) => [...parts, blankMain()])}><Plus size={14} className="mr-1 inline" />Add Main Part</GhostButton>
        </div>
      </Panel>

      <div className="sticky bottom-0 -mx-3 -mb-3 flex justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
        <GhostButton type="button" onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving..." : isEdit ? "Save changes" : "Create RFQ"}</PrimaryButton>
      </div>
    </form>
  </RfqFullPage>;
}
