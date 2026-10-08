import express from "express";
import { getReceivablesAnalytics } from "../controllers/receivablesController/getReceivablesAnalytics.js";
import { createReceivable } from "../controllers/receivablesController/createReceivable.js";
import { updateReceivable } from "../controllers/receivablesController/updateReceivable.js";
import { deleteReceivable } from "../controllers/receivablesController/deleteReceivable.js";
import { getSearchReceivable } from "../controllers/receivablesController/searchReceivable.js";
import { getReceivableDetails } from "../controllers/receivablesController/getReceivableDetails.js";

const receivableRoutes = express.Router();

receivableRoutes.get("/getReceivablesAnalytics", getReceivablesAnalytics);
receivableRoutes.get("/getSearchReceivable", getSearchReceivable);
receivableRoutes.get("/getReceivableDetails", getReceivableDetails);
receivableRoutes.post("/createReceivable", createReceivable);
receivableRoutes.put("/updateReceivable/:id", updateReceivable);
receivableRoutes.delete("/deleteReceivable/:id", deleteReceivable);

export default receivableRoutes;
