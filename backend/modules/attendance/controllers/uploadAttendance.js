import processAttendanceRows from "../services/processAttendanceRows.js";

export const uploadAttendance = async (req, res) => {
  const rows = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ success: false, message: "No attendance rows received." });
  const processedLogs = await processAttendanceRows(rows);
  res.json({ success: true, message: "Attendance processed successfully", processedLogs });
};
