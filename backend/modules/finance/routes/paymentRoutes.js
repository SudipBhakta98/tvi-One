import express from "express";
import { createSinglePayment } from "../controllers/paymentController/createSinglePayment.js";
import { updatePayment } from "../controllers/paymentController/updatePayment.js";
import { updatePaymentStatus } from "../controllers/paymentController/updatePaymentStatus.js";
import { deletePayment } from "../controllers/paymentController/deletePayment.js";
import { getSearchPayment } from "../controllers/paymentController/searchPayment.js";
import { getPendingPayments } from "../controllers/paymentController/getPendingPayments.js";
import { getPayments } from "../controllers/paymentController/getPayments.js";
import { createSupplierAdvance } from "../controllers/paymentController/createSupplierAdvance.js";
import { getSupplierAdvances } from "../controllers/paymentController/getSupplierAdvances.js";
import { getSupplierAdvanceBalance } from "../controllers/paymentController/getSupplierAdvanceBalance.js";
import { getSupplierAdvanceDetails } from "../controllers/paymentController/getSupplierAdvanceDetails.js";
import { updateSupplierAdvanceStatus } from "../controllers/paymentController/updateSupplierAdvanceStatus.js";

const paymentRoutes = express.Router();

// Reads
paymentRoutes.get("/getPayments", getPayments);
paymentRoutes.get("/getPendingPayments", getPendingPayments);
paymentRoutes.get("/searchPayment", getSearchPayment);
paymentRoutes.get("/getSupplierAdvances", getSupplierAdvances);
paymentRoutes.get("/getSupplierAdvanceBalance", getSupplierAdvanceBalance);
paymentRoutes.get("/getSupplierAdvanceDetails/:id", getSupplierAdvanceDetails);


paymentRoutes.post("/createSinglePayment", createSinglePayment);
paymentRoutes.post("/createSupplierAdvance", createSupplierAdvance);

paymentRoutes.put("/updatePayment/:paymentId", updatePayment);
paymentRoutes.patch("/updatePaymentStatus/:paymentId", updatePaymentStatus);
paymentRoutes.patch("/updateSupplierAdvanceStatus/:id", updateSupplierAdvanceStatus);

paymentRoutes.delete("/deletePayment/:paymentId", deletePayment);

export default paymentRoutes;
