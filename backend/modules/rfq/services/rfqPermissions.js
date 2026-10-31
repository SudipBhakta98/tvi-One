import RfqItem from "../models/rfqItemModel.js";
import { ROLES, DEPARTMENT_ROLES } from "../../../constants/roles.js";

const { ADMIN, SUPER_USER, NPD_MANAGER, NPD_SCRUM_MASTER, NPD_USER } = ROLES;

// RFQ creation/editing/workflow initiation and target dates.
export const CREATE_ROLES = [ADMIN, SUPER_USER, NPD_SCRUM_MASTER];
export const RFQ_EDIT_ROLES = [ADMIN, SUPER_USER, NPD_SCRUM_MASTER];
// Existing NPD Manager authority remains for editing already-submitted workflow stages.
export const EDIT_ROLES = [ADMIN, SUPER_USER, NPD_MANAGER];
export const DELETE_ROLES = [ADMIN, SUPER_USER];
export const RFQ_STATUS_ROLES = [ADMIN, SUPER_USER, NPD_MANAGER];
export const REPORT_ROLES = [ADMIN, SUPER_USER, ...DEPARTMENT_ROLES.NPD];

export const NPD_REPORT_DEPARTMENTS = ["projects", "rfq"];
export const ALL_REPORT_DEPARTMENTS = [...NPD_REPORT_DEPARTMENTS, "purchase", "production", "warehouse", "dispatch", "finance"];
export const reportDepartmentsFor = (role) => (DEPARTMENT_ROLES.NPD.includes(role) ? NPD_REPORT_DEPARTMENTS : ALL_REPORT_DEPARTMENTS);

export const isProjectOwner = (user, rfq) => String(rfq.project_owner?._id || rfq.project_owner) === String(user._id);
export const canUpdateRfq = (user) => RFQ_EDIT_ROLES.includes(user.role);
export const canChangeRfqStatus = (user) => RFQ_STATUS_ROLES.includes(user.role);
export const permissionsFor = (user, rfq) => ({
  can_update: canUpdateRfq(user, rfq),
  can_edit: EDIT_ROLES.includes(user.role),
  can_edit_rfq: RFQ_EDIT_ROLES.includes(user.role),
  can_change_status: canChangeRfqStatus(user),
  can_delete: DELETE_ROLES.includes(user.role),
});

export const rfqScope = (user) => (user.role === NPD_USER ? { project_owner: user._id } : {});
const forbidden = (res) => res.status(403).json({ success: false, message: "You do not have permission for this operation" });
export const allowRoles = (...roles) => (req, res, next) => (roles.includes(req.user.role) ? next() : forbidden(res));
export const requireUpdater = (req, res, next) => (canUpdateRfq(req.user, req.rfq) ? next() : forbidden(res));

export const loadRfq = async (req, res, next, rfqItemID) => {
  try {
    const rfq = await RfqItem.findOne({ _id: rfqItemID, ...rfqScope(req.user) }).select("project_owner");
    if (!rfq) return res.status(404).json({ success: false, error: "RFQ not found" });
    req.rfq = rfq;
    next();
  } catch {
    res.status(404).json({ success: false, error: "RFQ not found" });
  }
};
