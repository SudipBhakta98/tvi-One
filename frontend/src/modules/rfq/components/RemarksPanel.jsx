import { useState } from "react";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { Alert, PrimaryButton } from "../../../components/ui";
import { TextAreaInput } from "./FormControls";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { formatDateTime, humanize } from "../utils/rfqFormat";
import { rfqApiBase } from "./rfqConfig";

/** One stage's remark thread. Remarks are append-only; with `canAdd` anyone who can open the RFQ can add as many as they need. */
export default function RemarksPanel({ rfq, rfqId, stage, remarks, onAdded, canAdd = true }) {
  const [text, setText] = useState("");
  const { run, busy, error } = useAsyncAction();

  const submit = async () => {
    const saved = await run(() => api.post(rfq?.parent_rfq ? `${rfqApiBase(rfq)}/remarks` : ENDPOINTS.RFQ.REMARKS(rfqId || rfq?._id), { stage, text }));
    if (!saved) return;
    setText("");
    await onAdded();
  };

  return <div className="space-y-2">
    {canAdd && error && <Alert>{error}</Alert>}
    <ul className="space-y-1.5">
      {remarks.length === 0 && <li className="text-xs text-slate-600">No remarks for this stage yet.</li>}
      {remarks.map((remark) => <li key={remark._id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
        <p className="whitespace-pre-wrap">{remark.text}</p>
        <p className="mt-1 text-[11px] text-slate-500">{remark.user_name} · {humanize(remark.user_role)} · {formatDateTime(remark.createdAt)}</p>
      </li>)}
    </ul>
    {canAdd && <>
      <TextAreaInput rows={2} placeholder="Add a remark for this stage…" value={text} onChange={(e) => setText(e.target.value)} />
      <PrimaryButton type="button" disabled={busy || !text.trim()} onClick={submit}>{busy ? "Saving…" : "Add remark"}</PrimaryButton>
    </>}
  </div>;
}
