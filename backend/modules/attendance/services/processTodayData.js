import TodayReport from "../models/attendanceTodayReportModel.js";
import { ATTENDANCE } from "../constants/attendanceConstants.js";

const groupAttendance = (rows, field) =>
  rows.reduce((groups, employee) => {
    const key = employee[field] || "Unknown";
    groups[key] ??= { present: 0, absent: 0 };
    groups[key][employee.attendanceStatus === ATTENDANCE.PRESENT ? "present" : "absent"]++;
    return groups;
  }, {});

const processTodayData = async (todayRows) => {
  if (!Array.isArray(todayRows) || todayRows.length === 0) return { message: "Today's array contains no rows to aggregate." };

  const absentRows = todayRows.filter((employee) => employee.attendanceStatus === ATTENDANCE.ABSENT);
  const reportDate = todayRows[0].date;

  await TodayReport.findOneAndUpdate(
    { reportDate },
    {
      reportDate,
      totalPresent: todayRows.filter((employee) => employee.attendanceStatus === ATTENDANCE.PRESENT).length,
      totalAbsent: absentRows.length,
      unitWise: groupAttendance(todayRows, "unit"),
      departmentWise: groupAttendance(todayRows, "department"),
      companyWise: groupAttendance(todayRows, "company"),
      absentEmployees: absentRows.map(({ employeeCode, employeeName, company, department, unit, shift }) => ({ employeeCode, employeeName, company, department, unit, shift })),
    },
    { upsert: true },
  );
  return { message: "Today's Attendance processed successfully" };
};

export default processTodayData;
