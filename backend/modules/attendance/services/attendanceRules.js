import { ATTENDANCE, DEFAULT_LABEL, DEFAULT_REQUIRED_HOURS, DEFAULT_SHIFT, EXCEPTION, MINUTES_PER_DAY, MINUTES_PER_HOUR, NIGHT_SHIFT, SHIFTS } from "../constants/attendanceConstants.js";

const SHIFT_BY_NAME = Object.fromEntries(SHIFTS.map((shift) => [shift.name, shift]));

const timeToMinutes = (time) => {
  if (!time || typeof time !== "string" || !time.includes(":")) return null;
  const [hour, minute] = time.trim().split(":").map(Number);
  return isNaN(hour) || isNaN(minute) ? null : hour * MINUTES_PER_HOUR + minute;
};

const minutesToTime = (minutes) => {
  if (minutes === null || minutes === undefined) return "";
  const hour = Math.floor(minutes / MINUTES_PER_HOUR) % 24;
  return `${String(hour).padStart(2, "0")}:${String(minutes % MINUTES_PER_HOUR).padStart(2, "0")}`;
};

const hoursBetween = (startMinutes, endMinutes) => {
  const span = endMinutes - startMinutes;
  return Number(((span < 0 ? span + MINUTES_PER_DAY : span) / MINUTES_PER_HOUR).toFixed(2));
};

const calculateRequiredHours = (start, end) => {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  return startMinutes === null || endMinutes === null ? DEFAULT_REQUIRED_HOURS : hoursBetween(startMinutes, endMinutes);
};

const calculateWorkingHours = (inPunch, outPunch) => {
  const inMinutes = timeToMinutes(inPunch);
  const outMinutes = timeToMinutes(outPunch);
  return !inPunch || !outPunch || inMinutes === null || outMinutes === null ? 0 : hoursBetween(inMinutes, outMinutes);
};

const allocateShift = (inPunch) => {
  const punchMinutes = timeToMinutes(inPunch);
  if (!inPunch || punchMinutes === null) return DEFAULT_SHIFT;
  let closestShift = null;
  let smallestDifference = Infinity;
  for (const shift of SHIFTS) {
    const difference = Math.abs(punchMinutes - timeToMinutes(shift.start));
    if (difference < smallestDifference) {
      smallestDifference = difference;
      closestShift = shift;
    }
  }
  return closestShift?.name || DEFAULT_SHIFT;
};

/** One record per employee per date: earliest punch is "in", latest punch is "out". */
export const consolidateDailyPunches = (rows) => {
  const byEmployeeDate = rows.reduce((groups, row) => {
    const key = `${row.employeeCode}-${String(row.date || "").trim()}`;
    groups[key] ??= { ...row, punches: [] };
    if (row.inPunch) groups[key].punches.push(timeToMinutes(row.inPunch));
    if (row.outPunch) groups[key].punches.push(timeToMinutes(row.outPunch));
    return groups;
  }, {});

  return Object.values(byEmployeeDate).map((employee) => {
    const sorted = employee.punches.sort((a, b) => a - b);
    return { ...employee, inPunch: minutesToTime(sorted[0]), outPunch: sorted.length > 1 ? minutesToTime(sorted[sorted.length - 1]) : "" };
  });
};

const findTimingExceptions = (shift, inPunch, outPunch) => {
  const { start, end } = SHIFT_BY_NAME[shift];
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  const exceptions = [];
  const remarks = [];

  const inMinutes = timeToMinutes(inPunch);
  if (inPunch && inMinutes !== null && inMinutes > startMinutes) {
    exceptions.push(EXCEPTION.LATE_ENTRY);
    remarks.push("Employee reported after shift start time.");
  }

  const outMinutes = timeToMinutes(outPunch);
  if (outPunch && outMinutes !== null) {
    const isNight = shift === NIGHT_SHIFT; // night shift ends after midnight, so compare on a 48h scale
    const adjustedOut = isNight && outMinutes < startMinutes ? outMinutes + MINUTES_PER_DAY : outMinutes;
    const adjustedEnd = isNight ? endMinutes + MINUTES_PER_DAY : endMinutes;
    if (adjustedOut < adjustedEnd) {
      exceptions.push(EXCEPTION.EARLY_EXIT);
      remarks.push("Employee left before shift end time.");
    }
  }
  return { exceptions, remarks };
};

/** Shift, hours, present/absent and exception flags for one consolidated employee-day. */
export const evaluateAttendance = (employee) => {
  const inPunch = (employee.inPunch || "").trim();
  const outPunch = (employee.outPunch || "").trim();
  const shift = allocateShift(inPunch);
  const attendanceStatus = !inPunch && !outPunch ? ATTENDANCE.ABSENT : ATTENDANCE.PRESENT;
  const workingHours = calculateWorkingHours(inPunch, outPunch);
  let status = [];
  const remarks = [];

  if (attendanceStatus === ATTENDANCE.PRESENT) {
    if (!inPunch || !outPunch) {
      status.push(EXCEPTION.MISS_PUNCH);
      remarks.push("Employee has incomplete punch data.");
    }
    const requiredHours = calculateRequiredHours(SHIFT_BY_NAME[shift].start, SHIFT_BY_NAME[shift].end);
    if (workingHours >= requiredHours) {
      remarks.push(`OK Employee: Completed required hours (${workingHours}/${requiredHours} hrs).`);
    } else {
      const timing = findTimingExceptions(shift, inPunch, outPunch);
      status = [...status, ...timing.exceptions];
      remarks.push(...timing.remarks);
    }
  } else {
    remarks.push("Absent Row");
  }

  return {
    employeeCode: employee.employeeCode || "",
    employeeName: employee.employeeName || "",
    company: employee.company || DEFAULT_LABEL,
    department: employee.department || DEFAULT_LABEL,
    unit: employee.unit || DEFAULT_LABEL,
    date: employee.date,
    shift, inPunch, outPunch, workingHours, attendanceStatus, status, remarks,
  };
};
