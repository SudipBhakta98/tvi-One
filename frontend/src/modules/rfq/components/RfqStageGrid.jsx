import { useState } from "react";
import RfqStageCard from "./RfqStageCard";
import StageActionPanel from "./StageActionPanel";
import StageDetailsDialog from "./StageDetailsDialog";
import AddRemarkDialog from "./AddRemarkDialog";
import EditStageDialog from "./EditStageDialog";
import { ROLE_MAP, STAGES, stageState } from "./rfqConfig";

/** The 20 lifecycle stages as a 2-column × 10-row grid (column 1 = stages 1–10, column 2 = stages 11–20). */
export default function RfqStageGrid({ data, user, onComplete, onReload }) {
  const [viewedStage, setViewedStage] = useState(null);
  const [remarkStage, setRemarkStage] = useState(null);
  const [editingStage, setEditingStage] = useState(null);
  const { rfq, components, stage_schedule: schedule, permissions } = data;
  const entryOf = (stage) => schedule.find((item) => item.stage === stage);
  const remarksOf = (stage) => (rfq.stage_remarks || []).filter((remark) => remark.stage === stage);
  // Newest remark wins; the completion note is the fallback for stages finished before remarks existed.
  const latestRemark = (stage) => remarksOf(stage).at(-1)?.text || rfq.stage_history?.find((event) => event.stage === stage)?.note;

  return <>
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 ">
      {STAGES.map(([stage, label, hasTarget], index) => {
        const entry = entryOf(stage);
        const isCurrent = stage === rfq.current_stage;
        const canEdit = Boolean(permissions?.can_update || ROLE_MAP[user?.role]?.includes(stage));
        return <RfqStageCard
          key={stage}
          number={index + 1}
          label={label}
          hasTarget={hasTarget}
          entry={entry}
          state={stageState(entry, isCurrent)}
          remarks={latestRemark(stage)}
          remarkCount={remarksOf(stage).length}
          attachmentCount={rfq.stage_attachments?.[stage]?.length || 0}
          onView={() => setViewedStage(stage)}
          onAddRemark={() => setRemarkStage(stage)}
          onEdit={permissions?.can_edit ? () => setEditingStage(stage) : undefined}
        >
          {isCurrent
            ? (canEdit
              ? <StageActionPanel rfq={rfq} stage={stage} components={components} onComplete={onComplete} onReload={onReload} />
              : <p className="text-xs text-slate-600">Waiting for the project owner or an NPD Manager to complete this stage.</p>)
            : undefined}
        </RfqStageCard>;
      })}
    </div>
    {viewedStage && <StageDetailsDialog stage={viewedStage} rfq={rfq} entry={entryOf(viewedStage)} components={components} remarks={remarksOf(viewedStage)} onClose={() => setViewedStage(null)} />}
    {editingStage && <EditStageDialog
      stage={editingStage}
      rfq={rfq}
      entry={entryOf(editingStage)}
      onClose={() => setEditingStage(null)}
      onSaved={async () => { const edited = editingStage; setEditingStage(null); await onReload(); setViewedStage(edited); }} // reopen the details to show the new Updated At
    />}
    {remarkStage && <AddRemarkDialog stage={remarkStage} rfq={rfq} remarks={remarksOf(remarkStage)} onReload={onReload} onClose={() => setRemarkStage(null)} />}
  </>;
}
