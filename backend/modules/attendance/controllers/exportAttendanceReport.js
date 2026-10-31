import buildAttendanceReport from "../services/buildAttendanceReport.js";
import buildExcelReport from "../services/buildExcelReport.js";
import { isValidDateParam } from "./getAttendanceReport.js";
import { todayKey } from "../services/attendanceDates.js";
import { XLSX_CONTENT_TYPE } from "../constants/attendanceConstants.js";

export const exportAttendanceReport = async (req, res) => {
  const { date } = req.query;
  if (!isValidDateParam(date)) return res.status(400).json({ success: false, message: "date must be DD-MM-YYYY" });
  const report = await buildAttendanceReport(date);
  if (!report.success) return res.status(404).json({ success: false, message: report.error });

  res.set({ "Content-Type": XLSX_CONTENT_TYPE, "Content-Disposition": `attachment; filename="Attendance_Operational_Report_${todayKey()}.xlsx"` });
  res.send(await buildExcelReport(report));
};
