import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { useAuth } from "../../auth/contexts/AuthContext";
import { useDispatch as useDispatchModule } from "../contexts/DispatchContext";
import { isDeptMember } from "../../../constants/roles";
import { PageHeader, Panel, KpiCard, FilterBar, FormGrid, Field, Input, Select, PrimaryButton, Table, Alert, EmptyState, Modal } from "../../../components/ui";

const initial = { project: "", dispatched_qty: 1, date: new Date().toISOString().slice(0, 10), vehicle_number: "", customer_reference: "" };

export default function DispatchPage() {
  const { user } = useAuth();
  const can = isDeptMember(user?.role, "DISPATCH");
  const { rows, error: loadError, load, create } = useDispatchModule();
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(initial);
  const [open, setOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    load();
    api.get(ENDPOINTS.PROJECTS.BASE).then((r) => setProjects(r.data || []));
  }, [load]);

  useEffect(() => { if (searchParams.get("create") === "1" && can) { setOpen(true); setSearchParams({}, { replace: true }); } }, [searchParams, setSearchParams, can]);

  const filtered = useMemo(
    () => rows.filter((r) => `${r.project?.project_name || r.project} ${r.vehicle_number || ""} ${r.customer_reference || ""}`.toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  );

  const add = async (e) => {
    e.preventDefault(); setError("");
    try { await create({ ...form, dispatched_qty: Number(form.dispatched_qty) }); setForm(initial); setOpen(false); }
    catch (err) { setError(err.response?.data?.error || "Dispatch failed"); }
  };

  return (
    <div className="space-y-2">
      <PageHeader eyebrow="Dispatch" title="Dispatch" subtitle="Dispatch only quantities released by Production QC." />
      {(error || loadError) && <Alert>{error || loadError}</Alert>}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        <KpiCard label="Total Dispatches" value={rows.length} />
        <KpiCard label="Total Qty" value={rows.reduce((n, r) => n + Number(r.dispatched_qty || 0), 0)} tone="green" />
        <KpiCard label="Projects" value={new Set(rows.map((r) => r.project?._id || r.project)).size} />
        <KpiCard label="This Month" value={rows.filter((r) => new Date(r.date).getMonth() === new Date().getMonth()).length} tone="blue" />
      </div>
      <FilterBar search={search} onSearch={setSearch} placeholder="Search project, vehicle, reference..." />
      <Panel title="Dispatch Register" toolbar={<span className="text-xs text-slate-500">{filtered.length} records</span>}>
        {filtered.length ? (
          <Table columns={["Project", "Date", "Qty", "Vehicle", "Reference"]}>
            {filtered.map((r) => (
              <tr key={r._id} onClick={() => setSelected(r)} className="cursor-pointer hover:bg-indigo-700/5">
                <td className="px-3 py-2 text-slate-900 font-semibold">{r.project?.project_name || r.project}</td>
                <td className="px-3 py-2 text-slate-700">{new Date(r.date).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-slate-700">{r.dispatched_qty}</td>
                <td className="px-3 py-2 text-slate-700 font-mono text-xs">{r.vehicle_number || "—"}</td>
                <td className="px-3 py-2 text-slate-700">{r.customer_reference || "—"}</td>
              </tr>
            ))}
          </Table>
        ) : <EmptyState />}
      </Panel>
      <Modal open={open} onClose={() => setOpen(false)} title="Create Dispatch" subtitle="Confirm dispatch details inside the dialog.">
        <FormGrid onSubmit={add}>
          <Field label="Project"><Select required value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}><option value="">Select project</option>{projects.map((p) => <option key={p._id} value={p._id}>{p.project_name} · {p.customer}</option>)}</Select></Field>
          <Field label="Dispatch Qty"><Input type="number" min="1" value={form.dispatched_qty} onChange={(e) => setForm({ ...form, dispatched_qty: e.target.value })} /></Field>
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Vehicle Number"><Input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} /></Field>
          <Field label="Customer Reference" full><Input value={form.customer_reference} onChange={(e) => setForm({ ...form, customer_reference: e.target.value })} /></Field>
          <PrimaryButton type="submit" className="sm:col-span-2 w-fit">Confirm Dispatch</PrimaryButton>
        </FormGrid>
      </Modal>
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Dispatch Details" subtitle={selected?.project?.project_name || selected?.project}>
        <div className="grid grid-cols-2 gap-2">
          <KpiCard label="Quantity" value={selected?.dispatched_qty || 0} tone="green" />
          <KpiCard label="Date" value={selected?.date ? new Date(selected.date).toLocaleDateString() : "—"} />
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 p-2.5 text-sm text-slate-700">Vehicle: <b className="text-slate-900">{selected?.vehicle_number || "—"}</b><br />Customer reference: <b className="text-slate-900">{selected?.customer_reference || "—"}</b></div>
      </Modal>
    </div>
  );
}
