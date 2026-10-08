import { ROLES } from "../../../constants/roles";

// Who sees and may open the Approve Receivable page.
// Mirrors the backend: mapFinanceUser turns ADMIN / SUPER_USER / FINANCE_MANAGER into "Super User",
// and updateCollectionStatus only accepts that role.
export const RECEIVABLE_APPROVER_ROLES = [ROLES.ADMIN, ROLES.SUPER_USER, ROLES.FINANCE_MANAGER];
