export const REQUIRED_COLUMNS = ["Date", "Employee Code", "Employee Name", "Unit", "Company", "Department", "In Time", "Out Time"];
export const HEADER_ROW_NUMBER = 1;
export const UPLOAD_TIMEOUT_MS = 120000; // processing a month of punches takes longer than the default 20s
export const XLSX_EXTENSION = ".xlsx";

export const DAY_TABS = { TODAY: "today", PREVIOUS: "previous" };

export const DISTRIBUTION_TABS = [
  { key: "company", label: "Company" },
  { key: "department", label: "Dept" },
  { key: "unit", label: "Unit" },
];

// Options of the previous-day log selector. `field` is the list name inside previousDayReport.
export const LOG_CATEGORY_GROUPS = [
  {
    group: "Daily Single Event Logs",
    options: [
      { key: "absent", label: "Absences", field: "absentEmployees" },
      { key: "late", label: "Late Entries", field: "lateEntryEmployees" },
      { key: "early", label: "Early Exits", field: "earlyExitEmployees" },
      { key: "missed", label: "Missed Punches", field: "missPunchEmployees" },
    ],
  },
  {
    group: "Recurring Violations Analytics",
    options: [
      { key: "freq_absent", label: "Frequently Absent", field: "frequentAbsentEmployees", frequent: true },
      { key: "freq_late", label: "Frequently Late Entry", field: "frequentLateEntryEmployees", frequent: true },
      { key: "freq_early", label: "Frequently Early Exit", field: "frequentEarlyExitEmployees", frequent: true },
      { key: "freq_missed", label: "Frequently Missed Punch", field: "frequentMissPunchEmployees", frequent: true },
    ],
  },
];
export const LOG_CATEGORIES = LOG_CATEGORY_GROUPS.flatMap((group) => group.options);
export const DEFAULT_LOG_CATEGORY = "absent";

export const SINGLE_EVENT_COLUMNS = ["Emp Code", "Employee Name", "Punches (In / Out)", "Working Hours", "Shift", "Department", "Company", "Operational Unit"];
export const FREQUENT_COLUMNS = ["Emp Code", "Employee Name", "Streak Count", "Recorded Violation Dates"];
