import { useMemo } from "react";

export function BarList({ items = [], valueKey = "value", labelKey = "label", format = (v) => v }) {
  const normalized = useMemo(() => items.filter(Boolean).map((x) => ({ label: x[labelKey] ?? "Unknown", value: Number(x[valueKey] || 0) })), [items, valueKey, labelKey]);
  const max = Math.max(1, ...normalized.map((x) => x.value));
  return <div className="space-y-2">{normalized.slice(0, 10).map((item) => <div key={item.label} className="space-y-1"><div className="flex justify-between gap-2 text-[11px]"><span className="text-slate-700 truncate">{String(item.label).replaceAll("_", " ")}</span><span className="text-slate-500">{format(item.value)}</span></div><div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} /></div></div>)}</div>;
}

export function TrendChart({ items = [], format = (v) => v }) {
  const values = items.map((x) => Number(x.value || 0));
  const max = Math.max(1, ...values);
  if (!items.length) return <div className="h-32 flex items-center justify-center text-xs text-slate-500">No trend data for this period.</div>;
  return <div className="h-36 flex items-end gap-1.5 px-1 pt-4">{items.slice(-12).map((item, index) => <div key={`${item.label}-${index}`} className="flex-1 h-full flex flex-col justify-end gap-1 min-w-0"><div title={`${item.label}: ${format(item.value)}`} className="rounded-t bg-indigo-600 hover:bg-indigo-700 transition-colors" style={{ height: `${Math.max(4, (Number(item.value || 0) / max) * 100)}%` }} /><span className="text-[9px] text-slate-500 text-center truncate">{item.label}</span></div>)}</div>;
}

export function DonutLegend({ items = [] }) {
  const total = items.reduce((s, x) => s + Number(x.value || 0), 0);
  return <div className="grid grid-cols-2 gap-2">{items.slice(0, 8).map((item, i) => <div key={`${item.label}-${i}`} className="rounded-lg border border-slate-200 bg-white p-2"><div className="flex items-center justify-between gap-2"><span className="text-[11px] text-slate-400 truncate">{String(item.label).replaceAll("_", " ")}</span><b className="text-xs text-slate-900">{item.value}</b></div><div className="mt-1 h-1 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${total ? (Number(item.value || 0) / total) * 100 : 0}%` }} /></div></div>)}</div>;
}
