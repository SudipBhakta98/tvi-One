import express from "express";
import {
  createRfqItem, getAllRfqItems, getRfqItemById, updateRfqItem, deleteRfqItem, getOwners, getFilterOptions, getRfqReport,
  getRfqWorkflows, createRfqWorkflow, getRfqWorkflowInstance, transitionWorkflowInstance, addWorkflowRemark, editWorkflowStage, workflowPurchaseItems,
} from "../controllers/rfqController.js";
import { allowRoles, loadRfq, CREATE_ROLES, EDIT_ROLES, DELETE_ROLES, REPORT_ROLES } from "../services/rfqPermissions.js";

const router = express.Router();

// Every route with :rfqItemID first loads the RFQ inside the caller's scope (NPD users: only their own).
router.param("rfqItemID", loadRfq);

// Fixed paths are registered before /:rfqItemID so they are never read as an id.
router.get("/owners", allowRoles(...CREATE_ROLES, ...EDIT_ROLES), getOwners);
router.get("/filter-options", getFilterOptions);
router.get("/report", allowRoles(...REPORT_ROLES), getRfqReport);

router.post("/", allowRoles(...CREATE_ROLES), createRfqItem);
router.get("/", getAllRfqItems);
router.get("/:rfqItemID/workflows", getRfqWorkflows);
router.post("/:rfqItemID/workflows", createRfqWorkflow);
router.get("/:rfqItemID/workflows/:workflowID", getRfqWorkflowInstance);
router.post("/:rfqItemID/workflows/:workflowID/transition", transitionWorkflowInstance);
router.post("/:rfqItemID/workflows/:workflowID/remarks", addWorkflowRemark);
router.put("/:rfqItemID/workflows/:workflowID/purchase-items", workflowPurchaseItems);
router.put("/:rfqItemID/workflows/:workflowID/stages/:stage", editWorkflowStage);
router.get("/:rfqItemID", getRfqItemById);
router.put("/:rfqItemID", allowRoles(...EDIT_ROLES), updateRfqItem);
router.delete("/:rfqItemID", allowRoles(...DELETE_ROLES), deleteRfqItem);
export default router;