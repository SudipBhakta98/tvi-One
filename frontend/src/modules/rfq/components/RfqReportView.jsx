import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, Download, ExternalLink, File, FileImage, FileSpreadsheet, FileText, Link2, MessageSquare, Paperclip, Printer, X } from "lucide-react";
import { attachmentUrl as fileHref, attachmentError } from "./AttachmentField";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { Alert, GhostButton, PrimaryButton } from "../../../components/ui";
import { errorMessage, formatDate, formatMoney, hasTargetDate, stageLabel, STAGES } from "./rfqConfig";
import { formatDateTime, humanize } from "../utils/rfqFormat";

/* ───────────────────────── helpers ───────────────────────── */

const dkey = (value) => new Date(value).toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((Date.parse(dkey(a)) - Date.parse(dkey(b))) / 86400000);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const date = (value) => (value ? formatDate(value) : "—");
const fileSize = (bytes) => (!bytes ? "" : bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`);

const fileKind = (file) => {
  const ext = String(file.file_name || "").split(".").pop().toLowerCase();
  const mime = String(file.file_type || "").toLowerCase();
  if (mime === "link") return "link";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (["xls", "xlsx", "csv"].includes(ext) || mime.includes("sheet") || mime.includes("excel") || mime === "text/csv") return "sheet";
  if (["doc", "docx", "txt"].includes(ext) || mime.includes("word") || mime === "text/plain") return "doc";
  return "file";
};
const KIND_VIEW = {
  image: { Icon: FileImage, label: "Image", tile: "from-cyan-500 to-indigo-500" },
  pdf: { Icon: FileText, label: "PDF", tile: "from-rose-500 to-rose-600" },
  sheet: { Icon: FileSpreadsheet, label: "Sheet", tile: "from-emerald-500 to-emerald-600" },
  doc: { Icon: FileText, label: "Document", tile: "from-sky-500 to-blue-600" },
  link: { Icon: Link2, label: "Link", tile: "from-violet-500 to-purple-600" },
  file: { Icon: File, label: "File", tile: "from-slate-500 to-slate-600" },
};

const isExternal = (href) => /^https?:\/\//i.test(href);

// One click = the file is saved to the user's computer (external links open in a new tab).
async function downloadFile(file) {
  const href = fileHref(file);
  if (!href) { window.alert("This file is unavailable."); return; }
  if (isExternal(href)) { window.open(href, "_blank", "noopener,noreferrer"); return; }
  try {
    const { data } = await api.get(href, { responseType: "blob" });
    const blobUrl = window.URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = blobUrl; anchor.download = file.file_name || "attachment";
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
  } catch (error) { window.alert(attachmentError(error, "download")); }
}

// Authenticated files come from the API as blobs; plain links are used as they are.
function useBlobUrl(file, enabled) {
  const src = fileHref(file);
  const [state, setState] = useState({ url: "", failed: false });
  useEffect(() => {
    if (!enabled) return undefined;
    if (!src) { setState({ url: "", failed: true }); return undefined; }
    if (/^https?:\/\//i.test(src)) { setState({ url: src, failed: false }); return undefined; }
    let alive = true; let blobUrl = "";
    api.get(src, { responseType: "blob" })
      .then(({ data }) => { if (!alive) return; blobUrl = window.URL.createObjectURL(data); setState({ url: blobUrl, failed: false }); })
      .catch(() => { if (alive) setState({ url: "", failed: true }); });
    return () => { alive = false; if (blobUrl) window.URL.revokeObjectURL(blobUrl); };
  }, [src, enabled]);
  return state;
}

/* Stage state: DONE · LATE (done after target) · PROG · OVER (open, target passed) · HOLD · UP */
const STATE_VIEW = {
  DONE: { label: "Done", badge: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "border-emerald-400 bg-emerald-50 text-emerald-700" },
  LATE: { label: "Done · Delayed", badge: "border-rose-200 bg-rose-50 text-rose-700", dot: "border-rose-400 bg-rose-50 text-rose-700" },
  PROG: { label: "In Progress", badge: "border-indigo-200 bg-indigo-50 text-indigo-700", dot: "border-indigo-400 bg-indigo-50 text-indigo-700" },
  OVER: { label: "Overdue", badge: "border-amber-300 bg-amber-50 text-amber-700", dot: "border-amber-400 bg-amber-50 text-amber-700" },
  HOLD: { label: "On Hold", badge: "border-slate-300 bg-slate-100 text-slate-600", dot: "border-slate-400 bg-slate-100 text-slate-600" },
  UP: { label: "Upcoming", badge: "border-slate-200 bg-slate-50 text-slate-500", dot: "border-slate-200 bg-slate-50 text-slate-400" },
};
const BOX_TONE = {
  "": "border-slate-200 bg-slate-50 text-slate-700",
  miss: "border-dashed border-amber-300 bg-amber-50 text-amber-800",
  ev: "border-slate-200 bg-white text-slate-500",
};

const stageState = (doc, entry, stage) => {
  if (entry?.completed_date) return entry.target_date && dayDiff(entry.completed_date, entry.target_date) > 0 ? "LATE" : "DONE";
  if (doc.current_stage === "COMPLETED") return "DONE";
  if (stage !== doc.current_stage) return "UP";
  if (doc.lifecycle_status && !["IN_PROGRESS", "ACTIVE"].includes(doc.lifecycle_status)) return "HOLD";
  return entry?.target_date && dayDiff(new Date(), entry.target_date) > 0 ? "OVER" : "PROG";
};

// Never leave a date blank: say why it is empty.
const targetView = (entry, stage, state) => {
  if (entry?.target_date) {
    const late = state === "OVER" ? ` · overdue by ${plural(dayDiff(new Date(), entry.target_date), "day")}` : "";
    return { tone: "", text: `${formatDate(entry.target_date)}${late}` };
  }
  if (hasTargetDate(stage)) return { tone: "miss", text: "Not set — target date not given" };
  return { tone: "ev", text: "Not applicable — customer / event driven" };
};
const completedView = (entry, stage, state) => {
  if (entry?.completed_date) {
    if (!entry.target_date) return { tone: "", text: `${formatDate(entry.completed_date)}${hasTargetDate(stage) ? " · no target was set" : ""}` };
    const d = dayDiff(entry.completed_date, entry.target_date);
    return { tone: "", text: `${formatDate(entry.completed_date)} · ${d > 0 ? `${plural(d, "day")} late` : d < 0 ? `${plural(-d, "day")} early` : "on time"}` };
  }
  if (state === "DONE") return { tone: "ev", text: "Completed — date not recorded" };
  if (state === "PROG") return { tone: "miss", text: `Not completed yet — in progress${entry?.target_date ? "" : " · no target to track against"}` };
  if (state === "OVER") return { tone: "miss", text: "Not completed yet — overdue" };
  if (state === "HOLD") return { tone: "miss", text: "Not completed yet — workflow is on hold" };
  return { tone: "ev", text: "Not started yet" };
};

// Small fact chips for stages that carry their own data (costing, decision, PO, handover).
const stageFacts = (doc, stage, state) => {
  const facts = [];
  const add = (label, value) => facts.push([label, value || "—"]);
  if (stage === "COSTING") { add("Quoted price", doc.costing?.quoted_price ? formatMoney(doc.costing.quoted_price) : "Not quoted yet"); if (doc.costing?.submitted_date) add("Costing submitted", date(doc.costing.submitted_date)); }
  if (stage === "CUSTOMER_DECISION") { add("Decision", doc.customer_decision?.decision || "Pending"); if (doc.customer_decision?.decision_date) add("Decision date", date(doc.customer_decision.decision_date)); if (doc.customer_decision?.notes) add("Notes", doc.customer_decision.notes); }
  if (stage === "CUSTOMER_PO_RECEIVED") { add("PO number", doc.purchase_order?.po_number || "Not received"); if (doc.purchase_order?.po_qty) add("PO qty", doc.purchase_order.po_qty); if (doc.purchase_order?.po_received_date) add("PO received", date(doc.purchase_order.po_received_date)); if (doc.purchase_order?.delivery_schedule?.length) add("Deliveries", plural(doc.purchase_order.delivery_schedule.length, "slot")); }
  if (stage === "MASS_PRODUCTION_HANDOVER") { add("Handover target", doc.mass_production?.handover_target_date ? date(doc.mass_production.handover_target_date) : "Not set"); add("Handed over", doc.mass_production?.handed_over_date ? date(doc.mass_production.handed_over_date) : "Not yet"); }
  return state === "UP" ? facts.filter(([, v]) => !["Not quoted yet", "Pending", "Not received", "Not set", "Not yet", "—"].includes(v)) : facts;
};

// Tolerates a Map, a plain object, or a missing / malformed value.
const attachmentMap = (doc) => (doc.stage_attachments instanceof Map ? Object.fromEntries(doc.stage_attachments) : (doc.stage_attachments || {}));
const filesOf = (doc, stage) => { const list = attachmentMap(doc)[stage]; return Array.isArray(list) ? list.map((f) => ({ ...f, stage })) : []; };
const scheduleEntry = (doc, stage) => doc.stage_schedule?.find((i) => i.stage === stage);
const progressOf = (doc) => {
  const total = STAGES.length;
  const done = doc.current_stage === "COMPLETED" ? total : STAGES.filter(([stage]) => scheduleEntry(doc, stage)?.completed_date).length;
  return { done, total };
};

/* ───────────────────────── small UI pieces ───────────────────────── */

const Section = ({ no, title, count, children }) => <section className="border-t border-slate-300 pt-4 print:break-inside-auto">
  <h2 className="mb-3 flex items-center gap-2 text-[15px] font-black uppercase tracking-wide text-slate-900"><span className="text-indigo-700">{no}.</span>{title}{count !== undefined && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-slate-500">{count}</span>}</h2>
  {children}
</section>;

const initials = (name) => String(name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function RemarkCard({ remark, heading }) {
  return <div className="mb-2 flex gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 print:break-inside-avoid">
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-600 text-[11px] font-black text-white">{initials(remark.user_name)}</span>
    <div className="min-w-0 flex-1">
      <p className="flex flex-wrap items-center gap-x-2 text-xs"><b className="text-slate-900">{remark.user_name}</b><span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">{humanize(remark.user_role)}</span><span className="text-slate-500">{formatDateTime(remark.createdAt)}</span></p>
      {heading && <p className="mt-0.5 text-[11px] font-bold text-indigo-700">{heading}</p>}
      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-slate-900">{remark.text}</p>
    </div>
  </div>;
}

function FileCard({ file, onPreview }) {
  const kind = fileKind(file); const { Icon, label, tile } = KIND_VIEW[kind];
  const { url } = useBlobUrl(file, kind === "image");
  const available = Boolean(fileHref(file));
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-indigo-400 hover:shadow-md print:break-inside-avoid">
    <button type="button" disabled={!available} onClick={() => downloadFile(file)} title={available ? `Click to ${isExternal(fileHref(file)) ? "open" : "download"} ${file.file_name}` : "File unavailable"} className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-60">
      <div className={`relative grid h-24 place-items-center overflow-hidden bg-gradient-to-br ${tile} text-white`}>
        {kind === "image" && url ? <img src={url} alt={file.file_name} className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-1 text-[11px] font-bold"><Icon size={26} />{label}</span>}
        <span className="absolute bottom-1 right-1 rounded bg-black/55 p-1 print:hidden"><Download size={12} /></span>
      </div>
      <div className="px-2.5 py-2"><p className="break-all text-xs font-semibold leading-4 text-slate-800">{file.file_name}</p>
        <p className="text-[10px] text-slate-500">{available ? [label, fileSize(file.file_size), file.uploaded_at && formatDate(file.uploaded_at)].filter(Boolean).join(" · ") : "File unavailable"}</p></div>
    </button>
    {(kind === "image" || kind === "pdf") && available && <button type="button" onClick={() => onPreview(file)} className="w-full border-t border-slate-100 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 print:hidden">Preview</button>}
  </div>;
}

function Drawings({ files, stage, onPreview }) {
  if (!files?.length) return <p className="mt-1 text-[11px] italic text-slate-500">No drawings attached.</p>;
  return <div className="mt-2"><p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-500"><Paperclip size={10} className="mr-1 inline" />Drawings ({files.length}) <span className="font-medium normal-case tracking-normal text-slate-400">— click to download</span></p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">{files.map((f, i) => <FileCard key={`${f._id || f.file_name}-${i}`} file={{ ...f, stage }} onPreview={onPreview} />)}</div></div>;
}

function PreviewModal({ file, onClose }) {
  const kind = fileKind(file); const { url, failed } = useBlobUrl(file, kind === "image" || kind === "pdf");
  const { Icon, label } = KIND_VIEW[kind];
  const loading = <p className="grid h-80 place-items-center text-sm text-slate-500">Loading preview…</p>;
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/75 p-4 print:hidden" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0"><p className="truncate text-sm font-bold">{file.file_name}</p><p className="text-xs text-slate-500">{[file.stage && humanize(file.stage), label, fileSize(file.file_size), file.uploaded_at && `Uploaded ${formatDateTime(file.uploaded_at)}`].filter(Boolean).join(" · ")}</p></div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => downloadFile(file)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50"><Download size={13} /> Download</button>
          <button type="button" onClick={onClose} aria-label="Close preview" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
        </div>
      </div>
      <div className="min-h-[320px] flex-1 overflow-auto bg-slate-100">
        {failed ? <p className="grid h-80 place-items-center text-sm text-slate-500">Preview unavailable — the file could not be loaded.</p>
          : kind === "image" ? (url ? <img src={url} alt={file.file_name} className="mx-auto max-h-[75vh] object-contain" /> : loading)
          : kind === "pdf" ? (url ? <iframe title={file.file_name} src={url} className="h-[75vh] w-full border-0" /> : loading)
          : <div className="grid h-80 place-items-center text-center text-sm text-slate-600"><div><Icon size={40} className="mx-auto mb-2 text-slate-400" /><p>{kind === "link" ? "This is an external link." : `${label} files can't be previewed in the browser.`}</p>
            <button type="button" onClick={() => downloadFile(file)} className="mt-3 inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"><ExternalLink size={13} /> {kind === "link" ? "Open link" : "Download to view"}</button></div></div>}
      </div>
    </div>
  </div>;
}

function StageRow({ doc, stage, index, onPreview }) {
  const entry = scheduleEntry(doc, stage);
  const state = stageState(doc, entry, stage); const view = STATE_VIEW[state];
  const target = targetView(entry, stage, state); const completed = completedView(entry, stage, state);
  const remarks = (doc.stage_remarks || []).filter((r) => r.stage === stage);
  const files = filesOf(doc, stage);
  const items = (doc.purchase_items || []).filter((p) => p.stage === stage);
  const facts = stageFacts(doc, stage, state);
  if (state === "UP" && !remarks.length && !files.length && !items.length && !facts.length) {
    const note = entry?.target_date ? `Target ${formatDate(entry.target_date)}` : hasTargetDate(stage) ? "Target date will be set when this phase opens" : "Customer / event driven";
    return <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2 text-xs text-slate-500 last:border-0 print:break-inside-avoid">
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${view.dot}`}>{index + 1}</span>
      <span className="min-w-0 flex-1 truncate font-semibold text-slate-600">{stageLabel(stage)}</span><span className="hidden sm:inline">{note}</span>
      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${view.badge}`}>{view.label}</span>
    </div>;
  }
  return <div className="grid grid-cols-[34px_1fr] gap-3 border-b border-slate-100 px-4 py-4 last:border-0 print:break-inside-avoid">
    <span className={`grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-black ${view.dot}`}>{index + 1}</span>
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-bold text-slate-900">{stageLabel(stage)}</h4><span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${view.badge}`}>{view.label}</span></div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {[["Target date", target], ["Completed date", completed]].map(([label, v]) => <div key={label} className={`rounded-lg border px-3 py-1.5 text-xs ${BOX_TONE[v.tone]}`}><p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide opacity-70"><CalendarClock size={11} />{label}</p><p className="mt-0.5 font-semibold">{v.text}</p></div>)}
      </div>
      {(facts.length > 0 || items.length > 0) && <div className="mt-2 flex flex-wrap gap-1.5">
        {facts.map(([k, v]) => <span key={k} className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] text-indigo-900"><b>{k}:</b> {v}</span>)}
        {items.map((p) => <span key={p._id || p.item_name} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-700">🛒 {p.item_name} × {p.quantity}{p.remarks ? ` — ${p.remarks}` : ""}</span>)}
      </div>}
      <div className="mt-3 space-y-3">
        <div><h5 className="mb-1.5 flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-indigo-700"><MessageSquare size={12} /> Remarks ({remarks.length})</h5>
          {remarks.length ? remarks.map((r) => <RemarkCard key={r._id || r.createdAt} remark={r} />) : <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs italic text-slate-500">No remarks added for this stage.</p>}</div>
        <div><h5 className="mb-1.5 flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-slate-600"><Paperclip size={12} /> Attachments ({files.length}) {files.length > 0 && <span className="font-medium normal-case tracking-normal text-slate-400">— click a file to download</span>}</h5>
          {files.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">{files.map((f, i) => <FileCard key={`${f._id || f.file_name}-${i}`} file={f} onPreview={onPreview} />)}</div>
            : <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs italic text-slate-500">No attachments uploaded.</p>}</div>
      </div>
    </div>
  </div>;
}

function StageList({ doc, filter, onPreview }) {
  const rows = STAGES.map(([stage], index) => ({ stage, index, state: stageState(doc, scheduleEntry(doc, stage), stage) }))
    .filter(({ state }) => filter === "ALL" || state === filter || (filter === "DONE" && state === "LATE"));
  if (!rows.length) return <p className="px-4 py-5 text-xs italic text-slate-500">No stages match this filter.</p>;
  const known = new Set(STAGES.map(([stage]) => stage));
  const extras = filter === "ALL" ? Object.entries(attachmentMap(doc)).filter(([key, list]) => !known.has(key) && Array.isArray(list) && list.length) : [];
  return <>{rows.map(({ stage, index }) => <StageRow key={stage} doc={doc} stage={stage} index={index} onPreview={onPreview} />)}
    {extras.map(([key, list]) => <div key={key} className="border-t border-slate-100 px-4 py-4 print:break-inside-avoid"><h5 className="mb-1.5 flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-slate-600"><Paperclip size={12} /> {humanize(key)} ({list.length})</h5>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">{list.map((f, i) => <FileCard key={`${f._id || f.file_name}-${i}`} file={{ ...f, stage: key }} onPreview={onPreview} />)}</div></div>)}</>;
}

/* ───────────────────────── report ───────────────────────── */

const FILTERS = [["ALL", "All"], ["DONE", "Done"], ["PROG", "In progress"], ["OVER", "Overdue"], ["UP", "Upcoming"]];
const Shell = ({ children }) => createPortal(<div id="rfq-report-root" className="fixed inset-0 z-50 overflow-y-auto bg-slate-600/80 p-3 print:static print:bg-white print:p-0">{children}</div>, document.body);
const sourceName = (doc, rfq) => (doc === rfq ? "RFQ" : doc.workflow_number || doc.workflow_name || "Workflow");

export default function RfqReportView({ rfqId, onClose }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    let alive = true;
    api.get(`${ENDPOINTS.RFQ.BASE}/${rfqId}/report`)
      .then(({ data }) => { if (alive) setReport(data); })
      .catch((e) => { if (alive) setError(errorMessage(e, "Unable to load RFQ report")); });
    return () => { alive = false; };
  }, [rfqId]);

  const summary = useMemo(() => {
    if (!report) return null;
    const { rfq, workflows } = report;
    const docs = workflows;          // stages only exist on workflows; the RFQ itself is intake-only
    const sources = [...workflows, rfq];   // remarks / history are still collected from every record that has them
    const counts = { done: 0, total: 0, delayed: 0 };
    docs.forEach((doc) => {
      const { done, total } = progressOf(doc); counts.done += done; counts.total += total;
      STAGES.forEach(([stage]) => { const s = stageState(doc, scheduleEntry(doc, stage), stage); if (s === "LATE" || s === "OVER") counts.delayed += 1; });
    });
    const remarks = sources.flatMap((doc) => (doc.stage_remarks || []).map((r) => ({ ...r, source: sourceName(doc, rfq) }))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const history = sources.flatMap((doc) => (doc.stage_history || []).map((h) => ({ ...h, source: sourceName(doc, rfq) }))).sort((a, b) => new Date(a.completedAt || a.createdAt) - new Date(b.completedAt || b.createdAt));
    const awarded = workflows.filter((w) => w.rfq_status === "AWARDED");
    return {
      docs, counts, remarks, history,
      active: workflows.filter((w) => (w.lifecycle_status || "IN_PROGRESS") === "IN_PROGRESS").length,
      awardedCount: awarded.length, lost: workflows.filter((w) => w.rfq_status === "LOST").length,
      quoted: workflows.reduce((n, w) => n + Number(w.costing?.quoted_price || 0), 0),
      awardedValue: awarded.reduce((n, w) => n + Number(w.costing?.quoted_price || 0) * Number(w.purchase_order?.po_qty || 1), 0),
    };
  }, [report]);

  if (error) return <Shell><div className="mx-auto max-w-5xl rounded-xl bg-white p-5"><Alert>{error}</Alert><GhostButton onClick={onClose}>Close</GhostButton></div></Shell>;
  if (!report) return <Shell><div className="mx-auto mt-24 w-fit rounded-lg bg-white p-5 text-sm">Preparing report…</div></Shell>;

  const { rfq, workflows, attachments } = report;
  const pct = summary.counts.total ? Math.round((summary.counts.done / summary.counts.total) * 100) : 0;
  const kpis = [["Workflows", workflows.length], ["Active", summary.active], ["Awarded", summary.awardedCount], ["Lost", summary.lost], ["Stages done", summary.counts.total ? `${summary.counts.done} / ${summary.counts.total}` : "—"],
    ["Delayed / overdue", summary.counts.delayed], ["Remarks", summary.remarks.length], ["Attachments", attachments.length], ["Quoted value", summary.quoted ? formatMoney(summary.quoted) : "Not quoted yet"], ["Awarded value", summary.awardedValue ? formatMoney(summary.awardedValue) : "—"]];
  const overview = [["RFQ Number", rfq.rfq_number], ["Customer", rfq.customer], ["Project", rfq.project_name], ["RFQ Date", date(rfq.rfq_dated)], ["RFQ Target Date", rfq.rfq_target_date ? date(rfq.rfq_target_date) : "Not set — target date not given"], ["Status", rfq.register_status],
    ["Project Owner", rfq.project_owner?.name || rfq.project_lead], ["RFQ Send By – Name", rfq.rfq_send_by_name], ["RFQ Send By – Contact Number", rfq.rfq_send_by_contact_number], ["RFQ Send By – Email", rfq.rfq_send_by_email], ["Created", date(rfq.createdAt)], ["Last updated", date(rfq.updatedAt)]];
  const generated = report.generated_at ? new Date(report.generated_at) : new Date();

  return <Shell>
    <div className="mx-auto max-w-[210mm] bg-white shadow-2xl print:max-w-none print:shadow-none">
      <div className="sticky flex items-center justify-between gap-2 border-b bg-white p-3 print:hidden">
        <p className="text-xs text-slate-500">Detailed RFQ report · every stage, remark and attachment</p>
        <div className="flex gap-2"><GhostButton onClick={onClose}>Close</GhostButton><PrimaryButton onClick={() => window.print()}><Printer size={14} className="mr-1 inline" />Print / Save PDF</PrimaryButton></div>
      </div>
      <article className="space-y-5 p-8 text-slate-800 print:space-y-4 print:p-0">
        <header className="grid items-center gap-5 overflow-hidden rounded-lg bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-900 p-7 text-white shadow-md print:rounded-none print:shadow-none sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Technovision Industries · NPD Department</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">RFQ Report</h1>
            <p className="mt-1 text-sm text-slate-300">{rfq.rfq_number} · {rfq.project_name}</p>
            <div className="mt-4 flex flex-wrap gap-1.5 text-[11px] font-bold">
              {[`Customer: ${rfq.customer || "—"}`, `Owner: ${rfq.project_owner?.name || rfq.project_lead || "—"}`, `Status: ${rfq.register_status || "PENDING"}`, `RFQ date ${date(rfq.rfq_dated)}`].map((c) => <span key={c} className="rounded-full border border-white/20 bg-white/10 px-3 py-1">{c}</span>)}
            </div>
            <p className="mt-4 text-[11px] text-slate-400">Confidential · Generated {generated.toLocaleString("en-IN")}</p>
          </div>
          <div className="grid h-28 w-28 place-items-center justify-self-start rounded-full sm:justify-self-end" style={{ background: `conic-gradient(#818cf8 ${pct}%, rgba(255,255,255,.15) 0)` }}>
            <div className="grid h-[88px] w-[88px] place-items-center rounded-full bg-indigo-950 text-center text-[10px] text-indigo-200"><span><b className="block text-2xl leading-none text-white">{summary.counts.total ? `${pct}%` : "—"}</b>stages done</span></div>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5 print:break-inside-avoid">{kpis.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>)}</div>

        <Section no={1} title="RFQ Overview">
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">{overview.map(([label, value]) => <div key={label}><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-0.5 font-semibold ${value ? "" : "text-slate-400"}`}>{value || "Not provided"}</p></div>)}</div>
          <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6">{rfq.description || <span className="italic text-slate-500">No description provided.</span>}</p>
        </Section>

        <Section no={2} title="Part Structure" count={`${rfq.main_parts?.length || 0} main · ${(rfq.main_parts || []).reduce((n, p) => n + (p.sub_parts?.length || 0), 0)} sub`}>
          {(rfq.main_parts || []).length ? rfq.main_parts.map((part) => <div key={part._id} className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm print:break-inside-avoid">
            <div className="flex flex-wrap justify-between gap-2 font-bold"><span>{part.main_part_no}</span><span className="text-xs font-semibold text-slate-600">Annual volume: {part.volume_per_annum_nos} · Target {part.rfq_target_date ? date(part.rfq_target_date) : "not set"}</span></div>
            <p className="mt-1 text-slate-600">{part.description || <span className="italic">No description.</span>}</p>
            <Drawings files={part.drawing_attachments} stage={`Main part ${part.main_part_no}`} onPreview={setPreview} />
            {(part.sub_parts || []).map((sub) => <div key={sub._id} className="ml-4 mt-2 border-l-2 border-slate-200 pl-3"><p className="text-xs text-slate-600">• <b>{sub.sub_part_no}</b>{sub.description ? ` — ${sub.description}` : ""} · Qty {sub.qty_per_main_part}</p>
              <Drawings files={sub.drawing_attachments} stage={`Sub part ${sub.sub_part_no}`} onPreview={setPreview} /></div>)}
          </div>) : <p className="text-sm italic text-slate-500">No parts defined.</p>}
        </Section>

        <Section no={3} title="Workflow Progress" count={plural(workflows.length, "workflow")}>
          <div className="mb-4 flex flex-wrap gap-1.5 print:hidden">{FILTERS.map(([key, label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${filter === key ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300"}`}>{label}</button>)}</div>
          {summary.docs.length ? summary.docs.map((doc) => {
            const { done, total } = progressOf(doc);
            return <div key={doc._id} className="mb-5 overflow-hidden rounded-xl border border-slate-200">
              <div className="space-y-3 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-bold">{doc.workflow_number || doc.workflow_name}{doc.workflow_name && doc.workflow_number ? ` · ${doc.workflow_name}` : ""}</p>
                    <p className="text-xs text-slate-500">{`Started ${date(doc.createdAt)} · Initial target ${doc.initial_target_date ? date(doc.initial_target_date) : "Not set — target date not given"}`}</p></div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold">{humanize(doc.lifecycle_status || "IN_PROGRESS")} · {doc.rfq_status || "PENDING"}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                  <p>Current stage: <b>{doc.current_stage === "COMPLETED" ? "Completed" : stageLabel(doc.current_stage || "")}</b></p>
                  <p>Quoted: <b>{doc.costing?.quoted_price ? formatMoney(doc.costing.quoted_price) : "Not quoted yet"}</b></p>
                  <p>PO: <b>{doc.purchase_order?.po_number || "Not received"}</b></p>
                  <p>PO Qty: <b>{doc.purchase_order?.po_qty || "—"}</b></p>
                </div>
                <div><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${(done / total) * 100}%` }} /></div><p className="mt-1 text-[11px] text-slate-500">{done} of {total} stages completed</p></div>
              </div>
              <StageList doc={doc} filter={filter} onPreview={setPreview} />
            </div>;
          }) : <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-600"><p className="font-semibold text-slate-800">No workflow has been started for this RFQ yet.</p><p className="mt-1 text-xs">Stage targets, completion dates, remarks and attachments appear here once a batch workflow is started from the RFQ detail page.</p></div>}
        </Section>

        <Section no={4} title="Remarks Log" count={plural(summary.remarks.length, "remark")}>
          {summary.remarks.length ? summary.remarks.map((r) => <RemarkCard key={r._id || r.createdAt} remark={r} heading={`${stageLabel(r.stage)} · ${r.source}`} />) : <p className="text-sm italic text-slate-500">No remarks have been added to any stage yet.</p>}
        </Section>

        <Section no={5} title="Document Register" count={plural(attachments.length, "file")}>
          {attachments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-xs">
            <thead><tr className="border-b text-[10px] uppercase tracking-wide text-slate-500"><th className="py-2 pr-3">File</th><th className="pr-3">Stage / Source</th><th className="pr-3">Type</th><th className="pr-3">Size</th><th className="pr-3">Uploaded</th><th className="print:hidden" /></tr></thead>
            <tbody>{attachments.map((file, index) => { const { Icon, label } = KIND_VIEW[fileKind(file)];
              return <tr key={`${file._id || file.file_path || file.url || file.file_name}-${index}`} className="border-b border-slate-100 align-middle">
                <td className="py-2 pr-3"><span className="flex items-center gap-2 font-semibold"><Icon size={14} className="shrink-0 text-slate-500" /><button type="button" onClick={() => downloadFile(file)} className="break-all text-left text-indigo-700 hover:underline">{file.file_name}</button></span></td>
                <td className="pr-3 text-slate-600">{humanize(file.stage)}{file.source && file.source !== "RFQ" ? <span className="text-slate-400"> · {file.source}</span> : ""}</td>
                <td className="pr-3 text-slate-600">{label}</td><td className="pr-3 text-slate-600">{fileSize(file.file_size) || "—"}</td><td className="pr-3 text-slate-600">{file.uploaded_at ? formatDateTime(file.uploaded_at) : "—"}</td>
                <td className="whitespace-nowrap text-right print:hidden">{["image", "pdf"].includes(fileKind(file)) && <button type="button" onClick={() => setPreview(file)} className="mr-3 font-semibold text-slate-600 hover:underline">Preview</button>}<button type="button" onClick={() => downloadFile(file)} className="font-semibold text-indigo-600 hover:underline">Download</button></td>
              </tr>; })}</tbody></table></div> : <p className="text-sm italic text-slate-500">No attachments have been uploaded.</p>}
        </Section>

        <Section no={6} title="Activity Timeline" count={plural(summary.history.length, "event")}>
          {summary.history.length ? <div className="ml-1.5 border-l-2 border-slate-200 pl-5">{summary.history.map((h, i) => <div key={`${h.stage}-${i}`} className="relative mb-3 text-xs print:break-inside-avoid">
            <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-indigo-600" />
            <p><b>{stageLabel(h.stage)}</b> · {humanize(h.action)} <span className="text-slate-500">· {h.user?.name || "Unknown user"} · {formatDateTime(h.completedAt || h.createdAt)} · {h.source}</span></p>
            {h.note && <p className="mt-0.5 text-slate-600">{h.note}</p>}
          </div>)}</div> : <p className="text-sm italic text-slate-500">No stage has been completed yet.</p>}
        </Section>

        <footer className="px-1 pb-2 text-[11px] text-slate-500">Confidential · Internal RFQ/NPD report</footer>
      </article>
    </div>
    {preview && <PreviewModal file={preview} onClose={() => setPreview(null)} />}
    <style>{`@media print {
  @page { size: A4; margin: 12mm; @bottom-center { content: "Confidential · Page " counter(page) " of " counter(pages); font-size: 9px; color: #64748b; } }
  html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
  body > *:not(#rfq-report-root) { display: none !important; }
  #rfq-report-root { position: static !important; inset: auto !important; overflow: visible !important; height: auto !important; padding: 0 !important; background: #fff !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h2, h4, h5 { break-after: avoid; }
}`}</style>
  </Shell>;
}
