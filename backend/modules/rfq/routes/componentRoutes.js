import express from "express";
import {addComponent,getComponentById,getProjectComponents,getRfqComponents,getWorkflowComponents,editComponent,deleteComponent} from "../controllers/componentController.js";
const router=express.Router();
router.post("/",addComponent); router.get("/project/:projectID",getProjectComponents); router.get("/rfq/:rfqItemID",getRfqComponents); router.get("/workflow/:workflowID",getWorkflowComponents); router.get("/:componentID",getComponentById); router.put("/:componentID",editComponent); router.delete("/:componentID",deleteComponent);
export default router;
