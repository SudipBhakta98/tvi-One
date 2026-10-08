import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { useAuth } from "../../auth/contexts/AuthContext";
import { useWarehouse } from "../contexts/WarehouseContext";
import { isDeptMember } from "../../../constants/roles";
import { PageHeader, Panel, KpiCard, FilterBar, FormGrid, Field, Input, Select, PrimaryButton, SmallButton, DangerButton, StatusBadge, Table, Alert, EmptyState, Modal } from "../../../components/ui";

const initial = { purchase_order: "", invoice_number: "", received_qty: 1, received_date: new Date().toISOString().slice(0, 10) };

export default function WarehousePage() {
  const { user } = useAuth();
  const can = isDeptMember(user?.role, "WAREHOUSE");
  const { rows, error: loadError, load, create } = useWarehouse();
  const [pos, setPos] = useState([]);
  const [form, setForm] = useState(initial);
  const [open, setOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [quality, setQuality] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    load();
    api.get(ENDPOINTS.PURCHASE.BASE).then((r) => setPos((r.data || []).filter((x) => x.status !== "REJECTED")));
  }, [load]);
  useEffect(() => { if (searchParams.get("create") === "1") { setOpen(true); setSearchParams({}, { replace: true }); } }, [searchParams, setSearchParams]);

  const filtered = useMemo(
    () => rows.filter((r) => `${r.invoice_number || ""} ${r.purchase_order?.po_number || r.purchase_order || ""}`.toLowerCase().includes(search.toLowerCase()) && (!quality || r.quality_status === quality)),
    [rows, search, quality]
  );

  const add = async (e) => {
    e.preventDefault(); setError("");
    try { await create({ ...form, received_qty: Number(form.received_qty) }); setForm(initial); setOpen(false); }
    catch (err) { setError(err.response?.data?.error || "GRN failed"); }
  };

  const inspect = async (id, status) => {
    try {
      const grn = rows.find((x) => x._id === id);
      await api.patch(`${ENDPOINTS.WAREHOUSE.BASE}/${id}/inspection`, { quality_status: status, accepted_qty: status === "ACCEPTED" ? grn.received_qty : 0, rejected_qty: status === "REJECTED" ? grn.received_qty : 0 });
      await load();
    } catch (err) { setError(err.response?.data?.error || "Inspection failed"); }
  };

  return (
    <div className="space-y-2">
      <PageHeader eyebrow="Warehouse" title="Warehouse & GRN" subtitle="Receive material, capture invoices and complete incoming inspection." />
      {(error || loadError) && <Alert>{error || loadError}</Alert>}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        <KpiCard label="Total GRNs" value={rows.length} />
        <KpiCard label="Pending QC" value={rows.filter((x) => x.quality_status === "PENDING").length} tone="amber" />
        <KpiCard label="Accepted" value={rows.filter((x) => x.quality_status === "ACCEPTED").length} tone="green" />
        <KpiCard label="Rejected" value={rows.filter((x) => x.quality_status === "REJECTED").length} tone="red" />
      </div>
      <FilterBar search={search} onSearch={setSearch} placeholder="Search PO or invoice...">
        <label className="text-xs font-bold text-slate-400 uppercase">Quality
          <Select className="ml-2" value={quality} onChange={(e) => setQuality(e.target.value)}>
            <option value="">All</option><option>PENDING</option><option>ACCEPTED</option><option>REJECTED</option>
          </Select>
        </label>
      </FilterBar>
      <Panel title="GRN & Inspection" toolbar={<span className="text-xs text-slate-500">{filtered.length} records</span>}>
        {filtered.length ? (
          <Table columns={["PO", "Invoice", "Received", "Quality", "Action"]}>
            {filtered.map((r) => (
              <tr key={r._id} onClick={() => setSelected(r)} className="cursor-pointer hover:bg-indigo-700/5">
                <td className="px-3 py-2 font-mono text-xs text-indigo-600">{r.purchase_order?.po_number || r.purchase_order}</td>
                <td className="px-3 py-2 text-slate-700">{r.invoice_number || "—"}</td>
                <td className="px-3 py-2 text-slate-700">{r.received_qty}</td>
                <td className="px-3 py-2"><StatusBadge status={r.quality_status} /></td>
                <td className="px-3 py-2">
                  {can && r.quality_status === "PENDING" && (
                    <>
                      <SmallButton onClick={(e) => { e.stopPropagation(); inspect(r._id, "ACCEPTED"); }}>Accept</SmallButton>
                      <DangerButton onClick={(e) => { e.stopPropagation(); inspect(r._id, "REJECTED"); }}>Reject</DangerButton>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        ) : <EmptyState />}
      </Panel>
      <Modal open={open} onClose={() => setOpen(false)} title="Receive Material" subtitle="Create GRN against an approved purchase order.">
        <FormGrid onSubmit={add}>
          <Field label="Purchase Order"><Select required value={form.purchase_order} onChange={(e) => setForm({ ...form, purchase_order: e.target.value })}><option value="">Select PO</option>{pos.map((p) => <option key={p._id} value={p._id}>{p.po_number} · {p.supplier}</option>)}</Select></Field>
          <Field label="Invoice Number"><Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} /></Field>
          <Field label="Received Qty"><Input type="number" min="1" value={form.received_qty} onChange={(e) => setForm({ ...form, received_qty: e.target.value })} /></Field>
          <Field label="Received Date"><Input type="date" value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} /></Field>
          <PrimaryButton type="submit" className="sm:col-span-2 w-fit">Create GRN</PrimaryButton>
        </FormGrid>
      </Modal>
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.purchase_order?.po_number || "GRN"} subtitle={selected?.invoice_number || "No invoice number"}>
        <div className="grid grid-cols-2 gap-2">
          <KpiCard label="Received" value={selected?.received_qty || 0} />
          <KpiCard label="Quality" value={selected?.quality_status || "—"} tone={selected?.quality_status === "REJECTED" ? "red" : selected?.quality_status === "ACCEPTED" ? "green" : "amber"} />
        </div>
      </Modal>
    </div>
  );
}
