import { useCallback, useEffect, useMemo, useState } from "react";
import { IndianRupee, Layers, Pencil, Plus, Trash2, Workflow, PauseCircle, PlayCircle, CheckCircle2, Ban } from "lucide-react";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { Alert, GhostButton, KpiCard, PrimaryButton } from "../../../components/ui";
import RfqFullPage from "../components/RfqFullPage";
import RfqCreatePage from "./RfqCreatePage";
import RfqWorkflowDetailPage from "./RfqWorkflowDetailPage";
import RfqParts from "../components/RfqParts";
import { errorMessage, formatMoney, formatDate, stageLabel } from "../components/rfqConfig";

const todayInput = () => new Date().toISOString().slice(0, 10);
const value = (number) => Number(number || 0);

export default function RfqDetailPage({ rfqId, user, onClose, onChanged }) {
  const [rfq, setRfq] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [showCreateWorkflow, setShowCreateWorkflow] = useState(false);
  const [initialTargetDate, setInitialTargetDate] = useState(todayInput());
  const [selectedMainParts, setSelectedMainParts] = useState({});
  const [selectedSubParts, setSelectedSubParts] = useState({});
  const [busy, setBusy] = useState(false);
  const [activeWorkflowId, setActiveWorkflowId] = useState("");
  const [workflowDropdown, setWorkflowDropdown] = useState("");

  const load = useCallback(async () => {
    try {
      const [rfqResponse, workflowResponse] = await Promise.all([
        api.get(`${ENDPOINTS.RFQ.BASE}/${rfqId}`),
        api.get(`${ENDPOINTS.RFQ.BASE}/${rfqId}/workflows`),
      ]);
      setRfq(rfqResponse.data);
      setWorkflows(workflowResponse.data || []);
      setError("");
    } catch (e) {
      setError(errorMessage(e, "Unable to load RFQ details"));
    }
  }, [rfqId]);

  useEffect(() => { load(); }, [load]);

  const reload = async () => {
    await load();
    onChanged?.();
  };

  const assigned = useMemo(() => {
    const mainIds = new Set();
    const subIds = new Set();
    for (const workflow of workflows) {
      for (const part of workflow.selected_parts || []) {
        if (part.main_part_selected) mainIds.add(String(part.main_part_id));
        for (const id of part.sub_part_ids || []) subIds.add(String(id));
      }
    }
    return { mainIds, subIds };
  }, [workflows]);

  const createWorkflow = async () => {
    const selected_parts = (rfq?.main_parts || []).map((main) => ({
      main_part_id: String(main._id),
      main_part_selected: Boolean(selectedMainParts[String(main._id)]),
      sub_part_ids: (main.sub_parts || []).filter((sub) => selectedSubParts[String(sub._id)]).map((sub) => String(sub._id)),
    })).filter((part) => part.main_part_selected || part.sub_part_ids.length > 0);

    if (!selected_parts.length) {
      setError("Select at least one available main part or subpart.");
      return;
    }
    if (!initialTargetDate) {
      setError("Set the initial target date before starting the workflow.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await api.post(`${ENDPOINTS.RFQ.BASE}/${rfqId}/workflows`, {
        selected_parts,
        initial_target_date: initialTargetDate,
      });
      const createdId = response.data?.workflow?._id;
      setSelectedMainParts({});
      setSelectedSubParts({});
      setShowCreateWorkflow(false);
      setMessage(`Batch workflow ${response.data?.workflow?.workflow_number || ""} started successfully.`);
      await reload();
      if (createdId) setActiveWorkflowId(createdId);
    } catch (e) {
      setError(errorMessage(e, "Unable to start batch workflow"));
    } finally {
      setBusy(false);
    }
  };

  if (activeWorkflowId) {
    return <RfqWorkflowDetailPage
      rfqId={rfqId}
      workflowId={activeWorkflowId}
      user={user}
      onClose={() => { setActiveWorkflowId(""); setWorkflowDropdown(""); }}
      onChanged={reload}
    />;
  }

  if (!rfq) return <RfqFullPage title="RFQ Details" onClose={onClose}>{error ? <Alert>{error}</Alert> : <div className="p-2 text-xs text-slate-600">Loading RFQ...</div>}</RfqFullPage>;
  if (editing) return <RfqCreatePage rfq={rfq} onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); await reload(); }} />;

  const mainParts = rfq.main_parts || [];
  const mainCount = mainParts.length;
  const subCount = mainParts.reduce((sum, part) => sum + (part.sub_parts?.length || 0), 0);
  const quotedTotal = workflows.reduce((sum, item) => sum + value(item.quoted_value), 0);
  const awardedTotal = workflows.reduce((sum, item) => sum + value(item.awarded_value), 0);
  const canCreateWorkflow = Boolean(rfq.permissions?.can_update) && (rfq.lifecycle_status || "ACTIVE") === "ACTIVE";
  const lifecycleStatus = rfq.lifecycle_status || "ACTIVE";

  const changeLifecycle = async (action) => {
    const labels = { PAUSE: "pause", RESUME: "resume", COMPLETE: "complete", CANCEL: "cancel" };
    const needsReason = action !== "RESUME";
    const reason = needsReason ? window.prompt(`Reason to ${labels[action]} RFQ ${rfq.rfq_number}:`) : "";
    if (needsReason && !reason?.trim()) return;
    const confirmation = window.confirm(`Are you sure you want to ${labels[action]} this RFQ? ${action === "PAUSE" ? "Running workflows will pause and can later resume from their current stages." : action === "RESUME" ? "Workflows paused by this RFQ will resume from their existing stages." : "All running workflows will be stopped, while their history remains available."}`);
    if (!confirmation) return;
    setBusy(true); setError("");
    try {
      await api.post(`${ENDPOINTS.RFQ.BASE}/${rfqId}/lifecycle`, { action, reason });
      setMessage(({ PAUSE: "RFQ paused successfully.", RESUME: "RFQ resumed successfully.", COMPLETE: "RFQ completed successfully.", CANCEL: "RFQ cancelled successfully." })[action]);
      await reload();
    } catch (e) { setError(errorMessage(e, `Unable to ${labels[action]} RFQ`)); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm(`Delete RFQ ${rfq.rfq_number}? This cannot be undone.`)) return;
    try {
      await api.delete(`${ENDPOINTS.RFQ.BASE}/${rfqId}`);
      onChanged?.();
      onClose();
    } catch (e) { setError(errorMessage(e, "Unable to delete RFQ")); }
  };

  return <RfqFullPage
    title={`${rfq.rfq_number} · ${rfq.project_name}`}
    subtitle={`${rfq.customer} · Project owner ${rfq.project_owner?.name || rfq.project_lead || "—"}`}
    onClose={onClose}
    actions={<>
      {rfq.permissions?.can_edit && <GhostButton type="button" onClick={() => setEditing(true)}><Pencil size={13} className="mr-1 inline" />Edit RFQ</GhostButton>}
      {rfq.permissions?.can_update && lifecycleStatus === "ACTIVE" && <GhostButton type="button" disabled={busy} onClick={() => changeLifecycle("PAUSE")}><PauseCircle size={13} className="mr-1 inline" />Pause RFQ</GhostButton>}
      {rfq.permissions?.can_update && lifecycleStatus === "PAUSED" && <PrimaryButton type="button" disabled={busy} onClick={() => changeLifecycle("RESUME")}><PlayCircle size={13} className="mr-1 inline" />Resume RFQ</PrimaryButton>}
      {rfq.permissions?.can_update && ["ACTIVE", "PAUSED"].includes(lifecycleStatus) && <GhostButton type="button" disabled={busy} onClick={() => changeLifecycle("COMPLETE")}><CheckCircle2 size={13} className="mr-1 inline" />Complete RFQ</GhostButton>}
      {rfq.permissions?.can_update && ["ACTIVE", "PAUSED"].includes(lifecycleStatus) && <button type="button" disabled={busy} onClick={() => changeLifecycle("CANCEL")} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"><Ban size={13} />Cancel RFQ</button>}
      {rfq.permissions?.can_delete && <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"><Trash2 size={13} />Delete</button>}
    </>}
  >
    {error && <Alert>{error}</Alert>}
    {message && <Alert type="success">{message}</Alert>}

    <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
      <KpiCard label="Main Part Qty" value={mainCount} hint="Parts in this RFQ" tone="blue" icon={Layers} />
      <KpiCard label="Sub Part Qty" value={subCount} hint="Subparts in this RFQ" tone="blue" />
      <KpiCard label="Total Quoted Value" value={formatMoney(quotedTotal)} hint="Sum of workflow quotes" tone="green" icon={IndianRupee} />
      <KpiCard label="Total Awarded Value" value={formatMoney(awardedTotal)} hint="Awarded workflow value" tone="green" icon={IndianRupee} />
      <KpiCard label="Batch Workflows" value={workflows.length} hint="Independently tracked" tone="blue" icon={Workflow} />
    </div>

    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900">RFQ Workflows</h3>
          <p className="mt-1 text-xs text-slate-600">RFQ creation does not start stages. Each batch starts only after parts are selected and an initial target date is set.</p>
          <p className="mt-1 text-xs font-semibold text-slate-700">RFQ Status: <span className={lifecycleStatus === "ACTIVE" ? "text-emerald-700" : lifecycleStatus === "PAUSED" ? "text-amber-700" : "text-rose-700"}>{lifecycleStatus}</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="All Workflows" value={workflowDropdown} onChange={(event) => { setWorkflowDropdown(event.target.value); if (event.target.value) setActiveWorkflowId(event.target.value); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
            <option value="">All Workflows</option>
            {workflows.map((item) => <option key={item._id} value={item._id}>{item.workflow_number || item.workflow_name}</option>)}
          </select>
          {canCreateWorkflow && <PrimaryButton type="button" onClick={() => { setShowCreateWorkflow((value) => !value); setError(""); }}><Plus size={14} className="mr-1 inline" />Create Batch Workflow</PrimaryButton>}
        </div>
      </div>

      {showCreateWorkflow && canCreateWorkflow && <div className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Initial Target Date <span className="text-rose-600">*</span></label>
            <input type="date" required value={initialTargetDate} onChange={(event) => setInitialTargetDate(event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-400 md:max-w-xs" />
            <p className="mt-1 text-[11px] text-slate-500">This becomes the target date for the first active stage, Document Review.</p>
          </div>
          <PrimaryButton type="button" disabled={busy} onClick={createWorkflow}>{busy ? "Starting..." : "Start Workflow"}</PrimaryButton>
        </div>
        <div className="space-y-2">
          {mainParts.map((main) => {
            const mainId = String(main._id);
            const mainAssigned = assigned.mainIds.has(mainId);
            return <div key={mainId} className="rounded-md border border-slate-200 bg-white p-3">
              <label className={`flex items-center gap-2 text-xs font-bold ${mainAssigned ? "text-slate-400" : "text-slate-800"}`}>
                <input type="checkbox" disabled={mainAssigned} checked={Boolean(selectedMainParts[mainId])} onChange={(event) => setSelectedMainParts((current) => ({ ...current, [mainId]: event.target.checked }))} />
                {main.main_part_no} <span className="font-normal text-slate-500">(main part)</span>
                {mainAssigned && <span className="ml-auto text-[10px] font-bold text-amber-600">Already assigned</span>}
              </label>
              {(main.sub_parts || []).length > 0 && <div className="ml-6 mt-2 grid gap-2 sm:grid-cols-2">
                {main.sub_parts.map((sub) => {
                  const subId = String(sub._id);
                  const subAssigned = assigned.subIds.has(subId);
                  return <label key={subId} className={`flex items-center gap-2 text-xs ${subAssigned ? "text-slate-400" : "text-slate-700"}`}>
                    <input type="checkbox" disabled={subAssigned} checked={Boolean(selectedSubParts[subId])} onChange={(event) => setSelectedSubParts((current) => ({ ...current, [subId]: event.target.checked }))} />
                    {sub.sub_part_no}
                    {subAssigned && <span className="text-[10px] font-bold text-amber-600">Assigned</span>}
                  </label>;
                })}
              </div>}
            </div>;
          })}
        </div>
      </div>}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[850px] text-left text-xs">
          <thead className="bg-slate-100 text-slate-600"><tr>
            <th className="px-3 py-2">Workflow Number</th><th className="px-3 py-2">Main Part Qty</th><th className="px-3 py-2">Sub Part Qty</th><th className="px-3 py-2">Quoted Value</th><th className="px-3 py-2">Awarded Value</th><th className="px-3 py-2">Current Stage</th><th className="px-3 py-2">Remarks</th><th className="px-3 py-2">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {workflows.map((item) => <tr key={item._id} onClick={() => setActiveWorkflowId(item._id)} className="cursor-pointer hover:bg-slate-50">
              <td className="px-3 py-2 font-semibold text-indigo-600">{item.workflow_number || item.workflow_name}</td>
              <td className="px-3 py-2">{item.main_part_qty ?? 0}</td>
              <td className="px-3 py-2">{item.sub_part_qty ?? 0}</td>
              <td className="px-3 py-2 font-semibold text-emerald-700">{formatMoney(item.quoted_value)}</td>
              <td className="px-3 py-2 font-semibold text-emerald-700">{formatMoney(item.awarded_value)}</td>
              <td className="px-3 py-2">{item.current_stage ? stageLabel(item.current_stage) : "Not started"}</td>
              <td className="max-w-[220px] truncate px-3 py-2" title={item.latest_remark?.text}>{item.latest_remark?.text || "—"}</td>
              <td className="px-3 py-2">{item.lifecycle_status && item.lifecycle_status !== "IN_PROGRESS" ? item.lifecycle_status : (item.rfq_status || "IN_PROGRESS")}</td>
            </tr>)}
            {!workflows.length && <tr><td colSpan={8} className="px-3 py-5 text-center text-slate-500">No batch workflows yet. Create the first workflow when the required parts are ready.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    <RfqParts mainParts={mainParts} />
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
      <div className="grid gap-2 sm:grid-cols-3"><div><span className="font-bold text-slate-800">RFQ Date:</span> {formatDate(rfq.rfq_dated)}</div><div><span className="font-bold text-slate-800">Project Owner:</span> {rfq.project_owner?.name || rfq.project_lead || "—"}</div><div><span className="font-bold text-slate-800">Description:</span> {rfq.description || "—"}</div></div>
    </div>
  </RfqFullPage>;
}
