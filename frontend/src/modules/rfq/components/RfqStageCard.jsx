import { Eye, Lock, MessageSquarePlus, Paperclip, Pencil } from "lucide-react";
import { GhostButton } from "../../../components/ui";
import { STATUS_VIEW, formatDate } from "./rfqConfig";

const CARD_TONE = {
  DONE: "border-emerald-200",
  DELAY_DONE: "border-rose-200",
  IN_PROGRESS: "border-indigo-400 ring-2 ring-indigo-100",
  DELAYED: "border-amber-400 ring-2 ring-amber-100",
  UPCOMING: "border-slate-200 bg-slate-50/60",
};
const FINISHED_STATES = new Set(["DONE", "DELAY_DONE"]);

const Meta = ({ label, value }) => <div className="rounded-md bg-slate-50 px-2.5 py-1.5">
  <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</div>
  <div className="text-xs font-semibold text-slate-800">{value}</div>
</div>;

/** One stage: name, status, target date, submit date, plus a body (`children`) for the open stage. */
export default function RfqStageCard({ number, label, hasTarget, entry, state, remarks, remarkCount, attachmentCount, onView, onAddRemark, onEdit, children }) {
  const status = STATUS_VIEW[state];
  const finished = FINISHED_STATES.has(state);

  return <section className={`flex flex-col gap-2.5 rounded-xl border bg-white p-3 shadow-sm ${CARD_TONE[state]}`}>
    <header className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 items-start gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{number}</span>
        <h3 className="text-[13px] font-bold leading-snug text-slate-900">{label}</h3>
      </div>
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold ${status.className}`}>{status.label}</span>
    </header>

    <div className="grid grid-cols-2 gap-2">
      <Meta label="Target Date" value={hasTarget ? formatDate(entry?.target_date) : "Customer driven"} />
      <Meta label="Submit Date" value={formatDate(entry?.completed_date)} />
    </div>

    {children}
    {children && state !== "UPCOMING" && <GhostButton type="button" onClick={onAddRemark} className="self-start"><MessageSquarePlus size={13} className="mr-1 inline" />Add remarks ({remarkCount})</GhostButton>}
    {!children && (finished
      ? <div className="space-y-2">
          <p className="line-clamp-2 text-xs text-slate-600"><span className="font-semibold text-slate-700">Remarks: </span>{remarks || "No remarks"}</p>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-slate-600"><Paperclip size={12} /> {attachmentCount} attachment{attachmentCount === 1 ? "" : "s"}</span>
            <div className="flex gap-1.5">
              {onEdit && <GhostButton type="button" onClick={onEdit}><Pencil size={13} className="mr-1 inline" />Edit</GhostButton>}
              <GhostButton type="button" onClick={onView}><Eye size={13} className="mr-1 inline" />View details</GhostButton>
            </div>
          </div>
        </div>
      : <p className="flex items-center gap-1.5 text-xs text-slate-600"><Lock size={12} /> Unlocks after the previous stage is completed.</p>)}
  </section>;
}
