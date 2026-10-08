import { useEffect, useMemo, useState } from "react";
import { PageHeader, Panel, KpiCard, FilterBar, Select, StatusBadge, Table, EmptyState, Modal, GhostButton } from "../../../components/ui";
import { useProjects } from "../contexts/ProjectsContext";

export default function ProjectsPage() {
  const { rows, error, load } = useProjects();
  const [search, setSearch] = useState(""), [status, setStatus] = useState(""), [selected, setSelected] = useState(null);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(
    () => rows.filter((p) => `${p.project_name} ${p.customer}`.toLowerCase().includes(search.toLowerCase()) && (!status || p.status === status)),
    [rows, search, status]
  );

  return (
    <div className="space-y-2">
      <PageHeader eyebrow="Cross-Department · Project Control" title="Projects" subtitle="Mass-production projects handed over from NPD." />
      {error && <div className="rounded-lg border border-rose-300/20 bg-rose-50 px-3 py-2 text-sm text-rose-600 mb-2">{error}</div>}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        <KpiCard label="Total Projects" value={rows.length} />
        <KpiCard label="Active" value={rows.filter((x) => x.status === "ACTIVE").length} tone="green" />
        <KpiCard label="On Hold" value={rows.filter((x) => x.status === "ON_HOLD").length} tone="amber" />
        <KpiCard label="Completed" value={rows.filter((x) => x.status === "COMPLETED").length} tone="blue" />
      </div>
      <FilterBar search={search} onSearch={setSearch} placeholder="Search project or customer...">
        <label className="text-xs font-bold text-slate-400 uppercase">
          Status
          <Select className="ml-2" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"].map((x) => <option key={x}>{x}</option>)}
          </Select>
        </label>
      </FilterBar>
      <Panel title="Project Register" toolbar={<span className="text-xs text-slate-500">{filtered.length} records</span>}>
        {filtered.length ? (
          <Table columns={["Project", "Customer", "Order Qty", "Owner", "Status"]}>
            {filtered.map((p) => (
              <tr key={p._id} onClick={() => setSelected(p)} className="cursor-pointer hover:bg-indigo-700/5">
                <td className="px-3 py-2 text-slate-900 font-semibold">{p.project_name}</td>
                <td className="px-3 py-2 text-slate-700">{p.customer}</td>
                <td className="px-3 py-2 text-slate-700">{p.order_qty}</td>
                <td className="px-3 py-2 text-slate-400">{p.project_owner}</td>
                <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState />
        )}
      </Panel>
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.project_name || "Project"} subtitle={selected?.customer}>
        <div className="grid grid-cols-2 gap-2">
          <KpiCard label="Order Qty" value={selected?.order_qty || 0} />
          <KpiCard label="Status" value={selected?.status || "—"} tone="green" />
        </div>
        <div className="mt-5 rounded-xl border border-slate-200 p-2.5 text-sm text-slate-700">
          Project owner: <b className="text-slate-900">{selected?.project_owner || "—"}</b>
        </div>
        <div className="mt-4 flex justify-end"><GhostButton onClick={() => setSelected(null)}>Close</GhostButton></div>
      </Modal>
    </div>
  );
}
