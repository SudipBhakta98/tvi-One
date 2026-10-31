import buildAttendanceReport from "../services/buildAttendanceReport.js";
import { DATE_PARAM_PATTERN } from "../constants/attendanceConstants.js";

export const isValidDateParam = (date) => date === undefined || (typeof date === "string" && DATE_PARAM_PATTERN.test(date));

export const getAttendanceReport = async (req, res) => {
  const { date } = req.query;
  if (!isValidDateParam(date)) return res.status(400).json({ success: false, message: "date must be DD-MM-YYYY" });
  res.json(await buildAttendanceReport(date)); // success:false (HTTP 200) when nothing is uploaded yet, as in the desktop app
};
