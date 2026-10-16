import express from "express";
import {
  createRfqItem, getAllRfqItems, getRfqItemById, updateRfqItem, deleteRfqItem, setTargets, transition, editStage, workflow, purchaseItems,
  addRemark, getOwners, getFilterOptions, getRfqReport,
} from "../controllers/rfqController.js";
import { allowRoles, loadRfq, requireUpdater, CREATE_ROLES, EDIT_ROLES, DELETE_ROLES, REPORT_ROLES } from "../services/rfqPermissions.js";

const router = express.Router();

// Every route with :rfqItemID first loads the RFQ inside the caller's scope (NPD users: only their own).
router.param("rfqItemID", loadRfq);

// Fixed paths are registered before /:rfqItemID so they are never read as an id.
router.get("/owners", allowRoles(...CREATE_ROLES, ...EDIT_ROLES), getOwners);
router.get("/filter-options", getFilterOptions);
router.get("/report", allowRoles(...REPORT_ROLES), getRfqReport);

router.post("/", allowRoles(...CREATE_ROLES), createRfqItem);
router.get("/", getAllRfqItems);
router.get("/:rfqItemID/workflow", workflow);
router.post("/:rfqItemID/remarks", addRemark);
router.post("/:rfqItemID/targets", requireUpdater, setTargets);
router.post("/:rfqItemID/transition", transition);              // stage-level check lives in canActOnStage
router.put("/:rfqItemID/stages/:stage", allowRoles(...EDIT_ROLES), editStage);   // correct a submitted stage
router.put("/:rfqItemID/purchase-items", purchaseItems);        // stage-level check lives in canActOnStage
router.get("/:rfqItemID", getRfqItemById);
router.put("/:rfqItemID", allowRoles(...EDIT_ROLES), updateRfqItem);
router.delete("/:rfqItemID", allowRoles(...DELETE_ROLES), deleteRfqItem);
export default router;