import { Modal } from "../../../components/ui";
import RemarksPanel from "./RemarksPanel";
import { stageLabel } from "./rfqConfig";

/** Opened by the current stage's "Add remarks" button: the stage's earlier remarks plus a box to add another. */
export default function AddRemarkDialog({ stage, rfq, remarks, onReload, onClose }) {
  return <Modal open onClose={onClose} title={`Add remarks — ${stageLabel(stage)}`} subtitle={`${rfq.rfq_number} · ${rfq.project_name}`} size="md">
    <div className="max-h-[70vh] overflow-y-auto p-4">
      <RemarksPanel rfqId={rfq._id} stage={stage} remarks={remarks} onAdded={onReload} />
    </div>
  </Modal>;
}
