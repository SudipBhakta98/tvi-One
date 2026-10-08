import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "./userModel.js";
import Session from "./sessionModel.js";
import AuditLog from "../admin/auditLogModel.js";

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, department: u.department, isActive: u.isActive });

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required" });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ success: false, message: "Invalid credentials" });
    const tokenId = crypto.randomUUID();
    const expiresIn = process.env.JWT_EXPIRES_IN || "8h";
    const token = jwt.sign({ sub: user._id.toString(), role: user.role, tokenId }, process.env.JWT_SECRET, { expiresIn });
    const payload = jwt.decode(token);
    user.lastLoginAt = new Date();
    await user.save();
    await Session.create({ user: user._id, tokenId, ipAddress: req.ip, userAgent: req.get("user-agent"), expiresAt: payload?.exp ? new Date(payload.exp * 1000) : new Date(Date.now() + 8 * 60 * 60 * 1000) });
    await AuditLog.create({ user: user._id, action: "LOGIN", method: req.method, path: req.originalUrl, ipAddress: req.ip });
    res.json({ success: true, message: "Login successful", data: { token, user: publicUser(user) } });
  } catch (error) { res.status(500).json({ success: false, message: "Login failed", error: error.message }); }
};

export const me = async (req, res) => res.json({ success: true, data: publicUser(req.user) });

export const logout = async (req, res) => {
  try {
    if (req.tokenId) await Session.findOneAndUpdate({ tokenId: req.tokenId }, { revokedAt: new Date() });
    await AuditLog.create({ user: req.user._id, action: "LOGOUT", method: req.method, path: req.originalUrl, ipAddress: req.ip });
    res.json({ success: true, message: "Logged out" });
  } catch (error) { res.status(500).json({ success: false, message: "Logout failed", error: error.message }); }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: "Current password and new password are required" });
    if (String(newPassword).length < 8) return res.status(400).json({ success: false, message: "New password must contain at least 8 characters" });
    if (currentPassword === newPassword) return res.status(400).json({ success: false, message: "New password must be different from the current password" });
    const user = await User.findById(req.user._id);
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) return res.status(400).json({ success: false, message: "Current password is incorrect" });
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    // Password changes revoke every other session. The current session remains valid
    // so the user is not unexpectedly logged out immediately after changing it.
    await Session.updateMany({ user: user._id, tokenId: { $ne: req.tokenId }, revokedAt: null }, { $set: { revokedAt: new Date() } });
    await AuditLog.create({ user: user._id, action: "PASSWORD_CHANGED", resource: "User", resourceId: user._id.toString(), ipAddress: req.ip });
    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) { res.status(500).json({ success: false, message: "Password change failed", error: error.message }); }
};
