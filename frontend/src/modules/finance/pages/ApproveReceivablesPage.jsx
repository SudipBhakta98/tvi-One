// src/pages/ApproveReceivablesPage.jsx
// Collections added on a receivable invoice wait here until an Admin / Super User approves or rejects them.

import React, { useState, useEffect, useMemo, useRef } from "react";
import { RefreshCw } from "lucide-react";

import { collectionApi } from "../api.js";
import { useToast } from "../../../core/notifications/ToastContext";
import ExcelFilterDropdown from "../components/common/ExcelFilterDropdown.jsx";
import { CollectionStatusBadge } from "../components/receivableComponents/ReceivableBadges.jsx";
import { formatCurrency, formatDisplayDate } from "../utils/financeFormat.js";

const TABS = ["Pending", "Approved", "Rejected"];

const sumOf = (rows, pick) => rows.reduce((sum, row) => sum + (Number(pick(row)) || 0), 0);

export default function ApproveReceivablesPage() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState("Pending");
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actingId, setActingId] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCustomers, setSelectedCustomers] = useState(null); // null = all

  // A slow response for a tab the user already left must not overwrite the current tab.
  const requestIdRef = useRef(0);

  const loadCollections = async (status = activeTab) => {
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const response = await collectionApi.getCollections(status);
      if (requestId === requestIdRef.current) setCollections(response.data?.data || []);
    } catch (err) {
      if (requestId === requestIdRef.current) setError(err.response?.data?.message || "Failed to load collections.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedCustomers(null);
    loadCollections(activeTab);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const customerOptions = useMemo(
    () => [...new Set(collections.map((c) => c.customerName).filter(Boolean))].sort().map((name) => ({ value: name, label: name })),
    [collections],
  );

  const visibleCollections = useMemo(() => {
    const term = searchInput.trim().toLowerCase();
    return collections.filter(
      (c) =>
        (selectedCustomers === null || selectedCustomers.includes(c.customerName)) &&
        (!term || [c.invoiceNumber, c.grnNumber, c.customerName].some((field) => String(field).toLowerCase().includes(term))),
    );
  }, [collections, searchInput, selectedCustomers]);

  const handleDecision = async (collection, status) => {
    const verb = status === "Approved" ? "approve" : "reject";
    if (!window.confirm(`Do you want to ${verb} this collection of ${formatCurrency(collection.receivedAmount)} for invoice ${collection.invoiceNumber}?`)) return;

    try {
      setActingId(collection._id);
      const response = await collectionApi.updateCollectionStatus(collection._id, status);
      toast.success(response.data?.message || `Collection ${status.toLowerCase()}.`);
      await loadCollections();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${verb} the collection.`);
    } finally {
      setActingId(null);
    }
  };

  const showDecisionColumn = activeTab === "Pending";
  const kpiCards = [
    { label: `${activeTab} Collections`, value: visibleCollections.length, raw: true, color: "text-slate-900", border: "border-l-indigo-500" },
    { label: "Received Amount", value: sumOf(visibleCollections, (c) => c.receivedAmount), color: "text-emerald-600", border: "border-l-emerald-500" },
    { label: "TDS Amount", value: sumOf(visibleCollections, (c) => c.tdsAmount), color: "text-amber-600", border: "border-l-amber-500" },
    { label: "Total Settled", value: sumOf(visibleCollections, (c) => Number(c.receivedAmount) + Number(c.tdsAmount)), color: "text-indigo-600", border: "border-l-indigo-400" },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 px-4 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Approve Receivables</h1>
          <p className="text-sm text-slate-500 mt-0.5">Review customer collections and approve or reject them</p>
        </div>
        <button
          type="button"
          onClick={() => loadCollections()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition ${
              activeTab === tab ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <div key={card.label} className={`p-4 rounded-xl bg-white border border-slate-200 border-l-4 ${card.border} shadow-sm`}>
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">{card.label}</span>
            <div className={`mt-2 text-2xl font-bold tracking-tight ${card.color}`}>{card.raw ? card.value : formatCurrency(card.value)}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search invoice number, GRN, customer..."
          className="flex-1 min-w-[240px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
        />
        <ExcelFilterDropdown
          title="Customer"
          options={customerOptions}
          selectedValues={selectedCustomers ?? customerOptions.map((o) => o.value)}
          onChange={setSelectedCustomers}
        />
        <button
          type="button"
          onClick={() => {
            setSearchInput("");
            setSelectedCustomers(null);
          }}
          className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          Reset Filters
        </button>
      </div>

      <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          {error ? (
            <div className="text-center py-12 text-rose-600 font-medium text-sm">{error}</div>
          ) : loading ? (
            <div className="text-center py-12 text-slate-400 font-medium text-sm">Loading collections...</div>
          ) : visibleCollections.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-medium text-sm">No {activeTab.toLowerCase()} collections found.</div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="px-4 py-3 font-mono">Invoice ID</th>
                  <th className="px-4 py-3">GRN</th>
                  <th className="px-4 py-3">Customer Name</th>
                  <th className="px-4 py-3">Collection Date</th>
                  <th className="px-4 py-3 text-right">Received</th>
                  <th className="px-4 py-3 text-right">TDS</th>
                  <th className="px-4 py-3 text-right">Total Settled</th>
                  <th className="px-4 py-3">Added By</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">{showDecisionColumn ? "Action" : "Actioned By"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleCollections.map((collection) => (
                  <tr key={collection._id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-slate-600 font-medium">{collection.invoiceNumber}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-600">{collection.grnNumber}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{collection.customerName}</td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatDisplayDate(collection.collectionDate)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{formatCurrency(collection.receivedAmount)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-amber-600">{formatCurrency(collection.tdsAmount)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                      {formatCurrency(Number(collection.receivedAmount) + Number(collection.tdsAmount))}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{collection.collectionBy?.name || "—"}</td>
                    <td className="px-4 py-2.5 text-center">
                      <CollectionStatusBadge status={collection.status} />
                    </td>
                    <td className="px-4 py-2.5 text-center whitespace-nowrap">
                      {showDecisionColumn ? (
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            disabled={actingId === collection._id}
                            onClick={() => handleDecision(collection, "Approved")}
                            className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={actingId === collection._id}
                            onClick={() => handleDecision(collection, "Rejected")}
                            className="px-3 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-[11px] disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-600">{collection.approvedBy?.name || "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
