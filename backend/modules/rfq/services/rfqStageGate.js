import PurchaseOrder from "../../purchase/models/purchaseOrderModel.js";
import Component from "../models/componentModel.js";

export class StageLockedError extends Error {}

// A nested embedded field (technical_review, dfm_review, etc.) is merged
// shallowly rather than replaced outright, so a partial update like
// { technical_review: { status: "DONE" } } doesn't wipe target_date.
const mergeField = (existingValue, incomingValue) => {
  if (incomingValue && typeof incomingValue === "object" && !Array.isArray(incomingValue)) {
    const existingPlain = existingValue?.toObject ? existingValue.toObject() : existingValue;
    return { ...(existingPlain || {}), ...incomingValue };
  }
  return incomingValue;
};

// Builds a preview of the RFQ item after `updates` is applied, without
// saving — used only to evaluate whether a gate's prerequisite is satisfied,
// so a request can complete a prerequisite and advance the next stage in one go.
const previewMerge = (existingItem, updates) => {
  const preview = { ...existingItem.toObject() };
  for (const key of Object.keys(updates)) {
    preview[key] = mergeField(existingItem[key], updates[key]);
  }
  return preview;
};

// Throws StageLockedError with a human-readable reason if `updates` tries to
// advance a stage whose prerequisite stage(s) aren't complete yet.
export const assertStageUnlocked = async (existingItem, updates) => {
  const merged = previewMerge(existingItem, updates);

  if ("feasibility_status" in updates) {
    if (merged.technical_review?.status !== "DONE") {
      throw new StageLockedError("Technical review must be marked Done before setting feasibility.");
    }
    const rfqPurchaseCount = await PurchaseOrder.countDocuments({
      rfq_item: existingItem._id,
      purchase_type: "RFQ_NPD",
    });
    if (rfqPurchaseCount === 0) {
      throw new StageLockedError("At least one RFQ purchase (sample/trial material) is required before feasibility.");
    }
  }

  if (updates.dfm_review?.status && merged.feasibility_status !== "FEASIBLE") {
    throw new StageLockedError("Feasibility must be marked Feasible before starting DFM review.");
  }

  if (updates.commercial_review?.status && merged.dfm_review?.status !== "DONE") {
    throw new StageLockedError("DFM review must be marked Done before commercial review.");
  }

  if (updates.costing?.status && merged.commercial_review?.status !== "DONE") {
    throw new StageLockedError("Commercial review must be marked Done before costing.");
  }

  if (updates.rfq_status === "AWARDED" && merged.costing?.status !== "SUBMITTED_TO_CUSTOMER") {
    throw new StageLockedError("Costing must be submitted to the customer before the RFQ can be awarded.");
  }

  const advancingProto = ["PROTO_SUBMITTED", "PROTO_APPROVED"].includes(updates.proto_build?.status);
  const handingOver = updates.mass_production?.status === "HANDED_OVER";
  if (advancingProto || handingOver) {
    const componentCount = await Component.countDocuments({ rfq_item: existingItem._id });
    if (componentCount === 0) {
      throw new StageLockedError("At least one component must be selected (BOM) before this step.");
    }
  }

  if (updates.pilot_build?.status && merged.proto_build?.status !== "PROTO_APPROVED") {
    throw new StageLockedError("Prototype must be approved before pilot build.");
  }

  if (updates.mass_production?.status && merged.pilot_build?.status !== "APPROVED") {
    throw new StageLockedError("Pilot build must be approved before mass production approval.");
  }
};
