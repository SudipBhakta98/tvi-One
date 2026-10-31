import MonthlyEvent from "../models/attendanceMonthlyEventModel.js";

const EVENT_FIELDS = ["absentEmployees", "lateEntryEmployees", "earlyExitEmployees", "missPunchEmployees"];

/** Adds the date to each offender's running list for the month (one entry per employee, no duplicate dates). */
const updateMonthlyEvents = async ({ date, ...eventsByField }) => {
  const [, month, year] = date.split("-");
  const monthKey = `${month}-${year}`;
  const monthDoc = (await MonthlyEvent.findOne({ month: monthKey })) || (await MonthlyEvent.create({ month: monthKey }));

  let modified = false;
  for (const field of EVENT_FIELDS) {
    for (const employee of eventsByField[field] || []) {
      if (!employee?.employeeCode) continue;
      const existing = monthDoc[field].find((item) => item.employeeCode === employee.employeeCode);
      if (!existing) monthDoc[field].push({ ...employee, dates: [date] });
      else if (!existing.dates.includes(date)) existing.dates.push(date);
      else continue;
      modified = true;
    }
  }
  if (modified) await monthDoc.save();
};

export default updateMonthlyEvents;
