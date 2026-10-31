import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Upload } from "lucide-react";
import { useAuth } from "../../auth/contexts/AuthContext";
import { useAttendance } from "../contexts/AttendanceContext";
import { isDeptManager } from "../../../constants/roles";
import { PageHeader, FilterBar, PrimaryButton, GhostButton, Modal, Select, Alert, EmptyState } from "../../../components/ui";
import PillTabs from "../components/PillTabs";
import AttendancePanel from "../components/AttendancePanel";
import AttendanceUploader from "../components/AttendanceUploader";
import DateFilter from "../components/DateFilter";
import { DAY_TABS, DEFAULT_LOG_CATEGORY, LOG_CATEGORIES, LOG_CATEGORY_GROUPS } from "../constants/attendanceConstants";

const NOT_AVAILABLE = "N/A";
const SEARCH_FIELDS = ["employeeName", "employeeCode", "department", "company", "unit"];

const formatDisplayDate = (date) => (!date ? NOT_AVAILABLE : typeof date === "string" ? date.split("T")[0] : String(date));

const getTotals = (dayReport) => {
  const present = dayReport?.totalPresent || 0;
  const absent = dayReport?.totalAbsent || 0;
  const total = present + absent;
  return { present, absent, total, rate: total > 0 ? ((present / total) * 100).toFixed(0) : 0 };
};

export default function AttendancePage() {
  const { user } = useAuth();
  const { report, loading, error, fetchReport, downloadReport } = useAttendance();
  const canUpload = isDeptManager(user?.role, "HR");

  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeDayTab, setActiveDayTab] = useState(DAY_TABS.TODAY);
  const [logCategory, setLogCategory] = useState(DEFAULT_LOG_CATEGORY);
  const [downloading, setDownloading] = useState(false);

  // The upload dialog is driven by the URL (?upload=1) so the sidebar link and the header button open it the same way.
  const uploadOpen = canUpload && searchParams.get("upload") === "1";
  const setUploadOpen = (open) => setSearchParams(open ? { upload: "1" } : {}, { replace: true });

  const today = report?.todayReport;
  const previous = report?.previousDayReport;
  const todayTotals = getTotals(today);
  const previousTotals = getTotals(previous);
  const category = LOG_CATEGORIES.find((option) => option.key === logCategory);

  const matchesSearch = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    return (employee) => !query || SEARCH_FIELDS.some((field) => (employee?.[field] || "").toLowerCase().includes(query));
  }, [searchTerm]);

  const todayList = (today?.absentEmployees || []).filter(matchesSearch);
  const previousList = (previous?.[category.field] || []).filter(matchesSearch);

  const handleDownload = async () => {
    setDownloading(true);
    try { await downloadReport(); } catch { /* the API client already toasts the failure */ } finally { setDownloading(false); }
  };

  const dayTabs = [
    { key: DAY_TABS.TODAY, label: `Today's Attendance Live Feed (${formatDisplayDate(today?.reportDate)})` },
    { key: DAY_TABS.PREVIOUS, label: `Previous Day's Comprehensive Report (${formatDisplayDate(previous?.date)})` },
  ];

  const categorySelect = (
    <div className="flex items-center gap-2">
      <span className="rounded border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">Found: {previousList.length}</span>
      <Select value={logCategory} onChange={(e) => setLogCategory(e.target.value)} className="min-w-[210px] !py-1.5 !text-xs">
        {LOG_CATEGORY_GROUPS.map(({ group, options }) => (
          <optgroup key={group} label={group}>
            {options.map((option) => <option key={option.key} value={option.key}>{option.label} ({previous?.[option.field]?.length || 0})</option>)}
          </optgroup>
        ))}
      </Select>
    </div>
  );

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="HR"
        title="Attendance Dashboard"
        subtitle="Micro-analytics dashboard panel with dedicated exception feeds"
        actions={
          <div className="flex items-center gap-2">
            <GhostButton onClick={handleDownload} disabled={downloading || !report?.success}><Download size={14} className="inline mr-1" />{downloading ? "Preparing..." : "Download Excel Report"}</GhostButton>
            {canUpload && <PrimaryButton onClick={() => setUploadOpen(true)}><Upload size={15} />Upload Attendance Logs</PrimaryButton>}
          </div>
        }
      />
      {error && <Alert>{error}</Alert>}
      <FilterBar search={searchTerm} onSearch={setSearchTerm} placeholder="Search Name, Code, Dept, Company, Unit" />

      {!report ? (
        <EmptyState message={loading ? "Loading attendance..." : "No attendance report loaded."} />
      ) : !report.success ? (
        <EmptyState message={`${report.error} ${canUpload ? "Upload attendance logs to get started." : ""}`} />
      ) : (
        <>
          <PillTabs tabs={dayTabs} active={activeDayTab} onChange={setActiveDayTab} />

          {activeDayTab === DAY_TABS.TODAY && (
            <AttendancePanel
              title="Today's Operations Overview"
              dateLabel={formatDisplayDate(today?.reportDate)}
              metrics={[
                { label: "Total Employee", value: todayTotals.total },
                { label: "Present Employee", value: todayTotals.present, tone: "green" },
                { label: "Absent Employee", value: todayTotals.absent, tone: "red" },
                { label: "Present Rate", value: `${todayTotals.rate}%` },
              ]}
              breakdowns={{ company: today?.companyWise, department: today?.departmentWise, unit: today?.unitWise }}
              list={todayList}
              listToolbar={<span className="rounded bg-rose-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">Today Absentees: {todayList.length}</span>}
            />
          )}

          {activeDayTab === DAY_TABS.PREVIOUS && (
            <AttendancePanel
              title="Previous Day's Audit History"
              dateLabel={formatDisplayDate(previous?.date)}
              headerExtra={<DateFilter key={previous?.date} dates={report.allAvailableDates} selectedDate={previous?.date} loading={loading} onSelectDate={fetchReport} />}
              metrics={[
                { label: "Present Records", value: previousTotals.present, tone: "green" },
                { label: "Absent Records", value: previousTotals.absent, tone: "red" },
                { label: "Late Entry", value: previous?.totalLateEntry || 0, tone: "amber" },
                { label: "Early Exit", value: previous?.totalEarlyExit || 0, tone: "amber" },
                { label: "Missed Punch", value: previous?.totalMissPunch || 0, tone: "red" },
                { label: "Attendance Rate", value: `${previousTotals.rate}%` },
              ]}
              breakdowns={{ company: previous?.companyWise, department: previous?.departmentWise, unit: previous?.unitWise }}
              list={previousList}
              frequent={Boolean(category.frequent)}
              categoryLabel={category.label}
              listToolbar={categorySelect}
            />
          )}
        </>
      )}

      <Modal open={uploadOpen} title="Process Attendance Data" onClose={() => setUploadOpen(false)} size="md">
        <AttendanceUploader onUploaded={() => setUploadOpen(false)} />
      </Modal>
    </div>
  );
}
