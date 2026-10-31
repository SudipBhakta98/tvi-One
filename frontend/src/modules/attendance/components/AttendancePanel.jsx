import { useState } from "react";
import { Panel, KpiCard } from "../../../components/ui";
import PillTabs from "./PillTabs";
import DistributionList from "./DistributionList";
import EmployeeTable from "./EmployeeTable";
import { DISTRIBUTION_TABS } from "../constants/attendanceConstants";

const WIDE_GRID = "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6";
const NARROW_GRID = "grid-cols-2 sm:grid-cols-4";
const WIDE_GRID_MIN_METRICS = 5;

const SectionLabel = ({ children }) => <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{children}</span>;

/** One day's view: KPI cards, organizational breakdown and the exception list. Used for both the Today and Previous-day tabs. */
export default function AttendancePanel({ title, dateLabel, headerExtra, metrics, breakdowns, list, frequent, categoryLabel, listToolbar }) {
  const [breakdownTab, setBreakdownTab] = useState(DISTRIBUTION_TABS[0].key);
  return (
    <Panel title={title} toolbar={<div className="flex items-center gap-2">{headerExtra}<span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-700">{dateLabel}</span></div>}>
      <div className={`grid gap-2 mb-3 ${metrics.length >= WIDE_GRID_MIN_METRICS ? WIDE_GRID : NARROW_GRID}`}>
        {metrics.map((metric) => <KpiCard key={metric.label} {...metric} />)}
      </div>

      <div className="mb-3 rounded-lg border border-slate-100 bg-slate-50 p-2">
        <div className="flex items-center justify-between gap-2 mb-2 border-b border-slate-200 pb-1">
          <SectionLabel>Organizational Breakdown</SectionLabel>
          <PillTabs size="sm" tabs={DISTRIBUTION_TABS} active={breakdownTab} onChange={setBreakdownTab} activeClass="bg-slate-700 text-white" />
        </div>
        <DistributionList data={breakdowns[breakdownTab]} />
      </div>

      <div className="flex items-center justify-between gap-2 mb-1.5 min-h-6">
        <SectionLabel>Logs Feed Viewport</SectionLabel>
        {listToolbar}
      </div>
      <EmployeeTable list={list} frequent={frequent} categoryLabel={categoryLabel} />
    </Panel>
  );
}
