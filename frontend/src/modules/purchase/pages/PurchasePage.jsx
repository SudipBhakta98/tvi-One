import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { useAuth } from "../../auth/contexts/AuthContext";
import { usePurchase } from "../contexts/PurchaseContext";
import { isDeptManager } from "../../../constants/roles";
import { PageHeader, Panel, KpiCard, FilterBar, FormGrid, Field, Input, Select, PrimaryButton, GhostButton, StatusBadge, Table, Alert, EmptyState, Modal } from "../../../components/ui";

const initialForm = { project: "", component: "", po_number: "", supplier: "", total_quantity: 1, cost: "" };

export default function PurchasePage() {
  const { user } = useAuth();
  const canCreate = isDeptManager(user?.role, "SCM") || user?.role === "SCM_USER";
  const { rows, error: loadError, load } = usePurchase();
  const [projects, setProjects] = useState([]);
  const [components, setComponents] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [open, setOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    load();
    api.get(ENDPOINTS.PROJECTS.BASE).then((r) => setProjects(r.data || []));
  }, [load]);

  useEffect(() => { if (searchParams.get("create") === "1") { setOpen(true); setSearchParams({}, { replace: true }); } }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!form.project) { setComponents([]); return; }
    api.get(`${ENDPOINTS.RFQ.COMPONENTS}/project/${form.project}`).then((r) => setComponents(r.data || [])).catch(() => setComponents([]));
  }, [form.project]);

  const filtered = useMemo(
    () => rows.filter((r) => `${r.po_number} ${r.supplier} ${r.purchase_type}`.toLowerCase().includes(search.toLowerCase()) && (!status || r.status === status)),
    [rows, search, status]
  );

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post(ENDPOINTS.PURCHASE.BASE, { ...form, purchase_type: "PRODUCTION", total_quantity: Number(form.total_quantity), cost: Number(form.cost || 0) });
      setForm(initialForm); setOpen(false); load();
    } catch (err) { setError(err.response?.data?.error || "PO creation failed"); }
  };

  return (
    <div className="space-y-2">
      <PageHeader eyebrow="SCM" title="Purchase Orders" subtitle="Production purchase orders with supplier, component and quantity tracking." />
      {(error || loadError) && <Alert>{error || loadError}</Alert>}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        <KpiCard label="Total POs" value={rows.length} hint="All purchase orders" />
        <KpiCard label="Pending" value={rows.filter((r) => r.status === "PENDING").length} tone="amber" hint="Awaiting action" />
        <KpiCard label="Approved" value={rows.filter((r) => r.status === "APPROVED").length} tone="green" hint="Approved POs" />
        <KpiCard label="Rejected" value={rows.filter((r) => r.status === "REJECTED").length} tone="red" hint="Rejected POs" />
      </div>
      <FilterBar search={search} onSearch={setSearch} placeholder="Search PO, supplier, type...">
        <label className="text-xs font-bold text-slate-400 uppercase">Status
          <Select className="ml-2 min-w-[150px]" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {["UNDER_DISCUSSION", "ACCEPTED", "REJECTED"].map((x) => <option key={x}>{x}</option>)}
          </Select>
        </label>
      </FilterBar>
      <Panel title="PO Register" toolbar={<span className="text-xs text-slate-500">{filtered.length} records</span>}>
        {filtered.length ? (
          <Table columns={["PO Number", "Supplier", "Type", "Quantity", "Cost", "Status"]}>
            {filtered.map((r) => (
              <tr key={r._id} onClick={() => setSelected(r)} className="cursor-pointer hover:bg-indigo-700/5">
                <td className="px-3 py-2 font-mono text-xs text-indigo-600">{r.po_number}</td>
                <td className="px-3 py-2 text-slate-900 font-semibold">{r.supplier}</td>
                <td className="px-3 py-2 text-slate-400">{r.purchase_type}</td>
                <td className="px-3 py-2 text-slate-700">{r.total_quantity}</td>
                <td className="px-3 py-2 text-slate-700">₹{Number(r.cost || 0).toLocaleString("en-IN")}</td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </Table>
        ) : <EmptyState />}
      </Panel>
      <Modal open={open} onClose={() => setOpen(false)} title="Create Purchase Order" subtitle="Create the PO inside the dialog; the register remains the primary workspace.">
        <FormGrid onSubmit={submit}>
          <Field label="Project"><Select required value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value, component: "" })}><option value="">Select project</option>{projects.map((p) => <option key={p._id} value={p._id}>{p.project_name} · {p.customer}</option>)}</Select></Field>
          <Field label="Component"><Select required value={form.component} onChange={(e) => setForm({ ...form, component: e.target.value })}><option value="">Select component</option>{components.map((c) => <option key={c._id} value={c._id}>{c.component_name} · {c.total_qty}</option>)}</Select></Field>
          <Field label="PO Number"><Input required value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} /></Field>
          <Field label="Supplier"><Input required value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></Field>
          <Field label="Quantity"><Input type="number" min="1" value={form.total_quantity} onChange={(e) => setForm({ ...form, total_quantity: e.target.value })} /></Field>
          <Field label="Cost"><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></Field>
          <div className="sm:col-span-2 flex justify-end gap-2"><GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton><PrimaryButton type="submit">Create PO</PrimaryButton></div>
        </FormGrid>
      </Modal>
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.po_number || "Purchase Order"} subtitle={selected?.supplier}>
        <div className="grid grid-cols-2 gap-2">
          <KpiCard label="Quantity" value={selected?.total_quantity || 0} />
          <KpiCard label="Status" value={selected?.status || "—"} tone={selected?.status === "REJECTED" ? "red" : "green"} />
        </div>
        <div className="mt-5 rounded-xl border border-slate-200 p-2.5 text-sm text-slate-700">Purchase type: <b className="text-slate-900">{selected?.purchase_type}</b><br />Cost: <b className="text-slate-900">₹{Number(selected?.cost || 0).toLocaleString("en-IN")}</b></div>
      </Modal>
    </div>
  );
}
