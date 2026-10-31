const COUNTER_BADGES = [
  { field: "lateEntry", short: "L", className: "text-amber-600" },
  { field: "earlyExit", short: "E", className: "text-orange-600" },
  { field: "missPunch", short: "M", className: "text-purple-600" },
];

/** Present / absent (and, for the previous day, late / early / missed) counters per company, department or unit. */
export default function DistributionList({ data }) {
  const entries = Object.entries(data || {});
  if (!entries.length) return <div className="text-xs text-slate-400 italic p-1">No operational metrics available.</div>;

  return (
    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
      {entries.map(([name, counters]) => (
        <div key={name} className="flex items-center gap-x-2 rounded border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm">
          <span className="font-bold text-slate-800 border-r border-slate-200 pr-1.5 truncate max-w-[110px]" title={name}>{name}</span>
          <span className="font-semibold text-emerald-600">P:{counters.present || 0}</span>
          <span className="font-semibold text-rose-500">A:{counters.absent || 0}</span>
          {COUNTER_BADGES.filter(({ field }) => counters[field] > 0).map(({ field, short, className }) => (
            <span key={field} className={`font-semibold ${className}`}>{short}:{counters[field]}</span>
          ))}
        </div>
      ))}
    </div>
  );
}
