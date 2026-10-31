import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { UPLOAD_TIMEOUT_MS } from "../constants/attendanceConstants";

const AttendanceContext = createContext(null);

const saveBlob = (blob, fileName) => {
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: fileName });
  link.click();
  URL.revokeObjectURL(link.href);
};

export function AttendanceProvider({ children }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0); // only the newest request may write state

  /** `date` is DD-MM-YYYY for a specific previous day; empty loads the latest. */
  const fetchReport = useCallback(async (date = null) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(ENDPOINTS.ATTENDANCE.REPORT, { params: date ? { date } : {}, toast: false });
      if (requestId === requestIdRef.current) setReport(data);
    } catch (e) {
      if (requestId === requestIdRef.current) setError(e.response?.data?.message || "Unable to load the attendance report");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const uploadAttendance = useCallback(async (rows) => {
    await api.post(ENDPOINTS.ATTENDANCE.UPLOAD, rows, { timeout: UPLOAD_TIMEOUT_MS });
    await fetchReport();
  }, [fetchReport]);

  const downloadReport = useCallback(async () => {
    const date = report?.previousDayReport?.date;
    const { data } = await api.get(ENDPOINTS.ATTENDANCE.EXPORT, { params: date ? { date } : {}, responseType: "blob", toast: false });
    saveBlob(data, `Attendance_Operational_Report_${date || report?.todayReport?.reportDate}.xlsx`);
  }, [report]);

  const value = useMemo(() => ({ report, loading, error, fetchReport, uploadAttendance, downloadReport }), [report, loading, error, fetchReport, uploadAttendance, downloadReport]);
  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

export const useAttendance = () => {
  const context = useContext(AttendanceContext);
  if (!context) throw new Error("useAttendance must be used within its AttendanceProvider");
  return context;
};
