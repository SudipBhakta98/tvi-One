export const REPORT_TIME_ZONE = "Asia/Kolkata";
export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
export const DEFAULT_REQUIRED_HOURS = 8;
export const FREQUENT_MIN_OCCURRENCES = 3;
export const DEFAULT_LABEL = "Default";
export const DEFAULT_SHIFT = "General";
export const NIGHT_SHIFT = "Night";
export const DATE_PARAM_PATTERN = /^\d{2}-\d{2}-\d{4}$/;
export const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const ATTENDANCE = { PRESENT: "Present", ABSENT: "Absent" };
export const EXCEPTION = { LATE_ENTRY: "Late Entry", EARLY_EXIT: "Early Exit", MISS_PUNCH: "Miss Punch" };

// Order matters: when an in-punch is equally close to two shift starts, the earlier entry wins.
export const SHIFTS = [
  { name: "1st", start: "06:00", end: "14:00" },
  { name: "General", start: "09:00", end: "17:30" },
  { name: "2nd", start: "14:00", end: "22:00" },
  { name: "Day", start: "07:00", end: "15:00" },
  { name: "Night", start: "19:00", end: "03:00" },
];
