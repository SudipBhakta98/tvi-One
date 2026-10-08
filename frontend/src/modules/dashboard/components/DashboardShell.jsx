import { RefreshCw } from "lucide-react";
import { KpiCard, Panel } from "../../../components/ui";
import { TrendChart, BarList, DonutLegend } from "./charts";

export function KpiGrid({ items = [] }) { return <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{items.map((x) => <KpiCard key={x.label} {...x} />)}</div>; }
export function DashboardPanel({ title, subtitle, children }) { return <Panel title={title} subtitle={subtitle}>{children}</Panel>; }
export function ModuleDashboard({ title, subtitle, icon: Icon, summary = [], trend = [], trendFormat, children, onRefresh, loading }) {
  return <div className="space-y-2"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center"><Icon size={16} className="text-indigo-600" /></div><div><div className="text-sm font-bold text-slate-900">{title}</div><div className="text-[11px] text-slate-500">{subtitle}</div></div></div>{onRefresh && <button type="button" onClick={onRefresh} disabled={loading} className="p-2 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-900"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>}</div><KpiGrid items={summary} /><div className="grid xl:grid-cols-3 gap-2">{trend.length > 0 && <DashboardPanel title="Activity trend" subtitle="Aggregated monthly activity"><TrendChart items={trend} format={trendFormat} /></DashboardPanel>}{children}</div></div>;
}
export { BarList, DonutLegend };
