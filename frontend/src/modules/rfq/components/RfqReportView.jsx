import { useEffect, useState } from "react";
import { AttachmentList } from "./AttachmentField";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { Alert, GhostButton, PrimaryButton } from "../../../components/ui";
import { errorMessage, formatDate, formatMoney, stageLabel } from "./rfqConfig";

export default function RfqReportView({ rfqId, onClose }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    api.get(`${ENDPOINTS.RFQ.BASE}/${rfqId}/report`)
      .then(({ data }) => { if (alive) setReport(data); })
      .catch((e) => { if (alive) setError(errorMessage(e, "Unable to load RFQ report")); });
    return () => { alive = false; };
  }, [rfqId]);

  if (error) return <div className="fixed inset-0 z-50 overflow-auto bg-slate-900/50 p-4"><div className="mx-auto max-w-5xl rounded-xl bg-white p-5"><Alert>{error}</Alert><GhostButton onClick={onClose}>Close</GhostButton></div></div>;
  if (!report) return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50"><div className="rounded-lg bg-white p-5 text-sm">Preparing report…</div></div>;

  const { rfq, workflows, attachments } = report;
  const date = (value) => value ? formatDate(value) : "—";
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-3 print:static print:bg-white print:p-0">
    <div className="mx-auto max-w-5xl bg-white shadow-xl print:max-w-none print:shadow-none">
      <div className="sticky top-0 z-10 flex justify-end gap-2 border-b bg-white p-3 print:hidden">
        <GhostButton onClick={onClose}>Close</GhostButton>
        <PrimaryButton onClick={() => window.print()}>Print / Save PDF</PrimaryButton>
      </div>
      <article className="space-y-7 p-8 text-slate-800 print:p-0">
        <header className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-800 p-7 text-white shadow-md print:rounded-none print:shadow-none">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Technovision Industries · NPD Department</p>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-black tracking-tight">RFQ Report</h1><p className="mt-2 text-sm text-slate-300">{rfq.rfq_number} · {rfq.project_name}</p></div><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">{rfq.register_status || "PENDING"}</span></div>
          <p className="mt-4 text-[11px] text-slate-400">Confidential · Generated {new Date().toLocaleString()}</p>
        </header>
        <section>
          <h2 className="mb-3 border-l-4 border-indigo-600 pl-3 text-lg font-black tracking-tight">RFQ Overview</h2>
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-sm md:grid-cols-3">
            {[["RFQ Number", rfq.rfq_number], ["Customer", rfq.customer], ["Project", rfq.project_name], ["RFQ Date", date(rfq.rfq_dated)], ["RFQ Target Date", date(rfq.rfq_target_date)], ["Status", rfq.register_status], ["Project Owner", rfq.project_owner?.name || rfq.project_lead], ["RFQ Send By – Name", rfq.rfq_send_by_name], ["RFQ Send By – Contact Number", rfq.rfq_send_by_contact_number], ["RFQ Send By – Email", rfq.rfq_send_by_email], ["Created", date(rfq.createdAt)], ["Updated", date(rfq.updatedAt)]].map(([label, value]) => <div key={label}><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value || "—"}</p></div>)}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{rfq.description}</p>
        </section>
        <section>
          <h2 className="mb-3 border-l-4 border-indigo-600 pl-3 text-lg font-black tracking-tight">Part Structure</h2>
          {(rfq.main_parts || []).map((part) => <div key={part._id} className="mb-2 rounded-lg border p-3 text-sm"><div className="flex justify-between font-bold"><span>{part.main_part_no}</span><span>Annual volume: {part.volume_per_annum_nos}</span></div><p className="mt-1 text-slate-600">{part.description}</p>{(part.sub_parts || []).map((sub) => <p key={sub._id} className="ml-4 mt-1 text-slate-600">• {sub.sub_part_no} — Qty {sub.qty_per_main_part}</p>)}</div>)}
        </section>
        <section>
          <h2 className="mb-3 border-l-4 border-indigo-600 pl-3 text-lg font-black tracking-tight">Workflow Summary</h2>
          {workflows.length ? workflows.map((workflow) => <div key={workflow._id} className="mb-4 rounded-lg border p-4">
            <div className="flex flex-wrap justify-between gap-2"><div><p className="font-bold">{workflow.workflow_number || workflow.workflow_name}</p><p className="text-xs text-slate-500">Started {date(workflow.createdAt)} · Initial target {date(workflow.initial_target_date)}</p></div><span className="text-sm font-bold">{workflow.lifecycle_status || "IN_PROGRESS"} · {workflow.rfq_status || "PENDING"}</span></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4"><p>Current stage: <b>{stageLabel(workflow.current_stage || "")}</b></p><p>Quoted: <b>{formatMoney(workflow.costing?.quoted_price || 0)}</b></p><p>PO: <b>{workflow.purchase_order?.po_number || "—"}</b></p><p>PO Qty: <b>{workflow.purchase_order?.po_qty || "—"}</b></p></div>
            <div className="mt-3 grid gap-1 sm:grid-cols-2">{(workflow.stage_schedule || []).map((stage) => <p key={stage.stage} className="border-b border-slate-100 py-1 text-xs">{stageLabel(stage.stage)} · Target {date(stage.target_date)} · Completed {date(stage.completed_date)}</p>)}</div>
          </div>) : <p className="text-sm text-slate-500">No batch workflows have been started.</p>}
        </section>
        <section>
          <h2 className="mb-3 border-l-4 border-indigo-600 pl-3 text-lg font-black tracking-tight">Performance Snapshot</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[["Total workflows", workflows.length], ["Active workflows", workflows.filter((w) => (w.lifecycle_status || "IN_PROGRESS") === "IN_PROGRESS").length], ["Awarded workflows", workflows.filter((w) => w.rfq_status === "AWARDED").length], ["Lost workflows", workflows.filter((w) => w.rfq_status === "LOST").length], ["Quoted value", formatMoney(workflows.reduce((n, w) => n + Number(w.costing?.quoted_price || 0), 0))], ["Awarded value", formatMoney(workflows.filter((w) => w.rfq_status === "AWARDED").reduce((n, w) => n + Number(w.costing?.quoted_price || 0) * Number(w.purchase_order?.po_qty || 1), 0))]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>)}</div>
        </section>
        <section>
          <h2 className="mb-3 border-l-4 border-indigo-600 pl-3 text-lg font-black tracking-tight">Document Register</h2>
          {attachments.length ? <div className="space-y-2">{attachments.map((file, index) => <div key={`${file.file_path || file.url || file.file_name}-${index}`} className="border-b py-2"><p className="mb-1 text-sm font-semibold">{file.file_name}</p><p className="mb-1 text-xs text-slate-500">{file.stage} · {file.file_type || "File"}</p><AttachmentList items={[file]} /></div>)}</div> : <p className="text-sm text-slate-500">No attachments.</p>}
        </section>
        <footer className="border-t pt-4 text-xs text-slate-500">Confidential · Internal RFQ/NPD report</footer>
      </article>
    </div>
    <style>{`@media print { @page { size: A4; margin: 14mm; } body { background: white !important; } }`}</style>
  </div>;
}
