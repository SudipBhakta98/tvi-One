import express from "express";
import { createPurchaseOrder,getAllPurchaseOrders,getProjectPurchaseOrders,getRfqPurchaseOrders,getPurchaseOrderById,editPurchaseOrder,deletePurchaseOrder } from "../controllers/purchaseController.js";
const router=express.Router();
router.post("/",createPurchaseOrder); router.get("/",getAllPurchaseOrders); router.get("/project/:projectID",getProjectPurchaseOrders); router.get("/rfq/:rfqItemID",getRfqPurchaseOrders); router.get("/:purchaseOrderID",getPurchaseOrderById); router.put("/:purchaseOrderID",editPurchaseOrder); router.delete("/:purchaseOrderID",deletePurchaseOrder);
export default router;