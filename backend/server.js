import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from 'morgan';
import dotenv from "dotenv";
import connectDB from "./config/dbConfig.js";
import { authenticate } from "./middleware/authMiddleware.js";
import { requireRoles, authorizeModule, deptWriteGuard, anyManagerWriteGuard } from "./middleware/rbacMiddleware.js";
import { ROLES, ALL_ROLES, DEPARTMENTS } from "./constants/roles.js";

import authRoutes from "./modules/auth/authRoutes.js";
import adminRoutes from "./modules/admin/adminRoutes.js";
import rfqRoutes from "./modules/rfq/routes/rfqRoutes.js";
import componentRoutes from "./modules/rfq/routes/componentRoutes.js";
import projectRoutes from "./modules/project/routes/projectRoutes.js";
import purchaseRoutes from "./modules/purchase/routes/purchaseRoutes.js";
import productionRoutes from "./modules/production/routes/productionRoutes.js";
import stageRoutes from "./modules/production/routes/stageRoutes.js";
import machineRoutes from "./modules/production/routes/machineRoutes.js";
import dispatchRoutes from "./modules/dispatch/routes/dispatchRoutes.js";
import warehouseRoutes from "./modules/warehouse/routes/warehouseRoutes.js";
import dashboardRoutes from "./modules/dashboard/routes/dashboardRoutes.js";
import { auditRequest } from "./middleware/auditMiddleware.js";

// --- Finance module (integrated as-is, business logic untouched) ---
import payableRoutes from "./modules/finance/routes/payableRoutes.js";
import paymentRoutes from "./modules/finance/routes/paymentRoutes.js";
import debitRoutes from "./modules/finance/routes/debitRoutes.js";
import creditRoutes from "./modules/finance/routes/creditRoutes.js";
import receivableRoutes from "./modules/finance/routes/receivableRoutes.js";
import collectionRoutes from "./modules/finance/routes/collectionRoutes.js";
import { mapFinanceUser } from "./modules/finance/middleware/mapFinanceUser.js";

dotenv.config();
const app = express();

// --- Cost-optimized middleware stack -------------------------------------
// helmet: security headers at ~0 runtime cost.
// compression: gzip responses -> lower egress/bandwidth cost on cheap hosting.
// json limit kept small -> smaller memory footprint per request.
app.use(helmet());
app.use(compression());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan('dev'));
app.get("/api/health", (req, res) => res.json({ success: true, service: "TVI One ERP API", timestamp: new Date().toISOString() }));

// Public
app.use("/api/auth", authRoutes);

// Administration — ADMIN only. SUPER_USER is deliberately NOT included here:
// super users can operate every module but cannot manage users/sessions/logs.
app.use("/api/admin", authenticate, requireRoles(ROLES.ADMIN), adminRoutes);

app.use(authenticate);
app.use(auditRequest);

// --- NPD department (RFQ + prototype components) --------------------------
app.use("/api/rfq", authorizeModule(ROLES.NPD_MANAGER, ROLES.NPD_USER), deptWriteGuard(DEPARTMENTS.NPD), rfqRoutes);
app.use("/api/components", authorizeModule(ROLES.NPD_MANAGER, ROLES.NPD_USER, ROLES.SCM_MANAGER, ROLES.SCM_USER), deptWriteGuard(DEPARTMENTS.NPD), componentRoutes);

// --- Cross-department register --------------------------------------------
app.use("/api/projects", authorizeModule(...ALL_ROLES), anyManagerWriteGuard(), projectRoutes);

// --- SCM department (Purchase) ---------------------------------------------
app.use("/api/purchases", authorizeModule(ROLES.SCM_MANAGER, ROLES.SCM_USER), deptWriteGuard(DEPARTMENTS.SCM), purchaseRoutes);

// --- Production department --------------------------------------------------
app.use("/api/production", authorizeModule(ROLES.PRODUCTION_MANAGER, ROLES.PRODUCTION_USER), deptWriteGuard(DEPARTMENTS.PRODUCTION), productionRoutes);
app.use("/api/stages", authorizeModule(ROLES.PRODUCTION_MANAGER, ROLES.PRODUCTION_USER), deptWriteGuard(DEPARTMENTS.PRODUCTION), stageRoutes);
app.use("/api/machines", authorizeModule(ROLES.PRODUCTION_MANAGER, ROLES.PRODUCTION_USER), deptWriteGuard(DEPARTMENTS.PRODUCTION), machineRoutes);

// --- Warehouse department ----------------------------------------------------
app.use("/api/warehouse", authorizeModule(ROLES.WAREHOUSE_MANAGER, ROLES.WAREHOUSE_USER), deptWriteGuard(DEPARTMENTS.WAREHOUSE), warehouseRoutes);

// --- Dispatch department ------------------------------------------------------
app.use("/api/dispatch", authorizeModule(ROLES.DISPATCH_MANAGER, ROLES.DISPATCH_USER), deptWriteGuard(DEPARTMENTS.DISPATCH), dispatchRoutes);

// --- Finance department (integrated finance application) ---------------------
// Route files/controllers/models below are copied unmodified from the
// standalone finance application. authorizeModule + deptWriteGuard enforce
// the same "managers edit/delete, users read/create" rule as every other
// department; mapFinanceUser then adapts req.user into the shape the
// untouched finance controllers already expect.
const financeAccess = [authorizeModule(ROLES.FINANCE_MANAGER, ROLES.FINANCE_USER), deptWriteGuard(DEPARTMENTS.FINANCE), mapFinanceUser];
app.use("/api/finance/payable", ...financeAccess, payableRoutes);
app.use("/api/finance/payment", ...financeAccess, paymentRoutes);
app.use("/api/finance/debit", ...financeAccess, debitRoutes);
app.use("/api/finance/credit", ...financeAccess, creditRoutes);
app.use("/api/finance/receivable", ...financeAccess, receivableRoutes);
app.use("/api/finance/collection", ...financeAccess, collectionRoutes);

// Short-lived cache for read-only dashboard aggregates. This reduces duplicate
// database work when many users open the control tower at the same time.
const dashboardCache = new Map();
app.use("/api/dashboard", (req, res, next) => {
  if (req.method !== "GET") return next();
  const key = `${req.originalUrl}|${req.user?._id || ""}`;
  const hit = dashboardCache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    res.set("X-Dashboard-Cache", "HIT");
    return res.status(hit.status).json(hit.body);
  }
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    dashboardCache.set(key, { status: res.statusCode || 200, body, expiresAt: Date.now() + 10000 });
    if (dashboardCache.size > 250) {
      const oldest = dashboardCache.keys().next().value;
      if (oldest) dashboardCache.delete(oldest);
    }
    res.set("X-Dashboard-Cache", "MISS");
    return originalJson(body);
  };
  next();
});

// --- Dashboard (read-only aggregate views, open to every authenticated role)
app.use("/api/dashboard", authorizeModule(...ALL_ROLES), dashboardRoutes);

app.use((err, req, res, next) => {
  console.error("[ERROR]", err);
  res.status(500).json({ success: false, message: "Internal server error", error: process.env.NODE_ENV === "production" ? undefined : err.message });
});

const port = process.env.PORT || 5000;
connectDB()
  .then(() => app.listen(port, () => console.log(`TVI One API running on http://localhost:${port}`)))
  .catch((e) => { console.error("DB connection failed:", e.message); process.exit(1); });