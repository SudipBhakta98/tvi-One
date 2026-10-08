// Mirrors backend/constants/roles.js — keep both in sync.
export const ROLES = {
  ADMIN: "ADMIN",
  SUPER_USER: "SUPER_USER",
  NPD_MANAGER: "NPD_MANAGER",
  NPD_USER: "NPD_USER",
  SCM_MANAGER: "SCM_MANAGER",
  SCM_USER: "SCM_USER",
  PRODUCTION_MANAGER: "PRODUCTION_MANAGER",
  PRODUCTION_USER: "PRODUCTION_USER",
  WAREHOUSE_MANAGER: "WAREHOUSE_MANAGER",
  WAREHOUSE_USER: "WAREHOUSE_USER",
  DISPATCH_MANAGER: "DISPATCH_MANAGER",
  DISPATCH_USER: "DISPATCH_USER",
  FINANCE_MANAGER: "FINANCE_MANAGER",
  FINANCE_USER: "FINANCE_USER"
};

export const ALL_ROLES = Object.values(ROLES);

export const ROLE_LABELS = {
  ADMIN: "Admin",
  SUPER_USER: "Super User",
  NPD_MANAGER: "NPD Manager",
  NPD_USER: "NPD User",
  SCM_MANAGER: "SCM Manager",
  SCM_USER: "SCM User",
  PRODUCTION_MANAGER: "Production Manager",
  PRODUCTION_USER: "Production User",
  WAREHOUSE_MANAGER: "Warehouse Manager",
  WAREHOUSE_USER: "Warehouse User",
  DISPATCH_MANAGER: "Dispatch Manager",
  DISPATCH_USER: "Dispatch User",
  FINANCE_MANAGER: "Finance Manager",
  FINANCE_USER: "Finance User"
};

export const DEPARTMENT_ROLES = {
  NPD: [ROLES.NPD_MANAGER, ROLES.NPD_USER],
  SCM: [ROLES.SCM_MANAGER, ROLES.SCM_USER],
  PRODUCTION: [ROLES.PRODUCTION_MANAGER, ROLES.PRODUCTION_USER],
  WAREHOUSE: [ROLES.WAREHOUSE_MANAGER, ROLES.WAREHOUSE_USER],
  DISPATCH: [ROLES.DISPATCH_MANAGER, ROLES.DISPATCH_USER],
  FINANCE: [ROLES.FINANCE_MANAGER, ROLES.FINANCE_USER]
};

// True if `role` may create/edit/delete records for `dept` (or is a global override).
export const isDeptManager = (role, dept) => role === "ADMIN" || role === "SUPER_USER" || role === `${dept}_MANAGER`;
// True if `role` may at least view/create records for `dept`.
export const isDeptMember = (role, dept) => isDeptManager(role, dept) || role === `${dept}_USER`;
