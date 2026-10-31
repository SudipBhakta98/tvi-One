# Attendance Module (HR)

Web version of the AttendIQ desktop app. Same rules and screens; Excel parsing stays in the browser, everything else runs on the TVI One API.

## Flow
1. HR Manager opens **Attendance → Upload Attendance Logs** and drops the biometric `.xlsx`.
2. `utils/parseAttendanceFile.js` reads the first sheet (ExcelJS, loaded only at this moment) and `utils/NormalizeAttendanceCell.js` cleans dates, times, codes and text.
3. `POST /api/attendance/upload` receives the rows. The backend consolidates punches per employee and date, allocates shifts, flags Late Entry / Early Exit / Miss Punch, and stores Today vs Previous-day reports plus monthly offender lists.
4. `GET /api/attendance/report?date=DD-MM-YYYY` feeds the dashboard. `GET /api/attendance/report/export` downloads the same data as Excel.

## Files (frontend, `src/modules/attendance/`)
| File | Purpose |
|---|---|
| `pages/AttendancePage.jsx` | Header, search, day tabs, upload dialog, Excel download |
| `contexts/AttendanceContext.jsx` | Report state, `fetchReport(date)`, `uploadAttendance(rows)`, `downloadReport()` |
| `components/AttendancePanel.jsx` | KPI cards + organizational breakdown + exception list (used for both tabs) |
| `components/EmployeeTable.jsx` | Single-event list and "Frequently ..." streak list |
| `components/DateFilter.jsx` | Year / Month / Day picker for previous-day reports |
| `components/DistributionList.jsx` | Per company / department / unit counters |
| `components/PillTabs.jsx` | Reusable segmented tabs |
| `components/AttendanceUploader.jsx` | Drag-and-drop uploader |
| `utils/parseAttendanceFile.js` | `.xlsx` to normalized rows |
| `utils/NormalizeAttendanceCell.js` | Cell normalizers (unchanged from the desktop app) |
| `constants/attendanceConstants.js` | Required columns, tabs, log categories, table columns |

Backend: `backend/modules/attendance/` (models, services, controllers, routes, constants).

## Access
- `HR_MANAGER`, Admin, Super User: view, upload, download.
- `HR_USER`: view and download only.

## Removed vs desktop app
Report e-mail sending (and its credentials). The Excel report is now a **Download Excel Report** button.

## Deployment notes
- `npm install` in `frontend/` and `backend/` (adds `exceljs` to both).
- Production disables Mongoose auto-indexing: run `syncIndexes()` once for the three `Attendance*` models, otherwise the 24 h auto-delete of today's report never happens.
- "Today" and month keys use `Asia/Kolkata` (`REPORT_TIME_ZONE`).
