import { useMemo, useState } from "react";
import { Select } from "../../../components/ui";

const unique = (values) => [...new Set(values)];

/** Year / Month / Day pickers over the dates that have a previous-day report. Choosing a day loads that report. Remount (key) when `selectedDate` changes. */
export default function DateFilter({ dates = [], selectedDate, loading, onSelectDate }) {
  const [initialDay = "", initialMonth = "", initialYear = ""] = (selectedDate || "").split("-");
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [day, setDay] = useState(initialDay);

  const parsedDates = useMemo(() => dates.map((date) => { const [d, m, y] = date.split("-"); return { d, m, y }; }), [dates]);
  const years = useMemo(() => unique(parsedDates.map((p) => p.y)).sort().reverse(), [parsedDates]);
  const months = useMemo(() => unique(parsedDates.filter((p) => p.y === year).map((p) => p.m)).sort(), [parsedDates, year]);
  const days = useMemo(() => parsedDates.filter((p) => p.y === year && p.m === month).map((p) => p.d).sort(), [parsedDates, year, month]);

  const pickers = [
    { label: "Year", value: year, options: years, onChange: setYear },
    { label: "Month", value: month, options: months, onChange: setMonth },
    { label: "Day", value: day, options: days, onChange: (picked) => { setDay(picked); onSelectDate(`${picked}-${month}-${year}`); } },
  ];

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
      {pickers.map(({ label, value, options, onChange }) => (
        <label key={label} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600">
          {label}
          <Select value={value} onChange={(e) => onChange(e.target.value)} className="!py-1 !px-2 !text-xs">
            <option value="">{label}</option>
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
          </Select>
        </label>
      ))}
      {loading && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" />}
    </div>
  );
}
