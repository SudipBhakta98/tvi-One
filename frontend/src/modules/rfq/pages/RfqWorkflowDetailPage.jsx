import { useCallback, useEffect, useState } from "react";
import { Activity, IndianRupee, Layers, ListChecks } from "lucide-react";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { Alert, GhostButton, KpiCard } from "../../../components/ui";
import RfqFullPage from "../components/RfqFullPage";
import RfqParts from "../components/RfqParts";
import RfqStageGrid from "../components/RfqStageGrid";
import { STAGES, errorMessage, formatMoney, stageLabel } from "../components/rfqConfig";

/** Reuses the existing stage grid and dialogs, but points actions at an independent workflow instance. */
export default function RfqWorkflowDetailPage({ rfqId, workflowId, user, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await api.get(`${ENDPOINTS.RFQ.BASE}/${rfqId}/workflows/${workflowId}`);
      setData(response.data);
      setError("");
    } catch (e) {
      setError(errorMessage(e, "Unable to load workflow instance"));
    }
  }, [rfqId, workflowId]);

  useEffect(() => { load(); }, [load]);

  const reload = async () => {
    await load();
    onChanged?.();
  };
  const complete = async (stage, payload) => {
    const response = await api.post(`${ENDPOINTS.RFQ.BASE}/${rfqId}/workflows/${workflowId}/transition`, { stage, data: payload });
    setMessage(response.data.message || "Stage completed");
    await reload();
  };

  if (!data) return <RfqFullPage title="Workflow Instance" onClose={onClose}>{error ? <Alert>{error}</Alert> : <div className="p-2 text-xs text-slate-600">Loading...</div>}</RfqFullPage>;

  const { rfq, stage_schedule: schedule, permissions } = data;
  const doneCount = schedule.filter((item) => item.completed_date).length;
  const subPartCount = (rfq.main_parts || []).reduce((count, part) => count + (part.sub_parts?.length || 0), 0);
  const selectedMainCount = (rfq.main_parts || []).filter((part) => part.workflow_selected_main_part).length;

  return <RfqFullPage title={`${rfq.workflow_number || rfq.workflow_name || rfq.rfq_number} · ${rfq.project_name}`} subtitle={`${rfq.customer} · ${rfq.project_name} · Independent workflow`} onClose={onClose} actions={<GhostButton type="button" onClick={onClose}>Back to RFQ</GhostButton>}>
    {error && <Alert>{error}</Alert>}
    {message && <Alert type="success">{message}</Alert>}
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
      <KpiCard label="Stages Done" value={`${doneCount} / ${STAGES.length}`} hint="Workflow progress" tone="green" icon={ListChecks} />
      <KpiCard label="Current Stage" value={rfq.current_stage === "COMPLETED" ? "Completed" : stageLabel(rfq.current_stage)} hint="Open stage" tone="amber" icon={Activity} />
      <KpiCard label="Workflow Status" value={data.lifecycle_status || "IN_PROGRESS"} hint="Execution status" tone={(data.lifecycle_status || "IN_PROGRESS") === "IN_PROGRESS" ? "blue" : "amber"} />
      <KpiCard label="Quoted Value" value={rfq.costing?.quoted_price ? formatMoney(rfq.costing.quoted_price) : "—"} hint="Customer quote" tone="green" icon={IndianRupee} />
      <KpiCard label="Selected Parts" value={`${selectedMainCount} / ${subPartCount}`} hint="Selected main parts / subparts" tone="blue" icon={Layers} />
    </div>
    {(data.lifecycle_status && data.lifecycle_status !== "IN_PROGRESS" || data.parent_lifecycle_status && data.parent_lifecycle_status !== "ACTIVE") && <Alert>Workflow actions are locked because this workflow or its parent RFQ is not active. The current stage and history are preserved.</Alert>}
    <RfqStageGrid data={data} user={(data.lifecycle_status || "IN_PROGRESS") === "IN_PROGRESS" && (data.parent_lifecycle_status || "ACTIVE") === "ACTIVE" ? user : null} onComplete={complete} onReload={reload} />
    <RfqParts mainParts={rfq.main_parts || []} />
  </RfqFullPage>;
}
