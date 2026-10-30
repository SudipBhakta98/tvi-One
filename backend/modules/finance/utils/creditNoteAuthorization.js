import { ROLES } from "../../../constants/roles.js";

export const canManageCreditNotes = (user) => {
  const role = user?.originalRole || user?.role;
  return role === ROLES.SUPER_USER || role === ROLES.ADMIN || role === "Super User";
};
