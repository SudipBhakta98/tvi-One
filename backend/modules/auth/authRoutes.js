import express from "express";
import { login, me, logout, changePassword } from "./authController.js";
import { authenticate } from "../../middleware/authMiddleware.js";
const router = express.Router();
router.post("/login", login);
router.get("/me", authenticate, me);
router.post("/logout", authenticate, logout);
router.post("/change-password", authenticate, changePassword);
export default router;
