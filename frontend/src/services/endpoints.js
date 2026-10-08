// Central, production-style API route map — one place to see every
// resource TVI One talks to. Keeps modules from hard-coding path strings
// and matches the mount points registered in backend/server.js.
export const ENDPOINTS = {
  AUTH: { LOGIN: "/auth/login", LOGOUT: "/auth/logout", ME: "/auth/me", CHANGE_PASSWORD: "/auth/change-password" },

  RFQ: { BASE: "/rfq", COMPONENTS: "/components" },
  PROJECTS: { BASE: "/projects" },
  PURCHASE: { BASE: "/purchases" },

  PRODUCTION: { BASE: "/production", STAGES: "/stages", MACHINES: "/machines" },
  WAREHOUSE: { BASE: "/warehouse" },
  DISPATCH: { BASE: "/dispatch" },

  DASHBOARD: {
    OVERVIEW: "/dashboard/overview",
    RFQ: "/dashboard/rfq",
    PROJECTS: "/dashboard/projects",
    PROJECT: (projectID) => `/dashboard/project/${projectID}`,
    PRODUCTION: "/dashboard/production",
    PURCHASE: "/dashboard/purchase",
    WAREHOUSE: "/dashboard/warehouse",
    DISPATCH: "/dashboard/dispatch",
    FINANCE: "/dashboard/finance",
    REPORTS: "/dashboard/reports"
  },

  ADMIN: { USERS: "/admin/users", SESSIONS: "/admin/sessions", LOGS: "/admin/logs" },

  // Integrated finance module — mounted under /api/finance/* in server.js.
  // Sub-paths below match the untouched finance route files exactly.
  FINANCE: {
    PAYABLE: "/finance/payable",
    PAYMENT: "/finance/payment",
    DEBIT: "/finance/debit",
    CREDIT: "/finance/credit",
    RECEIVABLE: "/finance/receivable",
    COLLECTION: "/finance/collection"
  }
};