import express from "express";
import { getPayablesAnalytics } from "../controllers/payablesController/getPayablesAnalytics.js";
import { createPayable } from "../controllers/payablesController/createPayable.js";
import { updatePayable } from "../controllers/payablesController/updatePayable.js";
import { deletePayable } from "../controllers/payablesController/deletePayable.js";
import { getSearchPayable } from "../controllers/payablesController/searchPayable.js";
// Was previously imported nowhere — the controller existed but had no route.
import { getPayableDetails } from "../controllers/payablesController/getPayableDetails.js";

const payableRoutes = express.Router();

payableRoutes.get("/getPayablesAnalytics", getPayablesAnalytics);
payableRoutes.get("/getSearchPayable", getSearchPayable);
payableRoutes.get("/getPayableDetails", getPayableDetails);
payableRoutes.post("/createPayable", createPayable);
payableRoutes.put("/updatePayable/:id", updatePayable);
payableRoutes.delete("/deletePayable/:id", deletePayable);

export default payableRoutes;
