import { REPORT_TIME_ZONE } from "../constants/attendanceConstants.js";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: REPORT_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });

// "Today" must follow the plant's calendar, not the server's clock (hosts usually run in UTC).
const currentDateParts = () => Object.fromEntries(dateFormatter.formatToParts(new Date()).map(({ type, value }) => [type, value]));

export const todayKey = () => {
  const { day, month, year } = currentDateParts();
  return `${day}-${month}-${year}`;
};

export const currentMonthKey = () => {
  const { month, year } = currentDateParts();
  return `${month}-${year}`;
};
