import express from "express";
import { uploadAttendance } from "../controllers/uploadAttendance.js";
import { getAttendanceReport } from "../controllers/getAttendanceReport.js";
import { exportAttendanceReport } from "../controllers/exportAttendanceReport.js";

const router = express.Router();
router.post("/upload", uploadAttendance);
router.get("/report", getAttendanceReport);
router.get("/report/export", exportAttendanceReport);

export default router;
