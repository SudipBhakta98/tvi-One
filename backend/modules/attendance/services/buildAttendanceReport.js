import TodayReport from "../models/attendanceTodayReportModel.js";
import PreviousDayReport from "../models/attendancePreviousDayReportModel.js";
import MonthlyEvent from "../models/attendanceMonthlyEventModel.js";
import { FREQUENT_MIN_OCCURRENCES } from "../constants/attendanceConstants.js";
import { currentMonthKey, todayKey } from "./attendanceDates.js";

/** Day's offenders who also have FREQUENT_MIN_OCCURRENCES+ dates this month, worst first. */
const buildFrequentEmployees = (dailyEmployees = [], monthlyEmployees = []) =>
  dailyEmployees
    .map((employee) => {
      const monthly = monthlyEmployees.find((item) => item.employeeCode === employee.employeeCode);
      if (!monthly) return null;
      const { employeeCode, employeeName, company, department, unit, dates } = monthly;
      return { employeeCode, employeeName, company, department, unit, count: dates.length, dates };
    })
    .filter((employee) => employee && employee.count >= FREQUENT_MIN_OCCURRENCES)
    .sort((a, b) => b.count - a.count);

/** Stored present/absent counters plus late/early/miss-punch counts re-derived from the day's exception lists. */
const buildCategorySummary = (baseSummary = {}, previousDay, field) => {
  const summary = {};
  for (const [key, { present = 0, absent = 0 }] of Object.entries(baseSummary)) summary[key] = { present, absent, lateEntry: 0, earlyExit: 0, missPunch: 0 };

  const exceptionLists = [["lateEntry", previousDay.lateEntryEmployees], ["earlyExit", previousDay.earlyExitEmployees], ["missPunch", previousDay.missPunchEmployees]];
  for (const [counterName, employees] of exceptionLists) {
    for (const employee of employees) {
      summary[employee[field]] ??= { present: 0, absent: 0, lateEntry: 0, earlyExit: 0, missPunch: 0 };
      summary[employee[field]][counterName]++;
    }
  }
  return summary;
};

/** Report for the dashboard and the Excel export. `date` (DD-MM-YYYY) picks the previous-day report; default is the latest. */
const buildAttendanceReport = async (date) => {
  const todayReport = await TodayReport.findOne({ reportDate: todayKey() }).lean();
  const previousDay = date ? await PreviousDayReport.findOne({ date }).lean() : await PreviousDayReport.findOne().sort({ isoDate: -1 }).lean();

  if (!previousDay && !todayReport) return { success: false, error: "No attendance data found in the database." };
  if (!previousDay) return { success: true, todayReport, previousDayReport: null };

  const monthDoc = await MonthlyEvent.findOne({ month: currentMonthKey() }).lean();
  const frequent = (field) => buildFrequentEmployees(previousDay[field], monthDoc?.[field]);

  return {
    success: true,
    todayReport,
    allAvailableDates: await PreviousDayReport.distinct("date"),
    previousDayReport: {
      date: previousDay.date,
      totalPresent: previousDay.totalPresent,
      totalAbsent: previousDay.totalAbsent,
      totalLateEntry: previousDay.lateEntryEmployees.length,
      totalEarlyExit: previousDay.earlyExitEmployees.length,
      totalMissPunch: previousDay.missPunchEmployees.length,
      unitWise: buildCategorySummary(previousDay.unitWise, previousDay, "unit"),
      departmentWise: buildCategorySummary(previousDay.departmentWise, previousDay, "department"),
      companyWise: buildCategorySummary(previousDay.companyWise, previousDay, "company"),
      absentEmployees: previousDay.absentEmployees,
      lateEntryEmployees: previousDay.lateEntryEmployees,
      earlyExitEmployees: previousDay.earlyExitEmployees,
      missPunchEmployees: previousDay.missPunchEmployees,
      frequentAbsentEmployees: frequent("absentEmployees"),
      frequentLateEntryEmployees: frequent("lateEntryEmployees"),
      frequentEarlyExitEmployees: frequent("earlyExitEmployees"),
      frequentMissPunchEmployees: frequent("missPunchEmployees"),
    },
  };
};

export default buildAttendanceReport;
