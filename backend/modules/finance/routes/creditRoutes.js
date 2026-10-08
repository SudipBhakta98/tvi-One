import express from "express";

import { getCreditNotes } from "../controllers/creditController/getCreditNotes.js";
import { createCredit } from "../controllers/creditController/createCredit.js";
import { updateCredit } from "../controllers/creditController/updateCredit.js";
import { deleteCredit } from "../controllers/creditController/deleteCredit.js";
import { getCreditDetails } from "../controllers/creditController/getCreditDetails.js";
import { getPendingAndPartialCredits } from "../controllers/creditController/getPendingAndPartialCredits.js";

const creditRoutes = express.Router();

creditRoutes.get("/getCreditNotes", getCreditNotes);
creditRoutes.post("/createCredit", createCredit);
creditRoutes.put("/updateCredit/:creditNoteNumber", updateCredit);
creditRoutes.delete("/deleteCredit/:creditNoteNumber", deleteCredit);
creditRoutes.get("/getCreditDetails/:creditNoteNumber",getCreditDetails)
creditRoutes.get("/getPendingAndPartialCredits",getPendingAndPartialCredits)


export default creditRoutes;

