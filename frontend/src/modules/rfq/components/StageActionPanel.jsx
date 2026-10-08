import { useState } from "react";
import { Boxes, PackagePlus } from "lucide-react";
import { Alert, GhostButton, PrimaryButton } from "../../../components/ui";
import { TextInput, TextAreaInput } from "./FormControls";
import { useAsyncAction } from "../hooks/useAsyncAction";
import AttachmentField from "./AttachmentField";
import BomDialog from "./BomDialog";
import PoDialog from "./PoDialog";
import PurchaseItemsDialog from "./PurchaseItemsDialog";
import TargetDatesDialog from "./TargetDatesDialog";
import { CUSTOMER_APPROVAL_STAGES, CUSTOMER_EVIDENCE_STAGES, NEXT_PHASE_AFTER, PURCHASE_ITEM_STAGES, attachmentLabel } from "./rfqConfig";

const CAPEX_COMPLETE_STATUS = "APPROVED";
const LOST_CONFIRMATION = "Mark this RFQ as Lost? The RFQ will be closed.";
// Stages that have their own dedicated submit button below; every other stage gets a plain "Mark Done".
const CUSTOM_SUBMIT_STAGES = new Set(["COSTING", "CUSTOMER_DECISION", "CUSTOMER_PO_RECEIVED", ...CUSTOMER_APPROVAL_STAGES]);

const Caption = ({ children }) => <div className="mb-1 text-xs font-semibold text-slate-600">{children}</div>;

/** Inputs + action buttons for the currently open stage (Admin / Manager only). */
export default function StageActionPanel({ rfq, stage, components, onComplete, onReload }) {
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const [price, setPrice] = useState("");
  const [dialog, setDialog] = useState(null); // "targets" | "po" | "purchase" | "bom"
  const [pendingPayload, setPendingPayload] = useState(null);
  const { run, busy, error } = useAsyncAction();

  const evidenceRequired = CUSTOMER_EVIDENCE_STAGES.has(stage);
  const purchaseItems = (rfq.purchase_items || []).filter((item) => item.stage === stage);
  const closeDialog = () => setDialog(null);

  const submit = (payload) => onComplete(stage, { ...payload, note: note.trim(), attachments: files });
  const requireEvidence = () => { if (evidenceRequired && !files.length) throw new Error("Attach the customer evidence before continuing."); };

  // Positive customer answers first collect the next phase's target dates, then submit in one request.
  const finish = (payload) => run(async () => {
    requireEvidence();
    if (NEXT_PHASE_AFTER[stage] && payload.decision !== "LOST") { setPendingPayload(payload); setDialog("targets"); return; }
    await submit(payload);
  });
  const openPoDialog = () => run(async () => { requireEvidence(); setDialog("po"); });
  const markLost = () => window.confirm(LOST_CONFIRMATION) && finish({ decision: "LOST" });
  const submitCosting = () => run(async () => {
    if (!(Number(price) > 0)) throw new Error("Enter a quoted value greater than zero.");
    await submit({ quoted_price: Number(price) });
  });
  const markDone = () => run(() => submit(stage === "CAPEX_PILOT_COMPONENTS" ? { status: CAPEX_COMPLETE_STATUS } : {}));

  return <div className="space-y-2.5">
    {error && <Alert>{error}</Alert>}

    <div>
      <Caption>Remarks</Caption>
      <TextAreaInput rows={2} placeholder="Add remarks for this stage (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
    </div>
    <div>
      <Caption>{attachmentLabel(stage)}{evidenceRequired && <span className="text-rose-600"> *</span>}</Caption>
      <AttachmentField items={files} onChange={setFiles} />
    </div>
    {stage === "COSTING" && <div>
      <Caption>Quoted value <span className="text-rose-600">*</span></Caption>
      <TextInput type="number" min="0.01" step="0.01" placeholder="Enter customer quoted value" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full" />
    </div>}

    <div className="flex flex-wrap gap-2 pt-1">
      {stage === "COSTING" && <PrimaryButton disabled={busy} onClick={submitCosting}>Submit Costing</PrimaryButton>}
      {stage === "CUSTOMER_DECISION" && <>
        <PrimaryButton disabled={busy} onClick={() => finish({ decision: "AWARDED" })}>Awarded</PrimaryButton>
        <button type="button" disabled={busy} onClick={markLost} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">Lost</button>
      </>}
      {CUSTOMER_APPROVAL_STAGES.has(stage) && <PrimaryButton disabled={busy} onClick={() => finish({ approved: true })}>Customer Approved</PrimaryButton>}
      {stage === "CUSTOMER_PO_RECEIVED" && <PrimaryButton disabled={busy} onClick={openPoDialog}>Submit</PrimaryButton>}

      {PURCHASE_ITEM_STAGES.has(stage) && <GhostButton type="button" onClick={() => setDialog("purchase")}><PackagePlus size={13} className="mr-1 inline" />Add purchase items{purchaseItems.length ? ` (${purchaseItems.length})` : ""}</GhostButton>}
      {stage === "ACTUAL_BOM" && <GhostButton type="button" onClick={() => setDialog("bom")}><Boxes size={13} className="mr-1 inline" />Add BOM</GhostButton>}
      {!CUSTOM_SUBMIT_STAGES.has(stage) && <PrimaryButton disabled={busy} onClick={markDone}>{stage === "MASS_PRODUCTION_HANDOVER" ? "Convert to Project" : "Mark Done"}</PrimaryButton>}
    </div>

    {dialog === "targets" && <TargetDatesDialog phase={NEXT_PHASE_AFTER[stage]} onClose={closeDialog} onConfirm={(target_dates) => submit({ ...pendingPayload, target_dates })} />}
    {dialog === "po" && <PoDialog onClose={closeDialog} onConfirm={submit} />}
    {dialog === "purchase" && <PurchaseItemsDialog rfqId={rfq._id} stage={stage} items={purchaseItems} onClose={closeDialog} onSaved={onReload} />}
    {dialog === "bom" && <BomDialog rfq={rfq} components={components} onClose={closeDialog} onChanged={onReload} />}
  </div>;
}
