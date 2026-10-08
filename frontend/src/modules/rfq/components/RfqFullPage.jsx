import { X } from "lucide-react";

/** Full-page shell for RFQ screens: sticky title bar with an always-visible Close button. */
export default function RfqFullPage({
  title,
  subtitle,
  onClose,
  actions,
  children,
}) {
  return (
    <div className="space-y-3">
      <header className="sticky top-0 z-20 -mx-3 -mt-3 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-slate-900">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-xs text-slate-600">{subtitle}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
          >
            <X size={14} /> Close
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
