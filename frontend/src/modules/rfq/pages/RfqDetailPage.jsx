import { useCallback, useEffect, useState } from "react";
import { Activity, IndianRupee, Layers, ListChecks, Pencil, Trash2 } from "lucide-react";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { Alert, GhostButton, KpiCard } from "../../../components/ui";
import RfqFullPage from "../components/RfqFullPage";
import RfqCreatePage from "./RfqCreatePage";
import RfqParts from "../components/RfqParts";
import RfqStageGrid from "../components/RfqStageGrid";
import {
  STAGES,
  errorMessage,
  formatMoney,
  stageLabel,
} from "../components/rfqConfig";

const COMPLETED_STAGE = "COMPLETED";

export default function RfqDetailPage({ rfqId, user, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.get(`${ENDPOINTS.RFQ.BASE}/${rfqId}/workflow`);
      setData(response.data);
      setError("");
    } catch (e) {
      setError(errorMessage(e, "Unable to load RFQ"));
    }
  }, [rfqId]);
  useEffect(() => {
    load();
  }, [load]);

  const reload = async () => {
    await load();
    onChanged?.();
  };
  // Throws on failure so the panel / dialog that triggered it can show the error next to the action.
  const complete = async (stage, payload) => {
    const response = await api.post(
      `${ENDPOINTS.RFQ.BASE}/${rfqId}/transition`,
      { stage, data: payload },
    );
    setMessage(response.data.message || "Stage completed");
    await reload();
  };

  if (!data)
    return (
      <RfqFullPage title="RFQ" onClose={onClose}>
        {error ? (
          <Alert>{error}</Alert>
        ) : (
          <div className="p-2 text-xs text-slate-600">Loading...</div>
        )}
      </RfqFullPage>
    );

  const { rfq, stage_schedule: schedule, permissions } = data;

  if (editing) {
    return <RfqCreatePage rfq={rfq} onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); await reload(); }} />;
  }

  // Edit / delete are offered by the server's permissions (edit: NPD Manager, Admin, Super User; delete: Admin, Super User).
  const remove = async () => {
    if (!window.confirm(`Delete RFQ ${rfq.rfq_number}? This cannot be undone.`)) return;
    try {
      await api.delete(`${ENDPOINTS.RFQ.BASE}/${rfqId}`);
      onChanged?.();
      onClose();
    } catch (e) {
      setError(errorMessage(e, "Unable to delete RFQ"));
    }
  };
  const current = rfq.current_stage;
  const doneCount = schedule.filter((item) => item.completed_date).length;
  const subPartCount = (rfq.main_parts || []).reduce(
    (count, part) => count + (part.sub_parts?.length || 0),
    0,
  );

  return (
    <RfqFullPage
      title={`${rfq.rfq_number} · ${rfq.project_name}`}
      subtitle={`${rfq.customer} · Project lead ${rfq.project_lead}`}
      onClose={onClose}
      actions={<>
        {permissions?.can_edit && <GhostButton type="button" onClick={() => setEditing(true)}><Pencil size={13} className="mr-1 inline" />Edit</GhostButton>}
        {permissions?.can_delete && <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"><Trash2 size={13} />Delete</button>}
      </>}
    >
      {error && <Alert>{error}</Alert>}
      {message && <Alert type="success">{message}</Alert>}

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
        <KpiCard
          label="Stages Done"
          value={`${doneCount} / ${STAGES.length}`}
          hint="Lifecycle progress"
          tone="green"
          icon={ListChecks}
        />
        <KpiCard
          label="Current Stage"
          value={
            current === COMPLETED_STAGE ? "Completed" : stageLabel(current)
          }
          hint="Open stage"
          tone="amber"
          icon={Activity}
        />
        <KpiCard
          label="RFQ Status"
          value={stageLabel(rfq.rfq_status)}
          hint="Customer outcome"
          tone="blue"
        />
        <KpiCard
          label="Quoted Value"
          value={
            rfq.costing?.quoted_price
              ? formatMoney(rfq.costing.quoted_price)
              : "—"
          }
          hint="Customer quote"
          tone="green"
          icon={IndianRupee}
        />
        <KpiCard
          label="Main / Sub Parts"
          value={`${rfq.main_parts?.length || 1} / ${subPartCount}`}
          hint="Part structure"
          tone="blue"
          icon={Layers}
        />
      </div>

      <RfqStageGrid
        data={data}
        user={user}
        onComplete={complete}
        onReload={reload}
      />
      <RfqParts
        mainParts={
          rfq.main_parts || [
            {
              main_part_no: rfq.main_part_no,
              sub_parts: rfq.sub_part_no
                ? [{ sub_part_no: rfq.sub_part_no }]
                : [],
            },
          ]
        }
      />
    </RfqFullPage>
  );
}
