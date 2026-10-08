import { Award, Clock, FileText, IndianRupee, Percent, Target, TrendingUp } from "lucide-react";
import { ModuleDashboard, DashboardPanel, BarList, DonutLegend } from "../components/DashboardShell";
import { KpiCard } from "../../../components/ui";

const money = (v) => `₹${Math.round(Number(v || 0)).toLocaleString("en-IN")}`;
const label = (value) => String(value || "Unknown").replaceAll("_", " ");

export default function RfqDashboardTab({ data }) {
  const s = data?.summary || {};
  const stageEntries = Object.entries(s.by_stage || {}).map(([label, value]) => ({ label: label.replaceAll("_", " "), value }));
  const statusEntries = Object.entries(s.by_status || {}).map(([label, value]) => ({ label: label.replaceAll("_", " "), value }));
  return <ModuleDashboard title="RFQ & NPD" subtitle="Pipeline, stage gates, commercial value and customer conversion" icon={FileText} summary={[
    { label: "Total RFQs", value: s.total || 0, icon: FileText },
    { label: "Quoted Value", value: money(s.quoted_value), icon: IndianRupee, tone: "green" },
    { label: "Awarded Value", value: money(s.awarded_value), icon: Award, tone: "green" },
    { label: "Avg Quote", value: money(s.avg_quote), icon: TrendingUp, tone: "blue" },
    { label: "Decision Rate", value: `${Number(s.decision_rate || 0).toFixed(1)}%`, icon: Percent, tone: "amber" },
    { label: "Overdue Targets", value: s.overdue_targets || 0, icon: Clock, tone: "red" },
  ]} trend={data?.trend || []} onRefresh={() => window.location.reload()}>
    <DashboardPanel title="Pipeline by stage" subtitle="Where RFQs are currently waiting or progressing"><BarList items={stageEntries} /></DashboardPanel>
    <DashboardPanel title="Commercial value trend" subtitle="Monthly quoted RFQ value"><BarList items={(data?.value_trend || []).map((x) => ({ label: x.label, value: x.value }))} format={money} /></DashboardPanel>
    <DashboardPanel title="Status mix" subtitle="Commercial lifecycle status"><DonutLegend items={statusEntries} /></DashboardPanel>
    <DashboardPanel title="Decision funnel" subtitle="Awarded vs lost among customer decisions">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Awarded" value={s.awarded || 0} hint={money(s.awarded_value)} tone="green" icon={Award} />
        <KpiCard label="Lost" value={s.lost || 0} hint="Customer decisions" tone="red" icon={Target} />
      </div>
      <div className="mt-3 text-xs text-slate-500">Decision rate = awarded RFQs ÷ (awarded + lost RFQs).</div>
    </DashboardPanel>
    <DashboardPanel title="Latest RFQs" subtitle="Recent 50 records in the selected dashboard range">
      <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-slate-200 text-left text-slate-500 uppercase"><th className="p-2">RFQ</th><th className="p-2">Customer</th><th className="p-2">Owner</th><th className="p-2">Stage</th><th className="p-2 text-right">Value</th></tr></thead><tbody className="divide-y divide-slate-100">{(data?.data || []).slice(0, 12).map((r) => <tr key={r._id}><td className="p-2 font-semibold text-indigo-600">{r.rfq_number}</td><td className="p-2 text-slate-700">{r.customer}</td><td className="p-2 text-slate-600">{r.project_lead}</td><td className="p-2 text-slate-500">{label(r.current_stage)}</td><td className="p-2 text-right font-semibold text-emerald-600">{r.costing?.quoted_price ? money(r.costing.quoted_price) : "—"}</td></tr>)}</tbody></table></div>
    </DashboardPanel>
  </ModuleDashboard>;
}
