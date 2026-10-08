import { X, Plus, Search, SlidersHorizontal } from "lucide-react";

export function PageHeader({ eyebrow, title, subtitle, action, actions }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        {eyebrow && <span className="text-xs font-black tracking-wider text-indigo-600 uppercase">{eyebrow}</span>}
        <h2 className="text-xl font-bold text-slate-900 mt-0.5">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions || action}
    </div>
  );
}

export function Panel({ title, subtitle, toolbar, children, className = "" }) {
  return (
    <section className={`border border-slate-200 rounded-xl bg-white shadow-sm p-3 ${className}`}>
      {(title || toolbar) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          {title && <div><h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{title}</h3>{subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}</div>}
          {toolbar}
        </div>
      )}
      {children}
    </section>
  );
}

export function KpiCard({ label, value, hint, tone = "blue", icon: Icon }) {
  const tones = { blue: "border-indigo-200", green: "border-emerald-200", red: "border-rose-200", amber: "border-amber-200" };
  const valueTones = { blue: "text-indigo-600", green: "text-emerald-600", red: "text-rose-600", amber: "text-amber-600" };
  return (
    <div className={`border ${tones[tone] || tones.blue} rounded-xl bg-white p-3 min-h-[92px] shadow-sm`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</div>
        {Icon && <Icon size={16} className={valueTones[tone] || valueTones.blue} />}
      </div>
      <div className={`text-xl font-black mt-2 ${valueTones[tone] || valueTones.blue}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

export function FilterBar({ children, search, onSearch, placeholder = "Search..." }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 mb-4 shadow-sm">
      <div className="flex items-center gap-2 pr-3 mr-1 border-r border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wide">
        <SlidersHorizontal size={15} /> Filters
      </div>
      {onSearch && (
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} className="w-full pl-9" />
        </div>
      )}
      {children}
    </div>
  );
}

export function Modal({ open, title, subtitle, onClose, children, size = "xl" }) {
  if (!open) return null;
  const sizes = { md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-6xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-slate-900/35 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`w-full ${sizes[size] || sizes.xl} max-h-[94vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}>
        <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-white">
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto max-h-[calc(92vh-86px)] p-3">{children}</div>
      </div>
    </div>
  );
}

export function FormGrid({ children, onSubmit, className = "" }) {
  return <form onSubmit={onSubmit} className={`grid sm:grid-cols-2 gap-3 ${className}`}>{children}</form>;
}

export function Field({ label, full, required, children }) {
  return <label className={`flex flex-col gap-1 ${full ? "sm:col-span-2" : ""}`}><span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{label}{required && <span className="text-rose-600 ml-1">*</span>}</span>{children}</label>;
}

const inputClasses = "bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm placeholder:text-slate-400";
export function Input(props) { return <input {...props} className={`${inputClasses} ${props.className || ""}`} />; }
export function Select(props) { return <select {...props} className={`${inputClasses} ${props.className || ""}`} />; }
export function TextArea(props) { return <textarea {...props} className={`${inputClasses} min-h-[72px] ${props.className || ""}`} />; }

export function PrimaryButton({ children, className = "", ...rest }) {
  return <button {...rest} className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}>{children}</button>;
}
export function AddButton({ children = "Add New", ...rest }) { return <PrimaryButton {...rest}><Plus size={15} />{children}</PrimaryButton>; }
export function GhostButton({ children, className = "", ...rest }) { return <button {...rest} className={`px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all disabled:opacity-50 ${className}`}>{children}</button>; }
export function SmallButton({ children, className = "", ...rest }) { return <button {...rest} className={`px-2 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all mr-1.5 ${className}`}>{children}</button>; }
export function DangerButton({ children, className = "", ...rest }) { return <button {...rest} className={`px-2 py-1 rounded text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-all ${className}`}>{children}</button>; }

const STATUS_STYLES = {
  PASSED: "bg-emerald-50 text-emerald-700 border-emerald-200", ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200", ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200", AWARDED: "bg-emerald-50 text-emerald-700 border-emerald-200", COMPLETED: "bg-indigo-50 text-indigo-700 border-indigo-200", PENDING: "bg-amber-50 text-amber-700 border-amber-200", ON_HOLD: "bg-amber-50 text-amber-700 border-amber-200", FAILED: "bg-rose-50 text-rose-600 border-rose-200", REJECTED: "bg-rose-50 text-rose-600 border-rose-200", CANCELLED: "bg-rose-50 text-rose-600 border-rose-200", LOST: "bg-rose-50 text-rose-600 border-rose-200", DISABLED: "bg-rose-50 text-rose-600 border-rose-200",
};
export function StatusBadge({ status }) { const key = String(status || "").toUpperCase(); return <span className={`px-2 py-0.5 rounded-full font-semibold border text-xs capitalize whitespace-nowrap ${STATUS_STYLES[key] || "bg-slate-50 text-slate-500 border-slate-200"}`}>{status ? String(status).replaceAll("_", " ").toLowerCase() : "unknown"}</span>; }
export function Alert({ type = "error", children }) { const styles = type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-300 text-rose-600"; return <div className={`rounded-lg border px-3 py-2 text-sm mb-2 ${styles}`}>{children}</div>; }
export function EmptyState({ message = "No records found." }) { return <div className="text-center py-8 text-slate-500 text-sm">{message}</div>; }
export function Table({ columns, children }) { return <div className="w-full overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-sm text-left border-collapse"><thead><tr className="bg-slate-50 text-slate-600 text-xs font-bold tracking-wider uppercase border-b border-slate-200">{columns.map((c) => <th key={c} className="px-3 py-2.5 whitespace-nowrap">{c}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}</tbody></table></div></div>; }
export function DataTable({ rows, cols, renderCell }) { if (!rows?.length) return <EmptyState />; return <Table columns={cols.map((c) => c.replaceAll("_", " "))}>{rows.map((row) => <tr key={row._id} className="hover:bg-slate-50 transition-colors">{cols.map((c) => <td key={c} className="px-3 py-2 text-slate-700">{renderCell ? renderCell(row, c) : String(row[c] ?? "—")}</td>)}</tr>)}</Table>; }
