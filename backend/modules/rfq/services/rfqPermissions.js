import RfqItem from "../models/rfqItemModel.js";
import { ROLES, DEPARTMENT_ROLES } from "../../../constants/roles.js";

const { ADMIN, SUPER_USER, NPD_MANAGER, NPD_SCRUM_MASTER, NPD_USER } = ROLES;

export const CREATE_ROLES = [ADMIN, SUPER_USER, NPD_SCRUM_MASTER];
export const EDIT_ROLES = [ADMIN, SUPER_USER, NPD_MANAGER];
export const DELETE_ROLES = [ADMIN, SUPER_USER];
export const REPORT_ROLES = [ADMIN, SUPER_USER, ...DEPARTMENT_ROLES.NPD];

// NPD roles may only report on NPD departments; every other role keeps its existing access.
export const NPD_REPORT_DEPARTMENTS = ["projects", "rfq"];
export const ALL_REPORT_DEPARTMENTS = [...NPD_REPORT_DEPARTMENTS, "purchase", "production", "warehouse", "dispatch", "finance"];
export const reportDepartmentsFor = (role) => (DEPARTMENT_ROLES.NPD.includes(role) ? NPD_REPORT_DEPARTMENTS : ALL_REPORT_DEPARTMENTS);

export const isProjectOwner = (user, rfq) => String(rfq.project_owner?._id || rfq.project_owner) === String(user._id);
export const canUpdateRfq = (user, rfq) => EDIT_ROLES.includes(user.role) || isProjectOwner(user, rfq);
export const permissionsFor = (user, rfq) => ({
  can_update: canUpdateRfq(user, rfq),
  can_edit: EDIT_ROLES.includes(user.role),
  can_delete: DELETE_ROLES.includes(user.role),
});

// NPD users only ever see the RFQs they own.
export const rfqScope = (user) => (user.role === NPD_USER ? { project_owner: user._id } : {});

const forbidden = (res) => res.status(403).json({ success: false, message: "You do not have permission for this operation" });
export const allowRoles = (...roles) => (req, res, next) => (roles.includes(req.user.role) ? next() : forbidden(res));
export const requireUpdater = (req, res, next) => (canUpdateRfq(req.user, req.rfq) ? next() : forbidden(res));

// router.param handler: loads the RFQ inside the user's scope, so an RFQ they don't own answers 404 and its existence isn't leaked.
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
