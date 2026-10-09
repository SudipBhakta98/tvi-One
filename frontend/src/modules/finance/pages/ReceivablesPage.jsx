// src/pages/ReceivablesPage.jsx

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";

import { receivablesApi } from "../api.js";
import { useReceivables } from "../contexts/ReceivableContext.jsx";
import ExcelFilterDropdown from "../components/common/ExcelFilterDropdown.jsx";
import useMultiFilter from "../hooks/useMultiFilter.js";
import { StatusBadge, DueDaysBadge } from "../components/receivableComponents/ReceivableBadges.jsx";
import ReceivablesInvoiceDialog from "../components/receivableComponents/ReceivablesInvoiceDialog.jsx";
import AddReceivableDialog from "../components/receivableComponents/AddReceivableDialog.jsx";
import { formatCurrency, formatDateString, parseDateString } from "../utils/financeFormat.js";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_RESULT_LIMIT = 100;
const PERCENT_DECIMALS = 1;

const STATUS_OPTIONS = [
  { value: "collected", label: "Collected" },
  { value: "partial", label: "Partial" },
  { value: "uncollected", label: "Uncollected" },
];

// API row (camelCase, used as is) -> row used by the page: only trims / defaults what can be missing.
const normalizeInvoice = (item) => ({
  ...item,
  _id: item._id || item.id || null,
  customerName: (item.customerName ?? "").trim(),
  outstanding: Number(item.outstanding || 0),
  status: item.status || "uncollected",
});

const percentOf = (part, whole) => (whole > 0 ? ((part / whole) * 100).toFixed(PERCENT_DECIMALS) : 0);
const sumOf = (invoices, key) => invoices.reduce((sum, invoice) => sum + (Number(invoice[key]) || 0), 0);
const countOf = (invoices, status) => invoices.filter((invoice) => String(invoice.status).toLowerCase() === status).length;

export default function ReceivablesPage() {
  const { analyticsData, storeAnalytics, searchResults, storeSearchResults, clearSearch } = useReceivables();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const [activeInvoiceId, setActiveInvoiceId] = useState(null);

  // The URL (?create=1) is the source of truth for the Create Receivable page.
  const isCreateOpen = searchParams.get("create") === "1";
  const closeCreateReceivable = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("create");
    setSearchParams(nextParams, { replace: true });
  };

  const totalInvoicesList = useMemo(() => (analyticsData?.data || []).map(normalizeInvoice), [analyticsData?.data]);
  const searchInvoicesList = useMemo(
    () => (searchResults?.searchReceivables || []).map(normalizeInvoice),
    [searchResults?.searchReceivables],
  );
  const isSearching = searchInput.trim() !== "";
  const baseInvoicesList = isSearching ? searchInvoicesList : totalInvoicesList;

  // silent = refresh data without replacing the page with the loading screen (keeps dialogs open)
  const loadAnalytics = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const response = await receivablesApi.getAnalytics([]);
      if (!response.data?.success) throw new Error(response.data?.message || "Failed to load receivable analytics.");
      storeAnalytics(response.data);
    } catch (err) {
      if (!silent) setError(err.response?.data?.message || err.message || "Failed to load receivables analytics.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Server-side search (finds invoices outside the months loaded in the register).
  const searchRequestRef = useRef(0);
  const runSearch = async (term) => {
    const requestId = ++searchRequestRef.current;
    try {
      const response = await receivablesApi.search({ search: term, limit: SEARCH_RESULT_LIMIT });
      if (requestId === searchRequestRef.current) storeSearchResults(response.data);
    } catch (err) {
      if (requestId === searchRequestRef.current) storeSearchResults(null);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  useEffect(() => {
    const term = searchInput.trim();
    if (!term) {
      searchRequestRef.current++;
      clearSearch();
      return undefined;
    }
    const timer = setTimeout(() => runSearch(term), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAfterChange = () => {
    loadAnalytics({ silent: true });
    if (isSearching) runSearch(searchInput.trim());
  };

  // Filters
  const customerOptions = useMemo(
    () => [...new Set(baseInvoicesList.map((i) => i.customerName).filter(Boolean))].sort().map((name) => ({ value: name, label: name })),
    [baseInvoicesList],
  );
  const monthOptions = useMemo(() => {
    const monthMap = new Map();
    baseInvoicesList.forEach((invoice) => {
      const parsed = parseDateString(invoice.invoiceDate);
      if (parsed) monthMap.set(parsed.key, parsed.label);
    });
    return [...monthMap.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => b.value.localeCompare(a.value));
  }, [baseInvoicesList]);

  const customerFilter = useMultiFilter(customerOptions);
  const monthFilter = useMultiFilter(monthOptions);
  const statusFilter = useMultiFilter(STATUS_OPTIONS);

  const filteredInvoices = useMemo(
    () =>
      baseInvoicesList.filter((invoice) => {
        const month = parseDateString(invoice.invoiceDate);
        return (
          customerFilter.matches(invoice.customerName) &&
          statusFilter.matches(String(invoice.status).toLowerCase()) &&
          monthFilter.matches(month?.key)
        );
      }),
    [baseInvoicesList, customerFilter.selectedValues, statusFilter.selectedValues, monthFilter.selectedValues], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const metrics = useMemo(() => {
    const groups = {};
    filteredInvoices.forEach((invoice) => {
      const groupKey = invoice.customerName || "Uncategorized";
      (groups[groupKey] ||= []).push(invoice);
    });

    return {
      totalReceivable: sumOf(filteredInvoices, "totalAmount"),
      totalCollection: sumOf(filteredInvoices, "collectedAmount"),
      totalTds: sumOf(filteredInvoices, "tdsAmount"),
      totalOutstanding: sumOf(filteredInvoices, "outstanding"),
      collectedCount: countOf(filteredInvoices, "collected"),
      partialCount: countOf(filteredInvoices, "partial"),
      uncollectedCount: countOf(filteredInvoices, "uncollected"),
      groups,
    };
  }, [filteredInvoices]);

  const resetAllFilters = () => {
    setSearchInput("");
    customerFilter.reset();
    monthFilter.reset();
    statusFilter.reset();
  };

  const activeInvoice = useMemo(
    () => [...totalInvoicesList, ...searchInvoicesList].find((invoice) => invoice._id === activeInvoiceId) || null,
    [totalInvoicesList, searchInvoicesList, activeInvoiceId],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-50 text-slate-500 font-medium">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading receivables...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-[400px] bg-slate-50 text-rose-600 font-medium">{error}</div>;
  }

  const kpiCards = [
    { label: "Total Receivable", value: metrics.totalReceivable, sub: `${filteredInvoices.length} total records`, color: "text-slate-900", border: "border-l-indigo-500" },
    {
      label: "Total Collection",
      value: metrics.totalCollection,
      sub: `${percentOf(metrics.totalCollection + metrics.totalTds, metrics.totalReceivable)}% settled (incl. TDS)`,
      color: "text-emerald-600",
      border: "border-l-emerald-500",
    },
    { label: "Total TDS Deduction", value: metrics.totalTds, sub: "Withheld by customers", color: "text-amber-600", border: "border-l-amber-500" },
    { label: "Total Outstanding", value: metrics.totalOutstanding, sub: "Balance remaining", color: "text-rose-600", border: "border-l-rose-500" },
    { label: "Fully Collected", value: metrics.collectedCount, sub: "Invoices settled", color: "text-emerald-600", border: "border-l-emerald-400", rawValue: true },
    { label: "Partially Collected", value: metrics.partialCount, sub: "Partially settled", color: "text-amber-600", border: "border-l-amber-400", rawValue: true },
    { label: "Uncollected", value: metrics.uncollectedCount, sub: "Awaiting collection", color: "text-rose-600", border: "border-l-rose-400", rawValue: true },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 px-4 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Receivables</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage customer invoices, collections, and financial tracking</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {kpiCards.map((card) => (
          <div key={card.label} className={`p-4 rounded-xl bg-white border border-slate-200 border-l-4 ${card.border} shadow-sm flex flex-col justify-between`}>
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">{card.label}</span>
            <div className={`my-2 text-2xl font-bold tracking-tight ${card.color}`}>
              {card.rawValue ? card.value : formatCurrency(card.value)}
            </div>
            <span className="text-xs text-slate-500">{card.sub}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search invoice number, GRN, customer..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
          {searchInput && (
            <button type="button" onClick={() => setSearchInput("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold">
              ✕
            </button>
          )}
        </div>

        <ExcelFilterDropdown title="Customer" options={customerOptions} selectedValues={customerFilter.selectedValues} onChange={customerFilter.setSelectedValues} />
        <ExcelFilterDropdown title="Month" options={monthOptions} selectedValues={monthFilter.selectedValues} onChange={monthFilter.setSelectedValues} />
        <ExcelFilterDropdown title="Status" options={STATUS_OPTIONS} selectedValues={statusFilter.selectedValues} onChange={statusFilter.setSelectedValues} />

        <button type="button" onClick={resetAllFilters} className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
          Reset Filters
        </button>
      </div>

      {/* Ledger Table */}
      <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-medium text-sm">No invoice statements match the selected filters.</div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="px-4 py-3 font-mono">Invoice ID</th>
                  <th className="px-4 py-3">Customer Name</th>
                  <th className="px-4 py-3">Invoice Date</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-right">Collected</th>
                  <th className="px-4 py-3 text-right">TDS</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Due Timeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(metrics.groups).flatMap(([customerName, groupInvoices]) => {
                  const groupTotal = sumOf(groupInvoices, "totalAmount");
                  const groupCollected = sumOf(groupInvoices, "collectedAmount");
                  const groupTds = sumOf(groupInvoices, "tdsAmount");
                  const groupOutstanding = sumOf(groupInvoices, "outstanding");

                  const invoiceRows = groupInvoices.map((invoice) => (
                    <tr
                      key={invoice._id || `inv-${customerName}-${invoice.invoiceNumber}-${invoice.grnNumber}`}
                      onClick={() => setActiveInvoiceId(invoice._id)}
                      className="cursor-pointer hover:bg-indigo-50/30 transition-colors group"
                    >
                      <td className="px-4 py-2.5 font-mono text-slate-600 font-medium group-hover:text-indigo-600">{invoice.invoiceNumber}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-800">{customerName}</td>
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatDateString(invoice.invoiceDate)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-900">{formatCurrency(invoice.totalAmount)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{formatCurrency(invoice.collectedAmount)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-amber-600">{formatCurrency(invoice.tdsAmount)}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${invoice.outstanding > 0 ? "text-rose-600" : "text-slate-400"}`}>
                        {formatCurrency(invoice.outstanding)}
                      </td>
                      <td className="px-4 py-2.5 text-center whitespace-nowrap">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="px-4 py-2.5 text-center whitespace-nowrap">
                        <DueDaysBadge status={invoice.status} dueDays={invoice.dueDays} />
                      </td>
                    </tr>
                  ));

                  const subtotalRow = (
                    <tr key={`${customerName}-subtotal`} className="bg-slate-50/80 font-semibold border-b border-slate-200 text-xs">
                      <td colSpan={3} className="px-4 py-2 text-slate-500 italic">
                        Subtotal for {customerName} ({groupInvoices.length} invoices)
                      </td>
                      <td className="px-4 py-2 text-right text-slate-900 font-bold">{formatCurrency(groupTotal)}</td>
                      <td className="px-4 py-2 text-right text-emerald-600 font-bold">{formatCurrency(groupCollected)}</td>
                      <td className="px-4 py-2 text-right text-amber-600 font-bold">{formatCurrency(groupTds)}</td>
                      <td className="px-4 py-2 text-right text-rose-600 font-bold">{formatCurrency(groupOutstanding)}</td>
                      <td colSpan={2} className="px-4 py-2 text-right text-indigo-600 font-bold pr-6">
                        {percentOf(groupCollected + groupTds, groupTotal)}% collected
                      </td>
                    </tr>
                  );

                  return [...invoiceRows, subtotalRow];
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {activeInvoice && (
        <ReceivablesInvoiceDialog invoice={activeInvoice} onClose={() => setActiveInvoiceId(null)} onRecordChanged={refreshAfterChange} />
      )}

      <AddReceivableDialog isOpen={isCreateOpen} onClose={closeCreateReceivable} onSuccess={refreshAfterChange} />
    </div>
  );
}