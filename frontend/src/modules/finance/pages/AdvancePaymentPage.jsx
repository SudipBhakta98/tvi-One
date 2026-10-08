import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, AlertCircle } from "lucide-react";
import { paymentApi } from "../api.js";
import MakeAdvanceDialog from "../components/advanceComponents/MakeAdvanceDialog.jsx";
import AdvanceDetailDialog, { AdvanceStatusBadge } from "../components/advanceComponents/AdvanceDetailDialog.jsx";
import { formatCurrency, formatDateDMY } from "../utils/financeFormat.js";

const monthKey = (raw) => {
  const d = new Date(raw);
  if (!raw || Number.isNaN(d.getTime())) return null;
  return {
    value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
  };
};

export default function AdvancePaymentPage() {
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [isMakeOpen, setIsMakeOpen] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await paymentApi.getSupplierAdvances();
      const data = res.data?.data || [];
      setAdvances(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to fetch advance payments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Sidebar link "Make Advance Payment" -> /finance/advances?create=1
  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setIsMakeOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const rows = useMemo(
    () =>
      advances.map((a) => {
        const reserved = Number(a.totalAllocationRequestAmount || 0);
        const balance = Number(a.pendingAdjustmentAmount || 0);
        return {
          ...a,
          date: a.paymentId?.paymentDate || a.createdAt,
          advanceAmount: Number(a.advanceAmount || 0),
          settled: Number(a.totalAdjustedAmount || 0),
          reserved,
          // Cancelled / not-yet-approved money is not usable balance.
          available: ["Approved", "Partially Adjusted"].includes(a.status) ? Math.max(0, balance - reserved) : 0,
        };
      }),
    [advances],
  );

  const metrics = useMemo(
    () =>
      rows.reduce(
        (m, r) => {
          if (r.status === "Cancelled") return m;
          m.total += r.advanceAmount;
          m.settled += r.settled;
          m.reserved += r.reserved;
          m.available += r.available;
          if (r.status === "Pending") m.waiting += r.advanceAmount;
          return m;
        },
        { total: 0, settled: 0, reserved: 0, available: 0, waiting: 0 },
      ),
    [rows],
  );

  const months = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => { const m = monthKey(r.date); if (m) map.set(m.value, m.label); });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = searchInput.toLowerCase().trim();
    return rows.filter((r) => {
      const matchSearch = !q || r.advanceNumber.toLowerCase().includes(q) || r.supplierName.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const m = monthKey(r.date);
      const matchMonth = monthFilter === "all" || m?.value === monthFilter;
      const matchAvail = !onlyAvailable || r.available > 0;
      return matchSearch && matchStatus && matchMonth && matchAvail;
    });
  }, [rows, searchInput, statusFilter, monthFilter, onlyAvailable]);

  const knownSuppliers = useMemo(() => [...new Set(advances.map((a) => a.supplierName))], [advances]);

  if (loading && advances.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-50 text-slate-400">
        <div className="animate-pulse flex items-center gap-2 font-medium"><RefreshCw className="animate-spin" size={18} />Loading advance payments...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-50 text-rose-600 gap-2">
        <AlertCircle size={32} />
        <span className="font-semibold">{error}</span>
        <button onClick={load} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 hover:bg-slate-100 transition">Retry</button>
      </div>
    );
  }

  const Card = ({ tone, label, value, hint, valueCls }) => (
    <div className={`p-2 rounded-xl bg-white border border-slate-200 border-l-4 ${tone} shadow-md flex flex-col justify-between`}>
      <div className="text-xs font-bold tracking-wider text-slate-400 uppercase">{label}</div>
      <div className={`my-2 text-3xl font-black tracking-tight ${valueCls}`}>{value}</div>
      <div className="text-xs text-slate-500 font-medium">{hint}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-3 py-2">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Advance Register</h1>
          <p className="text-base text-slate-400">Advance paid to suppliers, available balance and settlements</p>
        </div>
        <button
          onClick={() => setIsMakeOpen(true)}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-colors self-start sm:self-auto"
        >
          + Make Advance Payment
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card tone="border-l-blue-500" label="Total Advance Paid" value={formatCurrency(metrics.total)} valueCls="text-indigo-600" hint={`${rows.filter((r) => r.status !== "Cancelled").length} advances made`} />
        <Card tone="border-l-emerald-500" label="Available Balance" value={formatCurrency(metrics.available)} valueCls="text-emerald-600" hint="Ready to settle against invoices" />
        <Card tone="border-l-amber-500" label="Reserved / Awaiting" value={formatCurrency(metrics.reserved + metrics.waiting)} valueCls="text-amber-500" hint="Pending payments + unapproved advances" />
        <Card tone="border-l-slate-500" label="Total Settled" value={formatCurrency(metrics.settled)} valueCls="text-slate-700" hint="Used against approved payments" />
      </div>

      <div className="flex flex-wrap items-center gap-2 p-2 mb-6 rounded-xl bg-white border border-slate-200 text-base">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-bold text-lg">⊟</span>
          <span className="font-bold tracking-wide text-slate-700 uppercase text-xs">Filters</span>
        </div>
        <div className="h-5 w-px bg-slate-300 hidden lg:block" />

        <div className="relative w-full lg:flex-1 lg:min-w-[280px]">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by Advance # or supplier..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-10 py-2.5 text-xs text-slate-700 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition"
          />
          {searchInput && (
            <button type="button" onClick={() => setSearchInput("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 transition">✕</button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-bold text-slate-400 uppercase shrink-0">Month</label>
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="sm:w-44 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-indigo-500 text-xs">
            <option value="all">All Months</option>
            {months.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-bold text-slate-400 uppercase shrink-0">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-48 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-indigo-500 text-xs">
            <option value="all">All Statuses</option>
            <option value="Pending">Awaiting Approval</option>
            <option value="Approved">Approved</option>
            <option value="Partially Adjusted">Partially Adjusted</option>
            <option value="Fully Adjusted">Fully Adjusted</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto cursor-pointer select-none">
          <input type="checkbox" id="onlyAvailableAdvance" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} className="h-4 w-4 rounded accent-blue-600 cursor-pointer" />
          <label htmlFor="onlyAvailableAdvance" className="text-xs font-bold text-slate-700 hover:text-slate-900 cursor-pointer">Has Available Balance</label>
        </div>
      </div>

      <div className="w-full overflow-hidden border border-slate-200 rounded-xl bg-white shadow-xl">
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-400 font-medium">No advance payments match the selected conditions.</div>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 text-xs font-bold tracking-wider uppercase border-b border-slate-200">
                  <th className="px-3 py-2 font-mono">Advance #</th>
                  <th className="px-3 py-2">Supplier</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Advance Amount</th>
                  <th className="px-3 py-2">Settled</th>
                  <th className="px-3 py-2">Reserved</th>
                  <th className="px-3 py-2">Available</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r._id} onClick={() => setSelectedId(r._id)} className="hover:bg-slate-50 transition-colors group cursor-pointer">
                    <td className="px-3 py-2 font-mono text-xs text-slate-500 group-hover:text-indigo-600 transition-colors font-bold">{r.advanceNumber}</td>
                    <td className="px-3 py-2 text-xs font-semibold text-slate-800">{r.supplierName}</td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap text-xs">{formatDateDMY(r.date)}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900 text-xs">{formatCurrency(r.advanceAmount)}</td>
                    <td className="px-3 py-2 font-bold text-slate-500 text-xs">{formatCurrency(r.settled)}</td>
                    <td className="px-3 py-2 font-bold text-amber-500 text-xs">{formatCurrency(r.reserved)}</td>
                    <td className={`px-3 py-2 font-bold text-xs ${r.available > 0 ? "text-emerald-600" : "text-slate-400"}`}>{formatCurrency(r.available)}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><AdvanceStatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedId && <AdvanceDetailDialog advanceId={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}

      <MakeAdvanceDialog isOpen={isMakeOpen} onClose={() => setIsMakeOpen(false)} onSuccess={load} knownSuppliers={knownSuppliers} />
    </div>
  );
}
