import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { PageHeader, Panel, Select, Input, KpiCard, Table, EmptyState, GhostButton } from "../../../components/ui";

const ALL_DEPARTMENTS = "all";
const FALLBACK_DEPARTMENTS = ["projects", "rfq", "purchase", "production", "warehouse", "dispatch", "finance"];
const METRIC_CARD_LIMIT = 4;
const TABLE_PAGE_SIZE = 25;
const CSV_BOM = "\uFEFF"; // lets Excel read ₹ and other non-ASCII characters correctly
const ARRAY_SEPARATOR = "; ";

const money = (v) => `₹${Math.round(Number(v || 0)).toLocaleString("en-IN")}`;
const label = (key) => key.replaceAll("_", " ");
const isScalar = (v) => v === null || typeof v !== "object";

// Nested objects become "parent.child" columns; arrays are kept (joined or JSON) instead of silently dropped.
const flatten = (value, prefix = "", out = {}) => {
  if (value === null || value === undefined) return out;
  if (Array.isArray(value)) out[prefix] = value.every(isScalar) ? value.join(ARRAY_SEPARATOR) : JSON.stringify(value);
  else if (typeof value === "object") Object.entries(value).forEach(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k, out));
  else out[prefix] = value;
  return out;
};

const unionOfKeys = (flatRows) => [...new Set(flatRows.flatMap(Object.keys))];
const escapeCsv = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
const toCsv = (rows) => {
  const flatRows = rows.map((row) => flatten(row));
  const keys = unionOfKeys(flatRows);
  return [keys.map(escapeCsv).join(","), ...flatRows.map((row) => keys.map((k) => escapeCsv(row[k])).join(","))].join("\n");
};

// rows is either one list, or { recordType: list } for reports made of several tables (e.g. RFQ + parts + remarks).
const rowsForExport = (payload) => {
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (payload?.rows && typeof payload.rows === "object") {
    return Object.entries(payload.rows).flatMap(([type, items]) => (Array.isArray(items) ? items.map((item) => ({ record_type: type, ...item })) : []));
  }
  return [];
};

export default function ReportsPage() {
  const [department, setDepartment] = useState(ALL_DEPARTMENTS);
  const [range, setRange] = useState({ from_date: "", to_date: "" });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { department, ...Object.fromEntries(Object.entries(range).filter(([, v]) => v)) };
      setReport((await api.get(ENDPOINTS.DASHBOARD.REPORTS, { params })).data);
    } catch (e) {
      setReport(null);
      setError(e.response?.data?.message || e.response?.data?.error || "Could not generate the report");
    } finally {
      setLoading(false);
    }
  }, [department, range]);
  useEffect(() => { load(); }, [load]);

  // The server says which departments this role may report on, so a role never sees an option it would be refused.
  const departments = [ALL_DEPARTMENTS, ...(report?.allowed_departments || FALLBACK_DEPARTMENTS)];
  const sections = useMemo(() => Object.entries(report?.reports || {}), [report]);

  const downloadSection = (name, payload) => {
    const rows = rowsForExport(payload);
    if (!rows.length) return;
    const url = URL.createObjectURL(new Blob([CSV_BOM + toCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `tvi-one-${name}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <PageHeader eyebrow="Reporting" title="Department Reports" subtitle="Query operational data by department and date range, then export the selected dataset to CSV." />
      <Panel title="Report filters">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] font-bold uppercase text-slate-500">Department
            <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
              {departments.map((d) => <option key={d} value={d}>{label(d).toUpperCase()}</option>)}
            </Select>
          </label>
          <label className="text-[10px] font-bold uppercase text-slate-500">From<Input type="date" value={range.from_date} onChange={(e) => setRange({ ...range, from_date: e.target.value })} /></label>
          <label className="text-[10px] font-bold uppercase text-slate-500">To<Input type="date" value={range.to_date} onChange={(e) => setRange({ ...range, to_date: e.target.value })} /></label>
          <GhostButton onClick={() => setRange({ from_date: "", to_date: "" })}>Reset dates</GhostButton>
        </div>
      </Panel>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
      {loading
        ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">Generating report…</div>
        : !sections.length ? <EmptyState />
        : sections.map(([name, payload]) => <ReportSection key={name} name={name} payload={payload} onDownload={() => downloadSection(name, payload)} />)}
    </div>
  );
}

function ReportSection({ name, payload, onDownload }) {
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const grouped = payload.rows && typeof payload.rows === "object" && !Array.isArray(payload.rows) ? payload.rows : null;
  const metrics = Object.entries(payload).filter(([k, v]) => k !== "rows" && isScalar(v)).slice(0, METRIC_CARD_LIMIT);
  const downloadButton = (
    <button type="button" onClick={onDownload} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-800">
      <Download size={13} />CSV
    </button>
  );
  return (
    <Panel title={label(name).toUpperCase()} toolbar={downloadButton}>
      <div className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-4">
        {metrics.map(([k, v]) => <KpiCard key={k} label={label(k)} value={typeof v === "number" && k.includes("amount") ? money(v) : v} />)}
      </div>
      {grouped
        ? Object.entries(grouped).map(([type, typeRows]) => (
          <div key={type} className="mb-3"><div className="mb-1 text-xs font-bold uppercase text-slate-500">{label(type)} ({typeRows.length})</div><SimpleTable rows={typeRows} /></div>
        ))
        : rows.length ? <SimpleTable rows={rows} /> : <EmptyState message="No rows for this date range." />}
    </Panel>
  );
}

const PagerButton = (props) => <button type="button" className="rounded-lg border border-slate-300 px-2 py-1 font-bold text-slate-700 disabled:opacity-40" {...props} />;

// Shows every column of every row, paged, and scrolls sideways instead of cutting columns off.
function SimpleTable({ rows = [] }) {
  const [page, setPage] = useState(0);
  const flatRows = useMemo(() => rows.map((row) => flatten(row)), [rows]);
  const columns = useMemo(() => unionOfKeys(flatRows), [flatRows]);
  if (!rows.length) return <EmptyState message="No rows." />;

  const pageCount = Math.ceil(flatRows.length / TABLE_PAGE_SIZE);
  const visible = flatRows.slice(page * TABLE_PAGE_SIZE, (page + 1) * TABLE_PAGE_SIZE);
  return (
    <div>
      <div className="overflow-x-auto">
        <Table columns={columns.map(label)}>
          {visible.map((row, i) => <tr key={i}>{columns.map((k) => <td key={k} className="whitespace-nowrap px-3 py-2 text-xs text-slate-700">{String(row[k] ?? "—")}</td>)}</tr>)}
        </Table>
      </div>
      {pageCount > 1 && (
        <div className="mt-1 flex items-center justify-end gap-2 text-xs text-slate-500">
          <PagerButton onClick={() => setPage(page - 1)} disabled={page === 0}>Prev</PagerButton>
          <span>Page {page + 1} of {pageCount}</span>
          <PagerButton onClick={() => setPage(page + 1)} disabled={page >= pageCount - 1}>Next</PagerButton>
        </div>
      )}
    </div>
  );
}