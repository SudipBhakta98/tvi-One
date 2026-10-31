import ExcelJS from "exceljs";

const SECTION_COLORS = {
  neutral: "FF1F4E78",
  absent: "FF595959",
  lateEntry: "FF1F4E78",
  earlyExit: "FF833C00",
  missPunch: "FFC00000",
};

const headerFillFor = (argbColor) => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: argbColor },
});
const textWhite = {
  color: { argb: "FFFFFFFF" },
  bold: true,
  name: "Arial",
  size: 10,
};
const textBold = { bold: true, name: "Arial", size: 10 };
const textRegular = { name: "Arial", size: 10 };
const textItalicNote = {
  italic: true,
  name: "Arial",
  size: 9,
  color: { argb: "FF595959" },
};
const thinBorder = {
  top: { style: "thin", color: { argb: "FFCCCCCC" } },
  bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
  left: { style: "thin", color: { argb: "FFCCCCCC" } },
  right: { style: "thin", color: { argb: "FFCCCCCC" } },
};

function numberToColumnLetter(columnNumber) {
  let letter = "",
    remaining = columnNumber;
  while (remaining > 0) {
    const remainder = (remaining - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return letter;
}

function formatReportDateLabel(reportSource) {
  const rawDateValue = reportSource?.date || reportSource?.reportDate;
  if (!rawDateValue) return "Data Not Uploaded";
  const parsedDate = new Date(rawDateValue);
  return Number.isNaN(parsedDate.getTime())
    ? rawDateValue
    : parsedDate.toLocaleDateString("en-GB");
}

function resolveCountWithFallback(reportSource, totalFieldName, listFieldName) {
  if (!reportSource) return 0;
  return reportSource[totalFieldName] !== undefined
    ? reportSource[totalFieldName]
    : (reportSource[listFieldName] || []).length;
}

const ABSENT_TABLE_HEADERS = [
  "Employee Code",
  "Employee Name",
  "Company",
  "Department",
  "Unit",
  "Attendance Status",
];
const PUNCH_ISSUE_TABLE_HEADERS = [
  "Employee Code",
  "Employee Name",
  "Company",
  "Department",
  "Shift",
  "In Punch",
  "Out Punch",
  "Working Hours",
  "Reason",
];
const FREQUENT_TABLE_HEADERS = [
  "Employee Code",
  "Employee Name",
  "Company",
  "Department",
  "Unit",
  "Occurrence Count",
  "Dates",
];

const mapAbsentEmployeeRow = (e) => [
  e.employeeCode || "",
  e.employeeName || "",
  e.company || "",
  e.department || "",
  e.unit || "",
  "Absent",
];
const mapPunchIssueRow = (e) => [
  e.employeeCode || "",
  e.employeeName || "",
  e.company || "",
  e.department || "",
  e.shift || "N/A",
  e.inPunch || "--:--",
  e.outPunch || "--:--",
  e.workingHours || "",
  Array.isArray(e.remarks) ? e.remarks.join(" | ") : "",
];
const mapFrequentOffenderRow = (e) => [
  e.employeeCode || "",
  e.employeeName || "",
  e.company || "",
  e.department || "",
  e.unit || "",
  e.count || 0,
  Array.isArray(e.dates) ? e.dates.join(", ") : "",
];

function appendEmployeeListSection(
  sheet,
  {
    sectionTitle,
    titleColor,
    headerFillColor,
    columnHeaders,
    employeeRecords,
    rowMapper,
    emptyStateMessage,
  },
) {
  sheet.addRow([]);
  sheet.addRow([sectionTitle]).font = {
    ...textBold,
    size: 11,
    color: { argb: titleColor },
  };
  const headerRow = sheet.addRow(columnHeaders);
  headerRow.eachCell((c) => {
    c.fill = headerFillFor(headerFillColor);
    c.font = textWhite;
  });

  if (!employeeRecords || employeeRecords.length === 0) {
    const emptyRow = sheet.addRow([emptyStateMessage]);
    sheet.mergeCells(
      `A${emptyRow.number}:${numberToColumnLetter(columnHeaders.length)}${emptyRow.number}`,
    );
    emptyRow.getCell(1).font = { italic: true, name: "Arial", size: 10 };
  } else {
    employeeRecords.forEach((r) => {
      const dataRow = sheet.addRow(rowMapper(r));
      dataRow.eachCell((c) => {
        c.font = textRegular;
        c.border = thinBorder;
      });
    });
  }
}

function appendOverallKpiSection(sheet, sectionTitle, reportSource) {
  sheet.addRow([]);
  sheet.addRow([sectionTitle]).font = {
    ...textBold,
    size: 12,
    color: { argb: SECTION_COLORS.neutral },
  };
  sheet.addRow([
    "Total Headcount",
    (reportSource?.totalPresent || 0) + (reportSource?.totalAbsent || 0),
  ]);
  sheet.addRow(["Total Present", reportSource?.totalPresent || 0]);
  sheet.addRow(["Total Absent", reportSource?.totalAbsent || 0]);
  sheet.addRow([
    "Late Entries",
    resolveCountWithFallback(
      reportSource,
      "totalLateEntry",
      "lateEntryEmployees",
    ),
  ]);
  sheet.addRow([
    "Early Exits",
    resolveCountWithFallback(
      reportSource,
      "totalEarlyExit",
      "earlyExitEmployees",
    ),
  ]);
  sheet.addRow([
    "Missing Punches",
    resolveCountWithFallback(
      reportSource,
      "totalMissPunch",
      "missPunchEmployees",
    ),
  ]);
}

function appendSegmentKpiSection(sheet, sectionTitle, segmentData) {
  sheet.addRow([]);
  sheet.addRow([sectionTitle]).font = {
    ...textBold,
    size: 12,
    color: { argb: SECTION_COLORS.neutral },
  };
  const headerRow = sheet.addRow([
    "Segment Group",
    "Present",
    "Absent",
    "Late",
    "Early",
    "Miss",
  ]);
  headerRow.eachCell((c) => {
    c.fill = headerFillFor(SECTION_COLORS.neutral);
    c.font = textWhite;
  });
  Object.entries(segmentData || {}).forEach(([k, v]) => {
    const row = sheet.addRow([
      k,
      v.present || 0,
      v.absent || 0,
      v.lateEntry || 0,
      v.earlyExit || 0,
      v.missPunch || 0,
    ]);
    row.eachCell((c) => {
      c.border = thinBorder;
    });
  });
}

function buildKpiDashboardSheet(workbook, prev, today) {
  const sheet = workbook.addWorksheet("KPI Dashboard");
  appendOverallKpiSection(sheet, "OVERALL KPI - PREVIOUS DAY", prev);
  appendOverallKpiSection(sheet, "OVERALL KPI - TODAY", today);
  appendSegmentKpiSection(
    sheet,
    "COMPANY WISE KPI - PREVIOUS DAY",
    prev?.companyWise,
  );
  appendSegmentKpiSection(
    sheet,
    "COMPANY WISE KPI - TODAY",
    today?.companyWise,
  );
  appendSegmentKpiSection(
    sheet,
    "DEPARTMENT WISE KPI - PREVIOUS DAY",
    prev?.departmentWise,
  );
  appendSegmentKpiSection(
    sheet,
    "DEPARTMENT WISE KPI - TODAY",
    today?.departmentWise,
  );
  appendSegmentKpiSection(
    sheet,
    "UNIT WISE KPI - PREVIOUS DAY",
    prev?.unitWise,
  );
  appendSegmentKpiSection(sheet, "UNIT WISE KPI - TODAY", today?.unitWise);
}

function buildEmployeeDetailSheet(
  workbook,
  sheetName,
  reportSource,
  isPreviousDay,
) {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.mergeCells("A1:I1");
  sheet.getCell("A1").value =
    `${sheetName.toUpperCase()} DETAILS (${formatReportDateLabel(reportSource)})`;

  const standardSections = [
    {
      t: "Absent Employees",
      c: SECTION_COLORS.absent,
      h: ABSENT_TABLE_HEADERS,
      d: reportSource?.absentEmployees,
      m: mapAbsentEmployeeRow,
      e: "No records.",
    },
    {
      t: "Late Entry Employees",
      c: SECTION_COLORS.lateEntry,
      h: PUNCH_ISSUE_TABLE_HEADERS,
      d: reportSource?.lateEntryEmployees,
      m: mapPunchIssueRow,
      e: "No records.",
    },
    {
      t: "Early Exit Employees",
      c: SECTION_COLORS.earlyExit,
      h: PUNCH_ISSUE_TABLE_HEADERS,
      d: reportSource?.earlyExitEmployees,
      m: mapPunchIssueRow,
      e: "No records.",
    },
    {
      t: "Miss Punch Employees",
      c: SECTION_COLORS.missPunch,
      h: PUNCH_ISSUE_TABLE_HEADERS,
      d: reportSource?.missPunchEmployees,
      m: mapPunchIssueRow,
      e: "No records.",
    },
  ];
  standardSections.forEach((s) =>
    appendEmployeeListSection(sheet, {
      sectionTitle: s.t,
      titleColor: s.c,
      headerFillColor: s.c,
      columnHeaders: s.h,
      employeeRecords: s.d,
      rowMapper: s.m,
      emptyStateMessage: s.e,
    }),
  );

  if (isPreviousDay && reportSource) {
    sheet.addRow([]);
    sheet.addRow(["Monthly Frequent Offenders Analysis"]).font = {
      ...textBold,
      size: 12,
      color: { argb: SECTION_COLORS.neutral },
    };
    const freq = [
      {
        t: "Frequent Absentees",
        c: SECTION_COLORS.absent,
        d: reportSource.frequentAbsentEmployees,
      },
      {
        t: "Frequent Late Entries",
        c: SECTION_COLORS.lateEntry,
        d: reportSource.frequentLateEntryEmployees,
      },
      {
        t: "Frequent Early Exits",
        c: SECTION_COLORS.earlyExit,
        d: reportSource.frequentEarlyExitEmployees,
      },
      {
        t: "Frequent Miss Punches",
        c: SECTION_COLORS.missPunch,
        d: reportSource.frequentMissPunchEmployees,
      },
    ];
    freq.forEach((f) =>
      appendEmployeeListSection(sheet, {
        sectionTitle: f.t,
        titleColor: f.c,
        headerFillColor: f.c,
        columnHeaders: FREQUENT_TABLE_HEADERS,
        employeeRecords: f.d,
        rowMapper: mapFrequentOffenderRow,
        emptyStateMessage: "No data.",
      }),
    );
  }
}

/** Builds the attendance workbook and returns it as a Buffer (same sheets and layout as the desktop app). */
const buildExcelReport = async (reportData) => {
  const workbook = new ExcelJS.Workbook();
  buildKpiDashboardSheet(workbook, reportData.previousDayReport, reportData.todayReport);
  buildEmployeeDetailSheet(workbook, "Previous Day Report", reportData.previousDayReport, true);
  buildEmployeeDetailSheet(workbook, "Today Report", reportData.todayReport, false);
  return Buffer.from(await workbook.xlsx.writeBuffer());
};

export default buildExcelReport;
