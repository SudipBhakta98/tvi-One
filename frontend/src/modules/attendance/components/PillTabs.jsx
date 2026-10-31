/** Segmented tab buttons. `tabs` is [{ key, label }]; reused for the day tabs and the company / department / unit switch. */
export default function PillTabs({ tabs, active, onChange, size = "md", activeClass = "bg-indigo-600 text-white" }) {
  const sizing = size === "sm" ? "px-2.5 py-1 text-[10px]" : "flex-1 px-3 py-2 text-xs";
  return (
    <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
      {tabs.map((tab) => (
        <button key={tab.key} type="button" onClick={() => onChange(tab.key)} className={`${sizing} rounded-md font-bold uppercase tracking-wide ${active === tab.key ? activeClass : "text-slate-600 hover:bg-slate-100"}`}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
