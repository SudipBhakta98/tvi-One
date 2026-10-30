import { ROLES } from "../../../constants/roles";

/**
 * Resolve the signed-in role from the app's persisted auth user/token.
 * The app's auth provider is outside this module, so support the common user
 * and JWT storage shapes without making the finance module depend on a
 * particular AuthContext implementation.
 */
const normalizeRole = (role) => String(role || "").trim().replace(/[ -]+/g, "_").toUpperCase();

export const getFinanceUserRole = () => {
  if (typeof window === "undefined") return null;

  const storages = [window.localStorage, window.sessionStorage];
  for (const storage of storages) {
    for (let index = 0; index < storage.length; index += 1) {
      try {
        const value = storage.getItem(storage.key(index));
        if (!value) continue;
        const parsed = JSON.parse(value);
        const role = parsed?.role || parsed?.user?.role || parsed?.data?.role || parsed?.userData?.role;
        if (role) return normalizeRole(role);
      } catch { /* Not a JSON user object; check whether it is a JWT below. */ }
    }
  }

  for (const storage of storages) {
    for (let index = 0; index < storage.length; index += 1) {
      try {
        const token = storage.getItem(storage.key(index));
        const payload = token?.split(".")[1];
        if (!payload) continue;
        const decoded = JSON.parse(window.atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
        if (decoded?.role) return normalizeRole(decoded.role);
      } catch { /* Ignore non-token values and malformed JWTs. */ }
    }
  }
  return null;
};

export const isFinanceSuperUser = () => getFinanceUserRole() === normalizeRole(ROLES.SUPER_USER) || getFinanceUserRole() === "SUPER_USER";
export const canManageCreditNotes = () => {
  const role = getFinanceUserRole();
  return role === normalizeRole(ROLES.SUPER_USER) || role === normalizeRole(ROLES.ADMIN) || role === "SUPER_USER" || role === "ADMIN";
};

// Kept for route guards in the host app. Collection status is Super User only.
export const RECEIVABLE_APPROVER_ROLES = [ROLES.SUPER_USER];
