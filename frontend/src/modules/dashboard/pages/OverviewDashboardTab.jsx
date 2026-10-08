import { Activity, Factory, FileText, PackageCheck, ShoppingCart, Truck, Wallet, Warehouse } from "lucide-react";
import { KpiGrid, DashboardPanel, BarList, DonutLegend } from "../components/DashboardShell";

const money = (v) => `₹${Math.round(Number(v || 0)).toLocaleString("en-IN")}`;
export default function OverviewDashboardTab({ data }) {
  const s = data?.summary || {};
  const cards = [
    { label: "RFQs", value: s.rfq, icon: FileText }, { label: "Active projects", value: s.projects, icon: PackageCheck, tone: "green" },
    { label: "Production qty", value: s.production_qty, icon: Factory, tone: "blue" }, { label: "PO value", value: money(s.purchase_cost), icon: ShoppingCart, tone: "amber" },
    { label: "Received qty", value: s.received_qty, icon: Warehouse }, { label: "Dispatched qty", value: s.dispatched_qty, icon: Truck, tone: "green" },
    { label: "Payable", value: money(s.payable_amount), icon: Wallet, tone: "amber" }, { label: "Pending QC", value: s.pending_qc, icon: Activity, tone: "red" },
  ];
  return <div className="space-y-2"><KpiGrid items={cards} /><div className="grid xl:grid-cols-2 gap-2"><DashboardPanel title="RFQ pipeline" subtitle="Current workflow distribution"><BarList items={Object.entries(data?.rfq?.summary?.by_stage || {}).map(([label, value]) => ({ label, value }))} /></DashboardPanel><DashboardPanel title="Production output" subtitle="Monthly finished quantity"><BarList items={(data?.production?.trend || []).map((x) => ({ label: x.label, value: x.value }))} format={(v) => Number(v).toLocaleString("en-IN")} /></DashboardPanel><DashboardPanel title="Purchase mix" subtitle="PO count by purchase type"><DonutLegend items={(data?.purchase?.by_type || []).map((x) => ({ label: x._id, value: x.count }))} /></DashboardPanel><DashboardPanel title="Finance snapshot" subtitle="Payment status and exposure"><DonutLegend items={(data?.finance?.payment_status || []).map((x) => ({ label: x._id, value: Math.round(Number(x.amount || 0)) }))} /></DashboardPanel></div></div>;
}
