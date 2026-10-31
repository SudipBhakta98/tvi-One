import { useState } from "react";
import { Boxes, PackagePlus } from "lucide-react";
import { Alert, GhostButton, PrimaryButton } from "../../../components/ui";
import { TextInput } from "./FormControls";
import { useAsyncAction } from "../hooks/useAsyncAction";
import AttachmentField from "./AttachmentField";
import BomDialog from "./BomDialog";
import PoDialog from "./PoDialog";
import PurchaseItemsDialog from "./PurchaseItemsDialog";
import TargetDatesDialog from "./TargetDatesDialog";
import { CUSTOMER_APPROVAL_STAGES, NEXT_PHASE_AFTER, PURCHASE_ITEM_STAGES, attachmentLabel, hasTargetDate } from "./rfqConfig";

const CAPEX_COMPLETE_STATUS = "APPROVED";
const LOST_CONFIRMATION = "Mark this RFQ as Lost? The RFQ will be closed.";
// Stages that have their own dedicated submit button below; every other stage gets a plain "Mark Done".
const CUSTOM_SUBMIT_STAGES = new Set(["COSTING", "CUSTOMER_DECISION", "CUSTOMER_PO_RECEIVED", ...CUSTOMER_APPROVAL_STAGES]);

const Caption = ({ children }) => <div className="mb-1 text-xs font-semibold text-slate-600">{children}</div>;

/** Inputs + action buttons for the currently open stage (Admin / Manager only). */
export default function StageActionPanel({ rfq, stage, components, onComplete, onReload }) {
  const [files, setFiles] = useState([]);
  const [price, setPrice] = useState("");
  const existingTargetDate = rfq.stage_schedule?.find((entry) => entry.stage === stage)?.target_date;
  const needsTargetDate = hasTargetDate(stage) && !existingTargetDate;
  const [targetDate, setTargetDate] = useState("");
  const [dialog, setDialog] = useState(null); // "targets" | "po" | "purchase" | "bom"
  const [pendingPayload, setPendingPayload] = useState(null);
  const { run, busy, error } = useAsyncAction();

  const blocked = busy || !files.length || (needsTargetDate && !targetDate);

  const purchaseItems = (rfq.purchase_items || []).filter((item) => item.stage === stage);
  const closeDialog = () => setDialog(null);

  const submit = (payload) => onComplete(stage, { ...payload, ...(needsTargetDate && targetDate ? { target_date: targetDate } : {}), attachments: files });
  const requireEvidence = () => { if (!files.length) throw new Error("Upload at least one attachment before continuing."); };

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
    {needsTargetDate && <div><Caption>Target Date <span className="text-rose-600">*</span></Caption><TextInput type="date" required value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="w-full" /><p className="mt-1 text-[11px] text-slate-500">Set this stage's target date before submitting it.</p></div>}

    <div>
      <Caption>{attachmentLabel(stage)} <span className="text-rose-600">*</span></Caption>
      {!files.length && <p className="mb-1 text-[11px] text-rose-600">Upload at least one attachment to complete this stage.</p>}
      <AttachmentField items={files} onChange={setFiles} />
    </div>
    {stage === "COSTING" && <div>
      <Caption>Quoted value <span className="text-rose-600">*</span></Caption>
      <TextInput type="number" min="0.01" step="0.01" placeholder="Enter customer quoted value" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full" />
    </div>}

    <div className="flex flex-wrap gap-2 pt-1">
      {stage === "COSTING" && <PrimaryButton disabled={blocked} onClick={submitCosting}>Submit Costing</PrimaryButton>}
      {stage === "CUSTOMER_DECISION" && <>
        <PrimaryButton disabled={blocked} onClick={() => finish({ decision: "AWARDED" })}>Awarded</PrimaryButton>
        <button type="button" disabled={blocked} onClick={markLost} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">Lost</button>
      </>}
      {CUSTOMER_APPROVAL_STAGES.has(stage) && <PrimaryButton disabled={blocked} onClick={() => finish({ approved: true })}>Customer Approved</PrimaryButton>}
      {stage === "CUSTOMER_PO_RECEIVED" && <PrimaryButton disabled={blocked} onClick={openPoDialog}>Submit</PrimaryButton>}

      {PURCHASE_ITEM_STAGES.has(stage) && <GhostButton type="button" onClick={() => setDialog("purchase")}><PackagePlus size={13} className="mr-1 inline" />Add purchase items{purchaseItems.length ? ` (${purchaseItems.length})` : ""}</GhostButton>}
      {stage === "ACTUAL_BOM" && <GhostButton type="button" onClick={() => setDialog("bom")}><Boxes size={13} className="mr-1 inline" />Add BOM</GhostButton>}
      {!CUSTOM_SUBMIT_STAGES.has(stage) && <PrimaryButton disabled={blocked} onClick={markDone}>{stage === "MASS_PRODUCTION_HANDOVER" ? "Convert to Project" : "Mark Done"}</PrimaryButton>}
    </div>

    {dialog === "targets" && <TargetDatesDialog phase={NEXT_PHASE_AFTER[stage]} onClose={closeDialog} onConfirm={(target_dates) => submit({ ...pendingPayload, target_dates })} />}
    {dialog === "po" && <PoDialog onClose={closeDialog} onConfirm={submit} />}
    {dialog === "purchase" && <PurchaseItemsDialog rfq={rfq} rfqId={rfq._id} stage={stage} items={purchaseItems} onClose={closeDialog} onSaved={onReload} />}
    {dialog === "bom" && <BomDialog rfq={rfq} components={components} onClose={closeDialog} onChanged={onReload} />}
  </div>;
}
