
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import connectDB from "./config/dbConfig.js";
import { authenticate } from "./middleware/authMiddleware.js";
import {
  requireRoles,
  authorizeModule,
  deptWriteGuard,
  anyManagerWriteGuard,
} from "./middleware/rbacMiddleware.js";
import {
  ROLES,
  ALL_ROLES,
  DEPARTMENTS,
  DEPARTMENT_ROLES,
} from "./constants/roles.js";

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
import attendanceRoutes from "./modules/attendance/routes/attendanceRoutes.js";
import { auditRequest } from "./middleware/auditMiddleware.js";

// Finance module
import payableRoutes from "./modules/finance/routes/payableRoutes.js";
import paymentRoutes from "./modules/finance/routes/paymentRoutes.js";
import debitRoutes from "./modules/finance/routes/debitRoutes.js";
import creditRoutes from "./modules/finance/routes/creditRoutes.js";
import receivableRoutes from "./modules/finance/routes/receivableRoutes.js";
import collectionRoutes from "./modules/finance/routes/collectionRoutes.js";
import { mapFinanceUser } from "./modules/finance/middleware/mapFinanceUser.js";

dotenv.config();

const app = express();

// ======================================================
// LOCAL DOCUMENT STORAGE
// ======================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Expected structure:
// TVI-ERP/
//   backend/
//     server.js
//   frontend/
//   storage/
//     uploads/

const PROJECT_ROOT = path.resolve(__dirname, "..");

export const UPLOADS_DIR = path.resolve(
  process.env.UPLOADS_DIR ||
  path.join(PROJECT_ROOT, "storage", "uploads")
);

// Create upload directory automatically
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

console.log("[STORAGE] Upload directory:", UPLOADS_DIR);

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(helmet());
app.use(compression());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  })
);

const ATTENDANCE_UPLOAD_LIMIT = "30mb";

app.use(
  "/api/attendance/upload",
  authenticate,
  express.json({ limit: ATTENDANCE_UPLOAD_LIMIT })
);

app.use(express.json({ limit: "10mb" }));

app.use(morgan("dev"));

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "TVI One ERP API",
    timestamp: new Date().toISOString(),
  });
});

// ======================================================
// PUBLIC ROUTES
// ======================================================

app.use("/api/auth", authRoutes);

// ======================================================
// ADMIN ROUTES
// ======================================================

app.use(
  "/api/admin",
  authenticate,
  requireRoles(ROLES.ADMIN),
  adminRoutes
);

// ======================================================
// AUTHENTICATED ROUTES
// ======================================================

app.use(authenticate);
app.use(auditRequest);

// ======================================================
// NPD - RFQ
// ======================================================

app.use(
  "/api/rfq",
  authorizeModule(...DEPARTMENT_ROLES.NPD),
  rfqRoutes
);

app.use(
  "/api/components",
  authorizeModule(
    ...DEPARTMENT_ROLES.NPD,
    ROLES.SCM_MANAGER,
    ROLES.SCM_USER
  ),
  deptWriteGuard(DEPARTMENTS.NPD),
  componentRoutes
);

// ======================================================
// PROJECTS
// ======================================================

app.use(
  "/api/projects",
  authorizeModule(...ALL_ROLES),
  anyManagerWriteGuard(),
  projectRoutes
);

// ======================================================
// PURCHASE
// ======================================================

app.use(
  "/api/purchases",
  authorizeModule(ROLES.SCM_MANAGER, ROLES.SCM_USER),
  deptWriteGuard(DEPARTMENTS.SCM),
  purchaseRoutes
);

// ======================================================
// PRODUCTION
// ======================================================

app.use(
  "/api/production",
  authorizeModule(
    ROLES.PRODUCTION_MANAGER,
    ROLES.PRODUCTION_USER
  ),
  deptWriteGuard(DEPARTMENTS.PRODUCTION),
  productionRoutes
);

app.use(
  "/api/stages",
  authorizeModule(
    ROLES.PRODUCTION_MANAGER,
    ROLES.PRODUCTION_USER
  ),
  deptWriteGuard(DEPARTMENTS.PRODUCTION),
  stageRoutes
);

app.use(
  "/api/machines",
  authorizeModule(
    ROLES.PRODUCTION_MANAGER,
    ROLES.PRODUCTION_USER
  ),
  deptWriteGuard(DEPARTMENTS.PRODUCTION),
  machineRoutes
);

// ======================================================
// WAREHOUSE
// ======================================================

app.use(
  "/api/warehouse",
  authorizeModule(
    ROLES.WAREHOUSE_MANAGER,
    ROLES.WAREHOUSE_USER
  ),
  deptWriteGuard(DEPARTMENTS.WAREHOUSE),
  warehouseRoutes
);

// ======================================================
// DISPATCH
// ======================================================

app.use(
  "/api/dispatch",
  authorizeModule(
    ROLES.DISPATCH_MANAGER,
    ROLES.DISPATCH_USER
  ),
  deptWriteGuard(DEPARTMENTS.DISPATCH),
  dispatchRoutes
);

// ======================================================
// FINANCE
// ======================================================

const financeAccess = [
  authorizeModule(
    ROLES.FINANCE_MANAGER,
    ROLES.FINANCE_USER
  ),
  deptWriteGuard(DEPARTMENTS.FINANCE),
  mapFinanceUser,
];

app.use("/api/finance/payable", ...financeAccess, payableRoutes);
app.use("/api/finance/payment", ...financeAccess, paymentRoutes);
app.use("/api/finance/debit", ...financeAccess, debitRoutes);
app.use("/api/finance/credit", ...financeAccess, creditRoutes);
app.use("/api/finance/receivable", ...financeAccess, receivableRoutes);
app.use("/api/finance/collection", ...financeAccess, collectionRoutes);

// ======================================================
// ATTENDANCE
// ======================================================

app.use(
  "/api/attendance",
  authorizeModule(...DEPARTMENT_ROLES.HR),
  deptWriteGuard(DEPARTMENTS.HR, {
    allowUserCreate: false,
  }),
  attendanceRoutes
);

// ======================================================
// DASHBOARD CACHE
// ======================================================

const dashboardCache = new Map();

app.use("/api/dashboard", (req, res, next) => {
  if (req.method !== "GET") {
    return next();
  }

  const key = `${req.originalUrl}|${req.user?._id || ""}`;

  const hit = dashboardCache.get(key);

  if (hit && hit.expiresAt > Date.now()) {
    res.set("X-Dashboard-Cache", "HIT");
    return res.status(hit.status).json(hit.body);
  }

  const originalJson = res.json.bind(res);

  res.json = (body) => {
    dashboardCache.set(key, {
      status: res.statusCode || 200,
      body,
      expiresAt: Date.now() + 10000,
    });

    if (dashboardCache.size > 250) {
      const oldest = dashboardCache.keys().next().value;

      if (oldest) {
        dashboardCache.delete(oldest);
      }
    }

    res.set("X-Dashboard-Cache", "MISS");

    return originalJson(body);
  };

  next();
});

// ======================================================
// DASHBOARD ROUTES
// ======================================================

app.use(
  "/api/dashboard",
  authorizeModule(...ALL_ROLES),
  dashboardRoutes
);

// ======================================================
// CENTRAL ERROR HANDLER
// ======================================================

app.use((err, req, res, next) => {
  console.error("[ERROR]", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.status
      ? err.message
      : "Internal server error",
    error:
      process.env.NODE_ENV === "production"
        ? undefined
        : err.message,
  });
});

// ======================================================
// SERVER START
// ======================================================

const port = Number(process.env.PORT || 8000);

connectDB()
  .then(() => {
    app.listen(port, "127.0.0.1", () => {
      console.log(
        `TVI One API running on http://127.0.0.1:${port}`
      );

      console.log(
        `Document storage ready at: ${UPLOADS_DIR}`
      );
    });
  })
  .catch((e) => {
    console.error("DB connection failed:", e.message);
    process.exit(1);
  });
