import jwt from "jsonwebtoken";
import User from "../modules/auth/userModel.js";
import Session from "../modules/auth/sessionModel.js";
export const authenticate = async (req, res, next) => {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token)
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    const p = jwt.verify(token, process.env.JWT_SECRET);
    const session = await Session.findOne({
      tokenId: p.tokenId,
      revokedAt: null,
    });
    if (!session || session.expiresAt < new Date())
      return res
        .status(401)
        .json({ success: false, message: "Session expired or revoked" });
    const user = await User.findById(p.sub).select("-passwordHash");
    if (!user || !user.isActive)
      return res
        .status(401)
        .json({ success: false, message: "User is inactive or not found" });
    req.user = user;
    req.tokenId = p.tokenId;
    next();
  } catch (e) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
};
