import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, FileText, FolderKanban, Factory, ShoppingCart, Warehouse, Truck, Wallet } from "lucide-react";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { PageHeader, Input, GhostButton, Alert } from "../../../components/ui";
import OverviewDashboardTab from "./OverviewDashboardTab";
import RfqDashboardTab from "./RfqDashboardTab";
import ProjectDashboardTab from "./ProjectDashboardTab";
import ProductionDashboardTab from "./ProductionDashboardTab";
import PurchaseDashboardTab from "./PurchaseDashboardTab";
import WarehouseDashboardTab from "./WarehouseDashboardTab";
import DispatchDashboardTab from "./DispatchDashboardTab";
import FinanceDashboardTab from "./FinanceDashboardTab";

const TABS = [
  ["overview", "Overview", Activity], ["rfq", "RFQ & NPD", FileText], ["projects", "Projects", FolderKanban], ["production", "Production", Factory], ["purchase", "Purchase", ShoppingCart], ["warehouse", "Warehouse", Warehouse], ["dispatch", "Dispatch", Truck], ["finance", "Finance", Wallet],
];

export default function DashboardPage() {
  const [active, setActive] = useState("overview");
  const [range, setRange] = useState({ from_date: "", to_date: "" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const r = await api.get(ENDPOINTS.DASHBOARD.OVERVIEW, { params: Object.fromEntries(Object.entries(range).filter(([, v]) => v)) }); setData(r.data); }
    catch (e) { setError(e.response?.data?.message || "Unable to load the control tower dashboard"); }
    finally { setLoading(false); }
  }, [range.from_date, range.to_date]);
  useEffect(() => { load(); }, [load]);
  const activeData = useMemo(() => data?.[active], [data, active]);
  const Component = { overview: OverviewDashboardTab, rfq: RfqDashboardTab, projects: ProjectDashboardTab, production: ProductionDashboardTab, purchase: PurchaseDashboardTab, warehouse: WarehouseDashboardTab, dispatch: DispatchDashboardTab, finance: FinanceDashboardTab }[active];
  return <div className="space-y-3 bg-slate-50"><PageHeader eyebrow="Control Tower" title="TVI One Dashboard" subtitle="One aggregated snapshot across RFQ, projects, SCM, production, warehouse, dispatch and finance." />
    <div className="flex flex-wrap items-end justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2.5"><div className="flex flex-wrap gap-2">{TABS.map(([key,label,Icon])=><button key={key} type="button" onClick={()=>setActive(key)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold ${active===key?"bg-indigo-600 text-slate-900":"text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}><Icon size={14}/>{label}</button>)}</div><div className="flex items-end gap-2"><label className="text-[10px] font-bold text-slate-500 uppercase">From<Input type="date" value={range.from_date} onChange={e=>setRange({...range,from_date:e.target.value})}/></label><label className="text-[10px] font-bold text-slate-500 uppercase">To<Input type="date" value={range.to_date} onChange={e=>setRange({...range,to_date:e.target.value})}/></label>{(range.from_date||range.to_date)&&<GhostButton onClick={()=>setRange({from_date:"",to_date:""})}>Clear</GhostButton>}</div></div>
    {error && <Alert>{error}</Alert>}{loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">Loading aggregated dashboard…</div> : <Component data={activeData} />}
  </div>;
}
