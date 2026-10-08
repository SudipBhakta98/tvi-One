import { useState } from "react";
import { Alert, GhostButton, Modal, PrimaryButton } from "../../../components/ui";
import { FormField, TextInput } from "./FormControls";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { PHASE_TITLE, TARGET_PHASES, stageLabel } from "./rfqConfig";

/** Asks for a target date for every stage of the next phase. Mount it only while it should be open. */
export default function TargetDatesDialog({ phase, onClose, onConfirm }) {
  const stages = TARGET_PHASES[phase] || [];
  const [dates, setDates] = useState({});
  const { run, busy, error } = useAsyncAction();

  const confirm = () => run(async () => {
    if (stages.some((stage) => !dates[stage])) throw new Error("Set a target date for every stage listed.");
    await onConfirm(stages.map((stage) => ({ stage, target_date: dates[stage] })));
  });

  return <Modal open onClose={onClose} title={`Target dates · ${PHASE_TITLE[phase]}`} subtitle="Set the target date for each upcoming stage before continuing.">
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-3">
        {stages.map((stage) => <FormField key={stage} label={stageLabel(stage)}>
          <TextInput type="date" required value={dates[stage] || ""} onChange={(e) => setDates((current) => ({ ...current, [stage]: e.target.value }))} />
        </FormField>)}
      </div>
      <div className="flex justify-end gap-2">
        <GhostButton type="button" onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton disabled={busy} onClick={confirm}>{busy ? "Saving..." : "Save & Continue"}</PrimaryButton>
      </div>
    </div>
  </Modal>;
}
