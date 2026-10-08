import bcrypt from "bcryptjs";
import User from "../auth/userModel.js";
import Session from "../auth/sessionModel.js";
import AuditLog from "./auditLogModel.js";
import { ALL_ROLES } from "../../constants/roles.js";

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, department: u.department, isActive: u.isActive, lastLoginAt: u.lastLoginAt });

export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ success: false, message: "name, email, password and role are required" });
    if (!ALL_ROLES.includes(role)) return res.status(400).json({ success: false, message: "Invalid role" });
    if (password.length < 8) return res.status(400).json({ success: false, message: "Password must contain at least 8 characters" });
    const normalizedEmail = email.toLowerCase().trim();
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ success: false, message: "Email already exists" });
    const user = await User.create({ name: name.trim(), email: normalizedEmail, role, department: department || "GENERAL", passwordHash: await bcrypt.hash(password, 12) });
    await AuditLog.create({ user: req.user._id, action: "USER_CREATED", resource: "User", resourceId: user._id.toString(), metadata: { role, department } });
    res.status(201).json({ success: true, message: "User created successfully", data: publicUser(user) });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

export const listUsers = async (req, res) => {
  const users = await User.find().select("-passwordHash").sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: users });
};

export const updateUser = async (req, res) => {
  try {
    const { role, department, isActive, name } = req.body;
    if (role && !ALL_ROLES.includes(role)) return res.status(400).json({ success: false, message: "Invalid role" });
    if (String(req.params.userId) === String(req.user._id) && isActive === false) return res.status(400).json({ success: false, message: "You cannot deactivate your own administrator account" });
    const user = await User.findByIdAndUpdate(req.params.userId, { $set: { ...(role && { role }), ...(department !== undefined && { department }), ...(isActive !== undefined && { isActive }), ...(name && { name: name.trim() }) } }, { new: true, runValidators: true }).select("-passwordHash");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (isActive === false) {
      await Session.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    }
    if (role) {
      await Session.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    }
    await AuditLog.create({ user: req.user._id, action: isActive === false ? "USER_DEACTIVATED" : "USER_UPDATED", resource: "User", resourceId: user._id.toString(), metadata: req.body });
    res.json({ success: true, message: isActive === false ? "User deactivated and active sessions revoked" : "User updated successfully", data: user });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

export const listSessions = async (req, res) => {
  const sessions = await Session.find({ revokedAt: null, expiresAt: { $gt: new Date() } }).populate("user", "name email role").sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: sessions });
};

export const revokeSession = async (req, res) => {
  const session = await Session.findByIdAndUpdate(req.params.sessionId, { revokedAt: new Date() }, { new: true });
  if (!session) return res.status(404).json({ success: false, message: "Session not found" });
  await AuditLog.create({ user: req.user._id, action: "SESSION_REVOKED", resource: "Session", resourceId: session._id.toString() });
  res.json({ success: true, message: "Session revoked", data: session });
};

export const listAuditLogs = async (req, res) => {
  const logs = await AuditLog.find().populate("user", "name email role").sort({ createdAt: -1 }).limit(500).lean();
  res.json({ success: true, data: logs });
};
