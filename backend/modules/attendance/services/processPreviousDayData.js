import PreviousDayReport from "../models/attendancePreviousDayReportModel.js";
import updateMonthlyEvents from "./updateMonthlyEvents.js";
import { ATTENDANCE, EXCEPTION } from "../constants/attendanceConstants.js";

const newCounter = () => ({ present: 0, absent: 0, lateEntry: 0, earlyExit: 0, missPunch: 0 });

const counterFor = (container, key) => (container[key || "Unknown"] ??= newCounter());

const processPreviousDayData = async (dayRows) => {
  if (!Array.isArray(dayRows) || dayRows.length === 0) return { message: "Previous day array contains no data." };

  const date = String(dayRows[0].date).trim();
  const unitWise = {};
  const departmentWise = {};
  const companyWise = {};
  const absentEmployees = [];
  const lateEntryEmployees = [];
  const earlyExitEmployees = [];
  const missPunchEmployees = [];
  let totalPresent = 0;
  let totalAbsent = 0;

  // An employee-day lands in exactly one exception list; Miss Punch outranks Late Entry, which outranks Early Exit.
  const exceptionRoutes = [
    [EXCEPTION.MISS_PUNCH, "missPunch", missPunchEmployees],
    [EXCEPTION.LATE_ENTRY, "lateEntry", lateEntryEmployees],
    [EXCEPTION.EARLY_EXIT, "earlyExit", earlyExitEmployees],
  ];

  for (const employee of dayRows) {
    const { attendanceStatus, company, department, unit, status } = employee;
    const counters = [counterFor(unitWise, unit || company), counterFor(departmentWise, department), counterFor(companyWise, company)];
    const bump = (field) => counters.forEach((counter) => counter[field]++);

    if (attendanceStatus === ATTENDANCE.PRESENT) {
      totalPresent++;
      bump("present");
      const route = Array.isArray(status) && exceptionRoutes.find(([label]) => status.includes(label));
      if (route) {
        route[2].push(employee);
        bump(route[1]);
      }
    } else {
      totalAbsent++;
      bump("absent");
      absentEmployees.push(employee);
    }
  }

  const [day, month, year] = date.split("-");
  await PreviousDayReport.findOneAndUpdate(
    { date },
    { $set: { date, isoDate: `${year}-${month}-${day}`, totalPresent, totalAbsent, unitWise, departmentWise, companyWise, absentEmployees, lateEntryEmployees, earlyExitEmployees, missPunchEmployees } },
    { upsert: true },
  );
  await updateMonthlyEvents({ date, absentEmployees, lateEntryEmployees, earlyExitEmployees, missPunchEmployees });
  return { message: "Previous Day's Attendance processed successfully" };
};

export default processPreviousDayData;
