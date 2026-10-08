/**
 * TVI One — Role & Department model
 * ----------------------------------------------------------------
 * Every operational department has exactly two roles:
 *   <DEPT>_MANAGER  - full create/edit/delete rights within the department
 *   <DEPT>_USER     - read access + create, no edit/delete
 *
 * Two roles sit above every department:
 *   SUPER_USER - full access to every module/action EXCEPT administration
 *                (user management, sessions, audit logs).
 *   ADMIN      - full access to everything, including administration.
 */
export const ROLES = Object.freeze({
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
});

export const ALL_ROLES = Object.values(ROLES);

// Departments, used to build the generic manager/user write-guard.
export const DEPARTMENTS = Object.freeze({
  NPD: "NPD",
  SCM: "SCM",
  PRODUCTION: "PRODUCTION",
  WAREHOUSE: "WAREHOUSE",
  DISPATCH: "DISPATCH",
  FINANCE: "FINANCE"
});

// Human readable labels for the UI (Administration screen, badges, etc.)
export const ROLE_LABELS = Object.freeze({
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
});

// Roles grouped per department, for admin UI dropdowns.
export const DEPARTMENT_ROLES = Object.freeze({
  NPD: [ROLES.NPD_MANAGER, ROLES.NPD_USER],
  SCM: [ROLES.SCM_MANAGER, ROLES.SCM_USER],
  PRODUCTION: [ROLES.PRODUCTION_MANAGER, ROLES.PRODUCTION_USER],
  WAREHOUSE: [ROLES.WAREHOUSE_MANAGER, ROLES.WAREHOUSE_USER],
  DISPATCH: [ROLES.DISPATCH_MANAGER, ROLES.DISPATCH_USER],
  FINANCE: [ROLES.FINANCE_MANAGER, ROLES.FINANCE_USER]
});
