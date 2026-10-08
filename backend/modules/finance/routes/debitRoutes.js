import express from "express";

// ⚠️ createDebit.js currently has no `export` statement at all (bug #1) —
// add `export const createDebit = ...` (or a default export) before this
// import will work.
import { createDebit } from "../controllers/debitController/createDebit.js";
import { editDebit } from "../controllers/debitController/updateDebit.js";
import { deleteDebit } from "../controllers/debitController/deleteDebit.js";

const debitRoutes = express.Router();

debitRoutes.post("/createDebit", createDebit);
debitRoutes.put("/editDebit/:id", editDebit);
debitRoutes.delete("/deleteDebit/:debitId", deleteDebit);

export default debitRoutes;
