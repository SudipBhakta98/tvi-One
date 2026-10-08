import express from "express";
import {
  getOverviewDashboard,
  getRfqDashboard,
  getProjectDashboard,
  getProjectOperationalDashboard,
  getProductionDashboard,
  getPurchaseDashboard,
  getWarehouseDashboard,
  getDispatchDashboard,
  getFinanceDashboard,
  getDepartmentReport,
} from "../controllers/dashboardController.js";

const router = express.Router();
router.get("/overview", getOverviewDashboard);
router.get("/rfq", getRfqDashboard);
router.get("/projects", getProjectDashboard);
router.get("/project/:projectID", getProjectOperationalDashboard);
router.get("/production", getProductionDashboard);
router.get("/purchase", getPurchaseDashboard);
router.get("/warehouse", getWarehouseDashboard);
router.get("/dispatch", getDispatchDashboard);
router.get("/finance", getFinanceDashboard);
router.get("/reports", getDepartmentReport);
export default router;
