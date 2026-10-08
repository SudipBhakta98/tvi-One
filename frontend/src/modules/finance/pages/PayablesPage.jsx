// src/pages/PayablesPage.jsx
// Payable Register: KPI cards, filters and the invoice ledger. Clicking a row opens PayablesInvoiceDialog.

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { payablesApi } from "../api.js";
import { usePayables } from "../contexts/PayableContext.jsx";
import ExcelFilterDropdown from "../components/common/ExcelFilterDropdown.jsx";
import useMultiFilter from "../hooks/useMultiFilter.js";
import PayablesInvoiceDialog from "../components/payableComponents/PayablesInvoiceDialog.jsx";
import AddPayableDialog from "../components/payableComponents/AddPayableDialog.jsx";
import { formatCurrency, formatDateString, parseDateString } from "../utils/financeFormat.js";

// ============================================================
// UI BADGES
// ============================================================

function StatusBadge({ status }) {
  const normalizedStatus = String(status || "").toLowerCase();

  const badgeStyles = {
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    partial: "bg-amber-50 text-amber-700 border-amber-200",
    unpaid: "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
        badgeStyles[normalizedStatus] || "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          normalizedStatus === "paid"
            ? "bg-emerald-500"
            : normalizedStatus === "partial"
            ? "bg-amber-500"
            : "bg-rose-500"
        }`}
      />
      <span className="capitalize">{status || "Unknown"}</span>
    </span>
  );
}

function DueDaysBadge({ status, dueDays }) {
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus === "paid" || dueDays === undefined || dueDays === null) {
    return <span className="text-slate-400">—</span>;
  }

  const numericDueDays = Number(dueDays);

  const badgeStyles =
    numericDueDays >= 15
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : numericDueDays >= 0
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-rose-700 bg-rose-50 border-rose-200 font-bold";

  return (
    <span className={`inline-block px-2 py-0.5 rounded border text-xs whitespace-nowrap ${badgeStyles}`}>
      {numericDueDays >= 0
        ? `${numericDueDays} days left`
        : `${Math.abs(numericDueDays)} days overdue`}
    </span>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

const STATUS_OPTIONS = [
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "unpaid", label: "Unpaid" },
];

// API row (camelCase) -> row used by this page and its dialogs (adds the snake_case names the dialogs read).
const normalizeInvoice = (item) => ({
  ...item,
  _id: item._id || item.id || null,
  invoice_number: item.invoiceNumber ?? "",
  grn_number: item.grnNumber ?? "",
  supplier_name: (item.supplierName ?? "").trim(),
  invoice_date: item.invoiceDate ?? null,
  sub_total: Number(item.subTotal ?? 0),
  gst_rate: Number(item.gstRate ?? 0),
  gst_amount: Number(item.gstAmount ?? 0),
  tds_rate: Number(item.tdsRate ?? 0),
  tds_amount: Number(item.tdsAmount ?? 0),
  total_amount: Number(item.totalAmount ?? 0),
  gross_payable_amount: Number(item.grossPayableAmount ?? 0),
  debit_amount: Number(item.debitAmount ?? 0),
  actual_payable_amount: Number(item.actualPayableAmount ?? 0),
  paid_amount: Number(item.paidAmount ?? 0),
  outstanding: Number(item.outstanding || 0),
  status: item.status || "unpaid",
  due_days: item.dueDays ?? null,
  is_overdue: item.isOverdue ?? false,
});

export default function PayablesPage() {
  const { analyticsData, storeAnalytics } = usePayables();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const [activeInvoice, setActiveInvoice] = useState(null);

  // ?create=1 in the URL opens the Create Payable page; closing it removes the flag.
  const isDialogOpen = searchParams.get("create") === "1";
  const closeCreatePayable = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("create");
    setSearchParams(nextParams, { replace: true });
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await payablesApi.getAnalytics([]);
      if (!response.data?.success) {
        throw new Error(response.data?.message || "Failed to load payable analytics.");
      }
      storeAnalytics(response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load payables analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const allInvoices = useMemo(() => (analyticsData?.data || []).map(normalizeInvoice), [analyticsData?.data]);

  // The search box narrows the loaded invoices by invoice number, GRN or supplier.
  const baseInvoicesList = useMemo(() => {
    const searchTerm = searchInput.trim().toLowerCase();
    if (!searchTerm) return allInvoices;
    return allInvoices.filter((invoice) =>
      [invoice.invoice_number, invoice.grn_number, invoice.supplier_name].some((field) =>
        String(field).toLowerCase().includes(searchTerm),
      ),
    );
  }, [allInvoices, searchInput]);

  // Filter options come from the rows currently shown
  const supplierOptions = useMemo(
    () => [...new Set(baseInvoicesList.map((i) => i.supplier_name).filter(Boolean))].sort().map((name) => ({ value: name, label: name })),
    [baseInvoicesList],
  );

  const monthOptions = useMemo(() => {
    const monthMap = new Map();
    baseInvoicesList.forEach((invoice) => {
      const parsed = parseDateString(invoice.invoice_date);
      if (parsed) monthMap.set(parsed.key, parsed.label);
    });
    return [...monthMap.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => b.value.localeCompare(a.value));
  }, [baseInvoicesList]);

  const supplierFilter = useMultiFilter(supplierOptions);
  const monthFilter = useMultiFilter(monthOptions);
  const statusFilter = useMultiFilter(STATUS_OPTIONS);

  const filteredInvoices = useMemo(
    () =>
      baseInvoicesList.filter((invoice) => {
        const month = parseDateString(invoice.invoice_date);
        return (
          supplierFilter.matches(invoice.supplier_name) &&
          statusFilter.matches(String(invoice.status).toLowerCase()) &&
          monthFilter.matches(month?.key)
        );
      }),
    [baseInvoicesList, supplierFilter.selectedValues, statusFilter.selectedValues, monthFilter.selectedValues], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // KPI totals plus the invoices grouped by supplier for the ledger table
  const computedMetrics = useMemo(() => {
    const metrics = { totalPayable: 0, totalPaid: 0, paidCount: 0, unpaidCount: 0, partialCount: 0, groups: {} };

    filteredInvoices.forEach((invoice) => {
      metrics.totalPayable += Number(invoice.actual_payable_amount) || 0;
      metrics.totalPaid += Number(invoice.paid_amount) || 0;

      const status = String(invoice.status || "").toLowerCase();
      if (status === "paid") metrics.paidCount++;
      else if (status === "unpaid") metrics.unpaidCount++;
      else if (status === "partial") metrics.partialCount++;

      const groupKey = invoice.supplier_name || "Uncategorized";
      (metrics.groups[groupKey] ||= []).push(invoice);
    });

    return metrics;
  }, [filteredInvoices]);

  const resetAllFilters = () => {
    setSearchInput("");
    supplierFilter.reset();
    monthFilter.reset();
    statusFilter.reset();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-50 text-slate-500 font-medium">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading payables...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-50 text-rose-600 font-medium">
        {error}
      </div>
    );
  }

  const kpiCardsConfig = [
    {
      label: "Total Payable",
      value: computedMetrics.totalPayable,
      sub: `${filteredInvoices.length} total records`,
      color: "text-slate-900",
      border: "border-l-indigo-500",
    },
    {
      label: "Total Paid",
      value: computedMetrics.totalPaid,
      sub: `${
        computedMetrics.totalPayable > 0
          ? ((computedMetrics.totalPaid / computedMetrics.totalPayable) * 100).toFixed(1)
          : 0
      }% completion`,
      color: "text-emerald-600",
      border: "border-l-emerald-500",
    },
    {
      label: "Outstanding",
      value: computedMetrics.totalPayable - computedMetrics.totalPaid,
      sub: "Balance remaining",
      color: "text-rose-600",
      border: "border-l-rose-500",
    },
    {
      label: "Fully Paid",
      value: computedMetrics.paidCount,
      sub: "Invoices settled",
      color: "text-emerald-600",
      border: "border-l-emerald-400",
      rawValue: true,
    },
    {
      label: "Unpaid",
      value: computedMetrics.unpaidCount,
      sub: "Awaiting payment",
      color: "text-rose-600",
      border: "border-l-rose-400",
      rawValue: true,
    },
    {
      label: "Partial",
      value: computedMetrics.partialCount,
      sub: "Partially settled",
      color: "text-amber-600",
      border: "border-l-amber-400",
      rawValue: true,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 px-4 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payables</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage vendor invoices, payments, and financial tracking
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCardsConfig.map((card, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-xl bg-white border border-slate-200 border-l-4 ${card.border} shadow-sm flex flex-col justify-between`}
          >
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              {card.label}
            </span>
            <div className={`my-2 text-2xl font-bold tracking-tight ${card.color}`}>
              {card.rawValue ? card.value : formatCurrency(card.value)}
            </div>
            <span className="text-xs text-slate-500">{card.sub}</span>
          </div>
        ))}
      </div>

      {/* Excel-Style Filters Control Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search invoice number, GRN, supplier..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Excel Checkbox Filters */}
        <ExcelFilterDropdown
          title="Supplier"
          options={supplierOptions}
          selectedValues={supplierFilter.selectedValues}
          onChange={supplierFilter.setSelectedValues}
        />

        <ExcelFilterDropdown
          title="Month"
          options={monthOptions}
          selectedValues={monthFilter.selectedValues}
          onChange={monthFilter.setSelectedValues}
        />

        <ExcelFilterDropdown
          title="Status"
          options={STATUS_OPTIONS}
          selectedValues={statusFilter.selectedValues}
          onChange={statusFilter.setSelectedValues}
        />

        <button
          type="button"
          onClick={resetAllFilters}
          className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          Reset Filters
        </button>
      </div>

      {/* Ledger Table */}
      <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-medium text-sm">
              No invoice statements match the selected filters.
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="px-4 py-3 font-mono">Invoice ID</th>
                  <th className="px-4 py-3">Supplier Name</th>
                  <th className="px-4 py-3">Invoice Date</th>
                  <th className="px-4 py-3 text-right">Net Amount</th>
                  <th className="px-4 py-3 text-right">Paid Amount</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Due Timeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(computedMetrics.groups).flatMap(
                  ([supplierName, groupInvoices]) => {
                    const groupPayable = groupInvoices.reduce(
                      (sum, i) => sum + (i.actual_payable_amount || 0),
                      0
                    );
                    const groupPaid = groupInvoices.reduce(
                      (sum, i) => sum + (i.paid_amount || 0),
                      0
                    );

                    const invoiceRows = groupInvoices.map((invoice, idx) => {
                      const rowKey =
                        invoice._id ||
                        invoice.id ||
                        `inv-${supplierName}-${invoice.invoice_number}-${idx}`;

                      return (
                        <tr
                          key={rowKey}
                          onClick={() => setActiveInvoice(invoice)}
                          className="cursor-pointer hover:bg-indigo-50/30 transition-colors group"
                        >
                          <td className="px-4 py-2.5 font-mono text-slate-600 font-medium group-hover:text-indigo-600">
                            {invoice.invoice_number}
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-slate-800">
                            {supplierName}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                            {formatDateString(invoice.invoice_date)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                            {formatCurrency(invoice.actual_payable_amount)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">
                            {formatCurrency(invoice.paid_amount)}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-semibold ${
                              invoice.outstanding > 0 ? "text-rose-600" : "text-slate-400"
                            }`}
                          >
                            {formatCurrency(invoice.outstanding)}
                          </td>
                          <td className="px-4 py-2.5 text-center whitespace-nowrap">
                            <StatusBadge status={invoice.status} />
                          </td>
                          <td className="px-4 py-2.5 text-center whitespace-nowrap">
                            <DueDaysBadge
                              status={invoice.status}
                              dueDays={invoice.due_days}
                            />
                          </td>
                        </tr>
                      );
                    });

                    const subtotalRow = (
                      <tr
                        key={`${supplierName}-subtotal`}
                        className="bg-slate-50/80 font-semibold border-b border-slate-200 text-xs"
                      >
                        <td colSpan={3} className="px-4 py-2 text-slate-500 italic">
                          Subtotal for {supplierName} ({groupInvoices.length} invoices)
                        </td>
                        <td className="px-4 py-2 text-right text-slate-900 font-bold">
                          {formatCurrency(groupPayable)}
                        </td>
                        <td className="px-4 py-2 text-right text-emerald-600 font-bold">
                          {formatCurrency(groupPaid)}
                        </td>
                        <td className="px-4 py-2 text-right text-rose-600 font-bold">
                          {formatCurrency(groupPayable - groupPaid)}
                        </td>
                        <td colSpan={2} className="px-4 py-2 text-right text-indigo-600 font-bold pr-6">
                          {groupPayable > 0
                            ? ((groupPaid / groupPayable) * 100).toFixed(1)
                            : 0}
                          % paid
                        </td>
                      </tr>
                    );

                    return [...invoiceRows, subtotalRow];
                  }
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {activeInvoice && (
        <PayablesInvoiceDialog
          invoice={activeInvoice}
          onClose={() => setActiveInvoice(null)}
        />
      )}

      <AddPayableDialog
        isOpen={isDialogOpen}
        onClose={closeCreatePayable}
        onSuccess={loadAnalytics}
      />
    </div>
  );
}