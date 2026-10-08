import { useState } from "react";
import RfqStageCard from "./RfqStageCard";
import StageActionPanel from "./StageActionPanel";
import StageDetailsDialog from "./StageDetailsDialog";
import { ROLE_MAP, STAGES, stageState } from "./rfqConfig";

/** The 20 lifecycle stages as a 2-column × 10-row grid (column 1 = stages 1–10, column 2 = stages 11–20). */
export default function RfqStageGrid({ data, user, onComplete, onReload }) {
  const [viewedStage, setViewedStage] = useState(null);
  const { rfq, components, stage_schedule: schedule } = data;
  const entryOf = (stage) => schedule.find((item) => item.stage === stage);

  return <>
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 ">
      {STAGES.map(([stage, label, hasTarget], index) => {
        const entry = entryOf(stage);
        const isCurrent = stage === rfq.current_stage;
        const canEdit = Boolean(ROLE_MAP[user?.role]?.includes(stage));
        return <RfqStageCard
          key={stage}
          number={index + 1}
          label={label}
          hasTarget={hasTarget}
          entry={entry}
          state={stageState(entry, isCurrent)}
          remarks={rfq.stage_history?.find((event) => event.stage === stage)?.note}
          attachmentCount={rfq.stage_attachments?.[stage]?.length || 0}
          onView={() => setViewedStage(stage)}
        >
          {isCurrent
            ? (canEdit
              ? <StageActionPanel rfq={rfq} stage={stage} components={components} onComplete={onComplete} onReload={onReload} />
              : <p className="text-xs text-slate-600">Waiting for an Admin or Manager to complete this stage.</p>)
            : undefined}
        </RfqStageCard>;
      })}
    </div>
    {viewedStage && <StageDetailsDialog stage={viewedStage} rfq={rfq} entry={entryOf(viewedStage)} components={components} onClose={() => setViewedStage(null)} />}
  </>;
}
