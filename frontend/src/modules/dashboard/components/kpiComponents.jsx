// Small reusable building blocks shared by the RFQ, Project and Production dashboard tabs.
// Matches the shared /components/ui.jsx dark design system.

export function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="border border-slate-200 rounded-xl bg-white shadow-xl p-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</span>
        {Icon && <Icon size={18} className="text-indigo-600 opacity-70" />}
      </div>
      <div className="text-3xl font-bold text-slate-900">{value ?? "—"}</div>
    </div>
  );
}

export function SectionCard({ title, subtitle, children, className = "" }) {
  return (
    <div className={`border border-slate-200 rounded-xl bg-white shadow-xl p-2 ${className}`}>
      {title && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function ProgressRow({ value, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="min-w-[140px]">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500">{pct}%</span>
        <span className="font-semibold text-slate-700">{value} / {total}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-800">
        <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ message = "No data yet." }) {
  return <div className="py-8 text-center text-sm text-slate-500">{message}</div>;
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return <div className="rounded-lg border px-3 py-2 text-sm mb-4 bg-rose-50 border-rose-300/20 text-rose-600">{message}</div>;
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
    </div>
  );
}
