import { ROLES } from "../constants/roles.js";

/**
 * Strict role check — no implicit bypass.
 * Used only for true administration endpoints (/api/admin/*) where even
 * SUPER_USER must NOT be granted access (super users can do everything
 * except administration/user management, per product requirement).
 */
export const requireRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "You do not have permission for this operation" });
  }
  next();
};

/**
 * Module-level access check for every non-admin module.
 * ADMIN and SUPER_USER are always granted access; anyone else must be
 * explicitly listed (typically a department's MANAGER + USER roles).
 */
export const authorizeModule = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
  const { role } = req.user;
  if (role === ROLES.ADMIN || role === ROLES.SUPER_USER || allowedRoles.includes(role)) return next();
  return res.status(403).json({ success: false, message: "You do not have permission for this operation" });
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Department write-guard: only "<DEPT>_MANAGER" (or ADMIN / SUPER_USER) may
 * create/edit/delete records for a department. "<DEPT>_USER" is limited to
 * read (and, where the underlying route allows it, create) actions.
 *
 * This is applied at the route-mount level in server.js so individual
 * controllers (including the untouched finance module) never need to know
 * about it.
 */
export const deptWriteGuard = (dept, { allowUserCreate = true } = {}) => (req, res, next) => {
  const role = req.user?.role;
  if (!role) return res.status(401).json({ success: false, message: "Authentication required" });
  if (role === ROLES.ADMIN || role === ROLES.SUPER_USER) return next();

  const managerRole = `${dept}_MANAGER`;
  const userRole = `${dept}_USER`;

  if (role === managerRole) return next();
  if (role === userRole) {
    if (SAFE_METHODS.has(req.method)) return next();
    if (allowUserCreate && req.method === "POST") return next();
    return res.status(403).json({ success: false, message: `Only ${dept} managers can edit or delete ${dept} records` });
  }
  return res.status(403).json({ success: false, message: "You do not have permission for this operation" });
};

/**
 * Cross-department write-guard for shared resources (e.g. Projects):
 * any "*_MANAGER" role (plus ADMIN/SUPER_USER) may write; everyone else is
 * read-only.
 */
export const anyManagerWriteGuard = () => (req, res, next) => {
  const role = req.user?.role;
  if (!role) return res.status(401).json({ success: false, message: "Authentication required" });
  if (role === ROLES.ADMIN || role === ROLES.SUPER_USER || role.endsWith("_MANAGER")) return next();
  if (SAFE_METHODS.has(req.method)) return next();
  return res.status(403).json({ success: false, message: "Only department managers can modify this resource" });
};
