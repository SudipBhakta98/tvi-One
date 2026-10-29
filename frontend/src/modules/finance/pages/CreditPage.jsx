// src/pages/CreditPage.jsx

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, AlertCircle } from "lucide-react";
import { creditApi } from "../api.js";
import CreditNoteDialog from "../components/creditComponets/CreditNoteDialog.jsx";
import CreateCreditDialog from "../components/creditComponets/CreateCreditDialog.jsx";
import { formatCurrency, formatDateDMY } from "../utils/financeFormat.js";

// ============================================================
// HELPERS & FORMATTERS
// ============================================================

const getMonthYearLabel = (dateStr) => {
  if (!dateStr) return null;
  const parsedDate = new Date(dateStr);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return {
    value: dateStr.slice(0, 7), // YYYY-MM
    label: parsedDate.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    }),
  };
};

const getCreditStatus = (item) => {
  const total = Number(item.creditNoteAmount) || 0;
  const allocated = Number(item.totalAllocatedAmount) || 0;
  const pending = Number(item.pendingAllocationAmount) || 0;

  if (allocated === 0 && pending === total) return "unallocated";
  if (allocated > 0 && pending > 0) return "partial";
  if (allocated >= total || pending === 0) return "allocated";
  return "pending_request";
};

// ============================================================
// BADGE COMPONENT
// ============================================================

function CreditStatusBadge({ status }) {
  const badgeStyles = {
    unallocated: "bg-rose-50 text-rose-600 border-rose-300/20",
    partial: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    allocated: "bg-emerald-50 text-emerald-600 border-emerald-200",
    pending_request: "bg-indigo-50 text-indigo-600 border-indigo-500/20",
  };

  const statusLabels = {
    unallocated: "Unallocated",
    partial: "Partially Allocated",
    allocated: "Fully Allocated",
    pending_request: "Pending Request",
  };

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full font-semibold border text-xs capitalize whitespace-nowrap ${
        badgeStyles[status] ||
        "bg-slate-500/10 text-slate-400 border-slate-500/20"
      }`}
    >
      {statusLabels[status] || status}
    </span>
  );
}

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================

export default function CreditPage() {
  const [creditNotes, setCreditNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [selectedCreditNoteNo, setSelectedCreditNoteNo] = useState(null);

  // Filters & Search
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [onlyRequestedAllocation, setOnlyRequestedAllocation] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Load Data
  const fetchCreditNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await creditApi.getCreditNotes();

      const responseData = res.data?.data || res.data || [];
      setCreditNotes(Array.isArray(responseData) ? responseData : []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to fetch credit notes.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditNotes();
  }, []);

  useEffect(() => { if (searchParams.get("create") === "1") { setIsCreateModalOpen(true); setSearchParams({}, { replace: true }); } }, [searchParams, setSearchParams]);

  // Normalization & Calculations
  const normalizedNotes = useMemo(() => {
    return creditNotes.map((item) => ({
      ...item,
      creditNoteNumber: item.creditNoteNumber || "—",
      creditNoteAmount: Number(item.creditNoteAmount || 0),
      totalAllocatedAmount: Number(item.totalAllocatedAmount || 0),
      totalAllocationRequestAmount: Number(
        item.totalAllocationRequestAmount || 0,
      ),
      pendingAllocationAmount: Number(item.pendingAllocationAmount || 0),
      creditNoteDate: item.creditNoteDate || item.createdAt || null,
      status: getCreditStatus(item),
    }));
  }, [creditNotes]);

  // Overall Metrics
  const metrics = useMemo(() => {
    return normalizedNotes.reduce(
      (acc, note) => {
        acc.totalCreditBalance += note.creditNoteAmount;
        acc.totalAvailableBalance += note.pendingAllocationAmount;
        acc.totalAllocatedBalance += note.totalAllocatedAmount;
        acc.totalRequestedBalance += note.totalAllocationRequestAmount;
        return acc;
      },
      {
        totalCreditBalance: 0,
        totalAvailableBalance: 0,
        totalAllocatedBalance: 0,
        totalRequestedBalance: 0,
      },
    );
  }, [normalizedNotes]);

  // Filter options
  const availableMonths = useMemo(() => {
    const monthMap = new Map();
    normalizedNotes.forEach((note) => {
      const parsed = getMonthYearLabel(note.creditNoteDate);
      if (parsed) {
        monthMap.set(parsed.value, parsed.label);
      }
    });
    return Array.from(monthMap.entries()).sort((a, b) =>
      b[0].localeCompare(a[0]),
    );
  }, [normalizedNotes]);

  // Master Table Filtered Results
  const filteredCreditNotes = useMemo(() => {
    return normalizedNotes.filter((note) => {
      const query = searchInput.toLowerCase().trim();
      const matchesSearch =
        !query ||
        note.creditNoteNumber.toLowerCase().includes(query) ||
        (note.remark && note.remark.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "all" || note.status === statusFilter;

      const matchesMonth =
        monthFilter === "all" ||
        (note.creditNoteDate &&
          String(note.creditNoteDate).startsWith(monthFilter));

      const matchesRequestedAllocation =
        !onlyRequestedAllocation || note.totalAllocationRequestAmount > 0;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesMonth &&
        matchesRequestedAllocation
      );
    });
  }, [
    normalizedNotes,
    searchInput,
    statusFilter,
    monthFilter,
    onlyRequestedAllocation,
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-50 text-slate-400">
        <div className="animate-pulse flex items-center gap-2 font-medium">
          <RefreshCw className="animate-spin" size={18} />
          Loading credit notes...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-50 text-rose-600 gap-2">
        <AlertCircle size={32} />
        <span className="font-semibold">{error}</span>
        <button
          onClick={fetchCreditNotes}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 hover:bg-slate-800 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-3 py-2">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">
            Credit Notes
          </h1>
          <p className="text-base text-slate-400">
            Overview, unallocated balance, and allocation logs
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-colors self-start sm:self-auto"
        >
          + Create Credit Note
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="p-2 rounded-xl bg-white border border-slate-200 border-l-4 border-l-blue-500 shadow-md flex flex-col justify-between">
          <div className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            Total Credit Amount
          </div>
          <div className="my-2 text-3xl font-black tracking-tight text-indigo-600">
            {formatCurrency(metrics.totalCreditBalance)}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            {normalizedNotes.length} credit notes issued
          </div>
        </div>

        <div className="p-2 rounded-xl bg-white border border-slate-200 border-l-4 border-l-emerald-500 shadow-md flex flex-col justify-between">
          <div className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            Available / Unallocated
          </div>
          <div className="my-2 text-3xl font-black tracking-tight text-emerald-600">
            {formatCurrency(metrics.totalAvailableBalance)}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Ready to be applied
          </div>
        </div>

        <div className="p-2 rounded-xl bg-white border border-slate-200 border-l-4 border-l-amber-500 shadow-md flex flex-col justify-between">
          <div className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            Pending Allocation Requests
          </div>
          <div className="my-2 text-3xl font-black tracking-tight text-amber-400">
            {formatCurrency(metrics.totalRequestedBalance)}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Awaiting processing
          </div>
        </div>

        <div className="p-2 rounded-xl bg-white border border-slate-200 border-l-4 border-l-slate-500 shadow-md flex flex-col justify-between">
          <div className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            Total Allocated
          </div>
          <div className="my-2 text-3xl font-black tracking-tight text-slate-700">
            {formatCurrency(metrics.totalAllocatedBalance)}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Utilized against payments
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 p-2 mb-6 rounded-xl bg-white border border-slate-200 text-base">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-bold text-lg">⊟</span>
          <span className="font-bold tracking-wide text-slate-700 uppercase text-xs">
            Filters
          </span>
        </div>

        <div className="h-5 w-px bg-slate-800 hidden lg:block" />

        <div className="relative w-full lg:flex-1 lg:min-w-[280px]">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by Credit Note # or remark..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-10 py-2.5 text-xs text-slate-700 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 transition"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-bold text-slate-400 uppercase shrink-0">
            Month
          </label>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="sm:w-44 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-indigo-500 text-xs"
          >
            <option value="all">All Months</option>
            {availableMonths.map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-bold text-slate-400 uppercase shrink-0">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="sm:w-48 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-indigo-500 text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="unallocated">Unallocated</option>
            <option value="partial">Partially Allocated</option>
            <option value="allocated">Fully Allocated</option>
          </select>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto cursor-pointer select-none">
          <input
            type="checkbox"
            id="requestedAllocationFilter"
            checked={onlyRequestedAllocation}
            onChange={(e) => setOnlyRequestedAllocation(e.target.checked)}
            className="h-4 w-4 rounded border-slate-700 bg-slate-50 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
          />
          <label
            htmlFor="requestedAllocationFilter"
            className="text-xs font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            Has Requested Allocation
          </label>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="w-full overflow-hidden border border-slate-200 rounded-xl bg-white shadow-xl">
        <div className="overflow-x-auto">
          {filteredCreditNotes.length === 0 ? (
            <div className="text-center py-8 text-slate-400 font-medium">
              No credit notes match the selected conditions.
            </div>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 text-xs font-bold tracking-wider uppercase border-b border-slate-200">
                  <th className="px-3 py-2 font-mono">Credit Note #</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Credit Note Amount</th>
                  <th className="px-3 py-2">Total Allocated</th>
                  <th className="px-3 py-2">Requested Allocation</th>
                  <th className="px-3 py-2">Remaining Balance</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredCreditNotes.map((note) => (
                  <tr
                    key={note._id || note.creditNoteNumber}
                    onClick={() =>
                      setSelectedCreditNoteNo(note.creditNoteNumber)
                    }
                    className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-slate-400 group-hover:text-indigo-600 transition-colors font-bold">
                      {note.creditNoteNumber}
                    </td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap text-xs">
                      {formatDateDMY(note.creditNoteDate)}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-900 text-xs">
                      {formatCurrency(note.creditNoteAmount)}
                    </td>
                    <td className="px-3 py-2 font-bold text-slate-400 text-xs">
                      {formatCurrency(note.totalAllocatedAmount)}
                    </td>
                    <td className="px-3 py-2 font-bold text-amber-500 text-xs">
                      {formatCurrency(note.totalAllocationRequestAmount)}
                    </td>
                    <td
                      className={`px-3 py-2 font-bold text-xs ${
                        note.pendingAllocationAmount > 0
                          ? "text-emerald-600"
                          : "text-slate-500"
                      }`}
                    >
                      {formatCurrency(note.pendingAllocationAmount)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <CreditStatusBadge status={note.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Dialogue Integration */}
      {selectedCreditNoteNo && (
        <CreditNoteDialog
          creditNoteNumber={selectedCreditNoteNo}
          onClose={() => setSelectedCreditNoteNo(null)}
        />
      )}
      {/* Create Modal Integration */}
      <CreateCreditDialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchCreditNotes}
      />
    </div>
  );
}