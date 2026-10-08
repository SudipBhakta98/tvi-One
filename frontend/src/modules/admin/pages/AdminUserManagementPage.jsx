import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAdmin } from "../contexts/AdminContext";
import { ALL_ROLES, ROLE_LABELS } from "../../../constants/roles";
import { PageHeader, Panel, KpiCard, FilterBar, Input, Select, PrimaryButton, GhostButton, StatusBadge, Table, Alert, EmptyState, Modal } from "../../../components/ui";

const initial = { name: "", email: "", password: "", role: "NPD_MANAGER", department: "NPD" };

export default function AdminUserManagementPage() {
  const { users, sessions, logs, error, load, createUser, updateUser } = useAdmin();
  const [form, setForm] = useState(initial);
  const [open, setOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (searchParams.get("create") === "1") { setOpen(true); setSearchParams({}, { replace: true }); } }, [searchParams, setSearchParams]);

  const filtered = useMemo(
    () => users.filter((u) => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(search.toLowerCase()) && (!role || u.role === role)),
    [users, search, role]
  );

  const create = async (e) => { e.preventDefault(); await createUser(form); setForm(initial); setOpen(false); };
  const changeRole = async (id, r) => { await updateUser(id, { role: r }); };

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="System Administration"
        title="Administration"
        subtitle="Users, roles, active sessions and audit history. Every department has a Manager (create/edit/delete) and a User (view + create). Super User can operate every module except this screen."

      />
      {error && <Alert>{error}</Alert>}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        <KpiCard label="Users" value={users.length} />
        <KpiCard label="Active Users" value={users.filter((x) => x.isActive).length} tone="green" />
        <KpiCard label="Sessions" value={sessions.length} tone="blue" />
        <KpiCard label="Audit Events" value={logs.length} tone="amber" />
      </div>
      <FilterBar search={search} onSearch={setSearch} placeholder="Search name, email, role...">
        <label className="text-xs font-bold text-slate-400 uppercase">Role
          <Select className="ml-2" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
        </label>
      </FilterBar>
      <Panel title="Users" toolbar={<span className="text-xs text-slate-500">{filtered.length} records</span>}>
        {filtered.length ? (
          <Table columns={["Name", "Email", "Role", "Status"]}>
            {filtered.map((u) => (
              <tr key={u._id} onClick={() => setSelected(u)} className="cursor-pointer hover:bg-indigo-700/5">
                <td className="px-3 py-2 text-slate-900 font-semibold">{u.name}</td>
                <td className="px-3 py-2 text-slate-700">{u.email}</td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <Select value={u.role} onChange={(e) => changeRole(u._id, e.target.value)} className="text-xs py-1.5">
                    {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </Select>
                </td>
                <td className="px-3 py-2"><StatusBadge status={u.isActive ? "ACTIVE" : "DISABLED"} /></td>
              </tr>
            ))}
          </Table>
        ) : <EmptyState />}
      </Panel>
      <Panel title="Audit log">
        <Table columns={["Time", "User", "Action", "Resource"]}>
          {logs.slice(0, 30).map((l) => (
            <tr key={l._id}>
              <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
              <td className="px-3 py-2 text-slate-700">{l.user?.email || "System"}</td>
              <td className="px-3 py-2 text-slate-700 font-mono text-xs">{l.action}</td>
              <td className="px-3 py-2 text-slate-400">{l.resource || "—"}</td>
            </tr>
          ))}
        </Table>
      </Panel>
      <Modal open={open} onClose={() => setOpen(false)} title="Create User" subtitle="Create the account without leaving the user register.">
        <form onSubmit={create} className="grid sm:grid-cols-2 gap-2">
          <Input placeholder="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Temporary password" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
          <Input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          <div className="sm:col-span-2 flex justify-end gap-2"><GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton><PrimaryButton type="submit">Create account</PrimaryButton></div>
        </form>
      </Modal>
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name || "User"} subtitle={selected?.email}>
        <div className="grid grid-cols-2 gap-2">
          <KpiCard label="Role" value={ROLE_LABELS[selected?.role] || selected?.role || "—"} />
          <KpiCard label="Status" value={selected?.isActive ? "ACTIVE" : "DISABLED"} tone={selected?.isActive ? "green" : "red"} />
        </div>
        {selected?.isActive && <div className="mt-4 flex justify-end"><button type="button" onClick={async () => { await updateUser(selected._id, { isActive: false }); setSelected(null); }} className="rounded-lg border border-rose-300/30 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-red-500/20">Deactivate user & revoke sessions</button></div>}
      </Modal>
    </div>
  );
}
