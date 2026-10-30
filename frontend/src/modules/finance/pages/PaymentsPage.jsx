import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { paymentApi } from "../api.js";
import PaymentCard from "../components/paymentComponets/PaymentCard.jsx";
import { formatCurrency, formatDateDMY } from "../utils/financeFormat.js";
import { isFinanceSuperUser } from "../constants/financeRoles.js";

const TABS = ["Pending", "Approved", "Rejected"];
const sumOf = (rows, key) => rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);

export default function PaymentsPage() {
  const canUpdateStatus = isFinanceSuperUser();
  const [activeTab, setActiveTab] = useState("Pending");
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [actingId, setActingId] = useState(null);
  const requestRef = useRef(0);

  const loadPayments = useCallback(async () => {
    const requestId = ++requestRef.current;
    try {
      setLoading(true);
      setError("");
      const response = await paymentApi.getPayments([]);
      const availablePeriods = response.data?.availablePeriods || [];
      const selectedPeriods = response.data?.selectedPeriods || [];
      // The API defaults to the latest three periods; Collection shows the full register,
      // so request every available period for this review page.
      const completeResponse = availablePeriods.length > selectedPeriods.length
        ? await paymentApi.getPayments(availablePeriods)
        : response;
      if (requestId === requestRef.current) setPayments(completeResponse.data?.data || []);
    } catch (err) {
      if (requestId === requestRef.current) setError(err.response?.data?.message || "Failed to load payments.");
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { loadPayments(); return () => { requestRef.current += 1; }; }, [loadPayments]);

  const visiblePayments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payments.filter((payment) => {
      const matchesStatus = payment.status === activeTab;
      const matchesSearch = !term || [payment.invoiceNumber, payment.grnNumber, payment.supplierName, payment.transactionNumber, payment.creditNoteNumber]
        .some((value) => String(value || "").toLowerCase().includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [payments, activeTab, search]);

  const handleDecision = async (payment, status) => {
    const action = status === "Approved" ? "approve" : "reject";
    if (!window.confirm(`Do you want to ${action} the payment of ${formatCurrency(payment.paidAmount)} for invoice ${payment.invoiceNumber || "—"}?`)) return;
    try {
      setActingId(payment._id);
      await paymentApi.updatePaymentStatus(payment._id, { status });
      await loadPayments();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} payment.`);
    } finally {
      setActingId(null);
    }
  };

  const kpis = [
    { label: `${activeTab} Payments`, value: visiblePayments.length, count: true },
    { label: "Payment Amount", value: sumOf(visiblePayments, "paidAmount") },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 px-4 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Review supplier payments and their approval status</p>
        </div>
        <button type="button" onClick={loadPayments} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="flex gap-2">
        {TABS.map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition ${activeTab === tab ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>{tab}</button>)}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {kpis.map((card) => <div key={card.label} className="p-4 rounded-xl bg-white border border-slate-200 border-l-4 border-l-indigo-500 shadow-sm">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">{card.label}</span>
          <div className="mt-2 text-2xl font-bold tracking-tight">{card.count ? card.value : formatCurrency(card.value)}</div>
        </div>)}
      </div>

      <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice, GRN, supplier, transaction or credit note..." className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500" />
      </div>

      <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
        {error ? <div className="text-center py-10 text-rose-600 text-sm">{error}</div> : loading ? <div className="text-center py-10 text-slate-400 text-sm">Loading payments...</div> : visiblePayments.length === 0 ? <div className="text-center py-10 text-slate-400 text-sm">No {activeTab.toLowerCase()} payments found.</div> : (
          <div className="divide-y divide-slate-100">
            {visiblePayments.map((payment) => <div key={payment._id} className="p-3 sm:p-4 flex flex-col xl:flex-row xl:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2 text-xs">
                  <div><span className="block text-slate-400">Invoice</span><strong className="font-mono">{payment.invoiceNumber || "—"}</strong></div>
                  <div><span className="block text-slate-400">GRN</span><strong className="font-mono">{payment.grnNumber || "—"}</strong></div>
                  <div><span className="block text-slate-400">Supplier</span><strong>{payment.supplierName || "—"}</strong></div>
                  <div><span className="block text-slate-400">Payment Date</span><strong>{formatDateDMY(payment.paymentDate)}</strong></div>
                  <div><span className="block text-slate-400">Amount</span><strong className="text-emerald-600">{formatCurrency(payment.paidAmount)}</strong></div>
                </div>
                <PaymentCard payment={payment} onRefresh={loadPayments} canManage={false} />
              </div>
              {activeTab === "Pending" && canUpdateStatus && <div className="flex gap-2 xl:flex-col xl:w-28">
                <button type="button" disabled={actingId === payment._id} onClick={() => handleDecision(payment, "Approved")} className="flex-1 px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50">Approve</button>
                <button type="button" disabled={actingId === payment._id} onClick={() => handleDecision(payment, "Rejected")} className="flex-1 px-3 py-2 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold disabled:opacity-50">Reject</button>
              </div>}
            </div>)}
          </div>
        )}
      </div>
    </div>
  );
}
