import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { PageHeader, Panel, Select, Input, KpiCard, Table, EmptyState, GhostButton } from "../../../components/ui";

const DEPARTMENTS = ["all", "projects", "rfq", "purchase", "production", "warehouse", "dispatch", "finance"];
const money = (v) => `₹${Math.round(Number(v || 0)).toLocaleString("en-IN")}`;
const flatten = (value, prefix = "", out = {}) => { if (value === null || value === undefined) return out; if (Array.isArray(value)) return out; if (typeof value === "object") { Object.entries(value).forEach(([k,v]) => flatten(v, prefix ? `${prefix}.${k}` : k, out)); } else out[prefix] = value; return out; };
const csv = (rows) => { const flat=rows.map(r=>flatten(r)); const keys=[...new Set(flat.flatMap(Object.keys))]; const esc=v=>`"${String(v??"").replaceAll('"','""')}"`; return [keys.map(esc).join(","),...flat.map(r=>keys.map(k=>esc(r[k])).join(","))].join("\n"); };

export default function ReportsPage() {
  const [department, setDepartment] = useState("all");
  const [range, setRange] = useState({ from_date: "", to_date: "" });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => { setLoading(true); try { const r=await api.get(ENDPOINTS.DASHBOARD.REPORTS,{params:{department,...Object.fromEntries(Object.entries(range).filter(([,v])=>v))}}); setReport(r.data); } finally { setLoading(false); } }, [department, range]);
  useEffect(()=>{load();},[load]);
  const sections=useMemo(()=>Object.entries(report?.reports||{}),[report]);
  const downloadSection=(name,payload)=>{ let rows=[]; if(Array.isArray(payload?.rows)) rows=payload.rows; else if(payload?.rows && typeof payload.rows === "object") rows=Object.entries(payload.rows).flatMap(([type,items])=>Array.isArray(items)?items.map(item=>({record_type:type,...item})):[]); if(!rows.length)return; const blob=new Blob([csv(rows)],{type:"text/csv;charset=utf-8"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`tvi-one-${name}-report.csv`; a.click(); URL.revokeObjectURL(url); };
  return <div className="space-y-3"><PageHeader eyebrow="Reporting" title="Department Reports" subtitle="Query operational data by department and date range, then export the selected dataset to CSV." />
    <Panel title="Report filters"><div className="flex flex-wrap items-end gap-2"><label className="text-[10px] font-bold uppercase text-slate-500">Department<Select value={department} onChange={e=>setDepartment(e.target.value)}>{DEPARTMENTS.map(d=><option key={d} value={d}>{d.replaceAll("_"," ").toUpperCase()}</option>)}</Select></label><label className="text-[10px] font-bold uppercase text-slate-500">From<Input type="date" value={range.from_date} onChange={e=>setRange({...range,from_date:e.target.value})}/></label><label className="text-[10px] font-bold uppercase text-slate-500">To<Input type="date" value={range.to_date} onChange={e=>setRange({...range,to_date:e.target.value})}/></label><GhostButton onClick={()=>setRange({from_date:"",to_date:""})}>Reset dates</GhostButton></div></Panel>
    {loading?<div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">Generating report…</div>:!sections.length?<EmptyState/>:sections.map(([name,payload])=><ReportSection key={name} name={name} payload={payload} onDownload={()=>downloadSection(name,payload)}/>)}
  </div>;
}
function ReportSection({name,payload,onDownload}){const rows=Array.isArray(payload.rows)?payload.rows:[]; const grouped=payload.rows&&typeof payload.rows==="object"&&!Array.isArray(payload.rows)?payload.rows:null; const metricEntries=Object.entries(payload).filter(([k,v])=>k!=="rows"&&typeof v!=="object"); return <Panel title={name.replaceAll("_"," ").toUpperCase()} toolbar={<button type="button" onClick={onDownload} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-800"><Download size={13}/>CSV</button>}><div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">{metricEntries.slice(0,4).map(([k,v])=><KpiCard key={k} label={k.replaceAll("_"," ")} value={typeof v==="number"&&k.includes("amount")?money(v):v}/>)}</div>{grouped?Object.entries(grouped).map(([type,typeRows])=><div key={type} className="mb-3"><div className="mb-1 text-xs font-bold uppercase text-slate-500">{type}</div><SimpleTable rows={typeRows}/></div>):rows.length?<SimpleTable rows={rows}/>:<EmptyState message="No rows for this date range."/>}</Panel>}
function SimpleTable({rows=[]}){if(!rows.length)return <EmptyState message="No rows."/>; const cols=Object.keys(rows[0]).filter(k=>typeof rows[0][k]!=="object").slice(0,8); return <Table columns={cols.map(k=>k.replaceAll("_"," "))}>{rows.slice(0,20).map((r,i)=><tr key={r._id||i}>{cols.map(k=><td key={k} className="px-3 py-2 text-xs text-slate-700">{String(r[k]??"—")}</td>)}</tr>)}</Table>}
