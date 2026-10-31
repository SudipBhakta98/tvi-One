import { consolidateDailyPunches, evaluateAttendance } from "./attendanceRules.js";
import processTodayData from "./processTodayData.js";
import processPreviousDayData from "./processPreviousDayData.js";
import { todayKey } from "./attendanceDates.js";

/** Consolidates punches, evaluates every employee-day, then routes each date to the Today or Previous-day report. */
const processAttendanceRows = async (rows) => {
  const evaluated = consolidateDailyPunches(rows).map(evaluateAttendance);

  const rowsByDate = evaluated.reduce((groups, record) => {
    const dateKey = String(record.date || "").trim();
    if (dateKey) (groups[dateKey] ??= []).push(record);
    return groups;
  }, {});

  const today = todayKey();
  const executionLogs = [];
  for (const [date, dayRows] of Object.entries(rowsByDate)) {
    const isToday = date === today;
    const status = await (isToday ? processTodayData : processPreviousDayData)(dayRows);
    executionLogs.push({ date, route: isToday ? "TodayReport" : "PreviousDayReport", status });
  }
  return executionLogs;
};

export default processAttendanceRows;
