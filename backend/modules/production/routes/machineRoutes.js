import express from "express";
import { listMachines, createMachine, updateMachine } from "../controllers/machineController.js";
import { authorizeModule } from "../../../middleware/rbacMiddleware.js";
import { ROLES } from "../../../constants/roles.js";

const r = express.Router();
r.get("/", listMachines);
r.post("/", authorizeModule(ROLES.PRODUCTION_MANAGER), createMachine);
r.patch("/:machineID", authorizeModule(ROLES.PRODUCTION_MANAGER), updateMachine);
export default r;
