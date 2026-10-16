import { getStageStatus } from "./rfqWorkflow.js";

const COMPLETED_STAGE = "COMPLETED";

// What the register shows for an RFQ right now: the open stage's due date, whether it is late, and its newest remark.
export const currentStageInfo = (rfq) => {
  if (rfq.current_stage === COMPLETED_STAGE) return { due_date: null, status: "DONE", latest_remark: null };
  const entry = rfq.stage_schedule?.find((item) => item.stage === rfq.current_stage);
  const latest = [...(rfq.stage_remarks || [])].reverse().find((remark) => remark.stage === rfq.current_stage);
  return {
    due_date: entry?.target_date ?? null,
    status: getStageStatus(rfq, rfq.current_stage),
    latest_remark: latest ? { text: latest.text, user_name: latest.user_name, createdAt: latest.createdAt } : null,
  };
};
