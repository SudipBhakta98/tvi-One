import { normalizeDate, normalizeTime, normalizeEmployeeCode, normalizeText, detectDateFormat } from "./NormalizeAttendanceCell";
import { HEADER_ROW_NUMBER } from "../constants/attendanceConstants";

/** Copies one cell into the record, deciding the field from the header text (order of checks matters). */
const readCell = (record, header, value, dateFormat) => {
  if (header.includes("date")) record.date = normalizeDate(value, dateFormat);
  else if (header.includes("employee code") || header.includes("code")) record.employeeCode = normalizeEmployeeCode(value);
  else if (header.includes("employee name") || header.includes("name")) record.employeeName = normalizeText(value, "");
  else if (header.includes("unit")) record.unit = normalizeText(value);
  else if (header.includes("company")) record.company = normalizeText(value);
  else if (header.includes("department") || header.includes("dept")) record.department = normalizeText(value);
  else if (header.includes("in")) record.inPunch = normalizeTime(value);
  else if (header.includes("out")) record.outPunch = normalizeTime(value);
};

/** Reads the first sheet of an .xlsx biometric export into normalized attendance rows. ExcelJS is loaded only when a file is uploaded. */
export async function parseAttendanceFile(file) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];

  // Pass 1: header row + date samples, so the day/month order of the whole column is detected once.
  let headers = [];
  let dateColumnIndex = -1;
  const rawDateSamples = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === HEADER_ROW_NUMBER) {
      headers = row.values.map((value) => String(value || "").trim().toLowerCase());
      dateColumnIndex = headers.findIndex((header) => header && header.includes("date"));
      return;
    }
    if (dateColumnIndex > -1) rawDateSamples.push(row.getCell(dateColumnIndex).value);
  });
  const dateFormat = detectDateFormat(rawDateSamples); // "DMY" | "MDY" | "YMD"

  // Pass 2: parse every data row with that format.
  const attendanceRows = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === HEADER_ROW_NUMBER) return;
    const record = {};
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      const header = headers[columnNumber];
      if (header) readCell(record, header, cell.value, dateFormat);
    });
    if (record.employeeCode || record.employeeName) attendanceRows.push(record);
  });
  return attendanceRows;
}
