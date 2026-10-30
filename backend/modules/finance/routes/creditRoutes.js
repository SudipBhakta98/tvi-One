import express from "express";

import { getCreditNotes } from "../controllers/creditController/getCreditNotes.js";
import { createCredit } from "../controllers/creditController/createCredit.js";
import { updateCredit } from "../controllers/creditController/updateCredit.js";
import { deleteCredit } from "../controllers/creditController/deleteCredit.js";
import { getCreditDetails } from "../controllers/creditController/getCreditDetails.js";
import { getPendingAndPartialCredits } from "../controllers/creditController/getPendingAndPartialCredits.js";
import { canManageCreditNotes } from "../utils/creditNoteAuthorization.js";

const creditRoutes = express.Router();

const requireCreditNoteManager = (req, res, next) => {
  if (!canManageCreditNotes(req.user)) {
    return res.status(403).json({ success: false, message: "Only Super User and Admin can perform Credit Note operations." });
  }
  next();
};

creditRoutes.get("/getCreditNotes", getCreditNotes);
creditRoutes.post("/createCredit", requireCreditNoteManager, createCredit);
creditRoutes.put("/updateCredit/:creditNoteNumber", requireCreditNoteManager, updateCredit);
creditRoutes.delete("/deleteCredit/:creditNoteNumber", requireCreditNoteManager, deleteCredit);
creditRoutes.get("/getCreditDetails/:creditNoteNumber",getCreditDetails)
creditRoutes.get("/getPendingAndPartialCredits",getPendingAndPartialCredits)


export default creditRoutes;

