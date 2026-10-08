import React from "react";

const STATUS_STYLES = {
  collected: { label: "Collected", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  partial: { label: "Partial", badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  uncollected: { label: "Uncollected", badge: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
};
const UNKNOWN_STATUS = { label: "Unknown", badge: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" };

// Days left at or above this are shown green, below it amber, past due red.
const COMFORTABLE_DAYS_LEFT = 15;

export function StatusBadge({ status }) {
  const style = STATUS_STYLES[String(status || "").toLowerCase()] || UNKNOWN_STATUS;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${style.dot}`} />
      {style.label}
    </span>
  );
}

export function DueDaysBadge({ status, dueDays }) {
  if (String(status || "").toLowerCase() === "collected" || dueDays === undefined || dueDays === null) {
    return <span className="text-slate-400">—</span>;
  }

  const days = Number(dueDays);
  const style =
    days >= COMFORTABLE_DAYS_LEFT
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : days >= 0
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-rose-700 bg-rose-50 border-rose-200 font-bold";

  return (
    <span className={`inline-block px-2 py-0.5 rounded border text-xs whitespace-nowrap ${style}`}>
      {days >= 0 ? `${days} days left` : `${Math.abs(days)} days overdue`}
    </span>
  );
}

export function CollectionStatusBadge({ status }) {
  const styles = {
    approved: "bg-emerald-50 text-emerald-600 border-emerald-200",
    pending: "bg-amber-50 text-amber-600 border-amber-200",
    rejected: "bg-rose-50 text-rose-600 border-rose-200",
  };
  const key = String(status || "").toLowerCase();
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${styles[key] || "bg-slate-100 text-slate-500 border-slate-200"}`}>
      {status}
    </span>
  );
}
