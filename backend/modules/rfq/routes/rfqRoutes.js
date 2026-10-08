import express from "express";
import { createRfqItem, getAllRfqItems, getRfqItemById, updateRfqItem, deleteRfqItem, setTargets, transition, workflow, purchaseItems } from "../controllers/rfqController.js";
import { authorizeModule } from "../../../middleware/rbacMiddleware.js";
import { ROLES } from "../../../constants/roles.js";

const router = express.Router();
router.post("/", createRfqItem);
router.get("/", getAllRfqItems);
router.get("/:rfqItemID/workflow", workflow);
router.post("/:rfqItemID/targets", setTargets);
router.post("/:rfqItemID/transition", transition);
router.put("/:rfqItemID/purchase-items", purchaseItems);
router.get("/:rfqItemID", getRfqItemById);
router.put("/:rfqItemID", updateRfqItem);
router.delete("/:rfqItemID", authorizeModule(ROLES.NPD_MANAGER), deleteRfqItem);
export default router;
