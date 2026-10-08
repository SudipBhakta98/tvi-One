import { ROLES } from "../../../constants/roles.js";

/**
 * Finance module compatibility adapter.
 *
 * The finance application's controllers were written against a simple
 * two-tier identity model: { role: "User" | "Super User" }. That logic is
 * kept 100% intact (see controllers/*) as required.
 *
 * TVI One authenticates users against its own directory with the full
 * department role set (ADMIN, SUPER_USER, FINANCE_MANAGER, FINANCE_USER, ...).
 * This adapter simply re-shapes `req.user` — after TVI One's own RBAC has
 * already authorized the request — into the shape the finance controllers
 * expect, so their untouched internal checks
 * (`req.user.role !== "Super User"`) keep working:
 *
 *   ADMIN / SUPER_USER / FINANCE_MANAGER -> "Super User" (full finance rights)
 *   FINANCE_USER                          -> "User"       (read + limited create)
 *
 * No business rule inside the finance module is modified.
 */
export const mapFinanceUser = (req, res, next) => {
  const role = req.user?.role;
  const isElevated = role === ROLES.ADMIN || role === ROLES.SUPER_USER || role === ROLES.FINANCE_MANAGER;

  req.user = {
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: isElevated ? "Super User" : "User",
    isActive: req.user.isActive,
    createdAt: req.user.createdAt,
    updatedAt: req.user.updatedAt
  };

  next();
};
