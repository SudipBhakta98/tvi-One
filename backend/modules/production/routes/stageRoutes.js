import express from "express";
import { listStages, createStage, updateStage } from "../controllers/stageController.js";
import { authorizeModule } from "../../../middleware/rbacMiddleware.js";
import { ROLES } from "../../../constants/roles.js";

const r = express.Router();
r.get("/", listStages);
r.post("/", authorizeModule(ROLES.PRODUCTION_MANAGER), createStage);
r.patch("/:stageID", authorizeModule(ROLES.PRODUCTION_MANAGER), updateStage);
export default r;
