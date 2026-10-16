import { FilterBar, Panel, StatusBadge, Table, EmptyState } from "../../../components/ui";
import RfqFilterBar from "./RfqFilterBar";
import { formatDate, stageLabel } from "./rfqConfig";

const LATE_STATUSES = ["DELAY_PENDING", "DELAY_DONE"];
const REMARK_PREVIEW_WIDTH = "max-w-[240px]";
const COLUMNS = ["RFQ", "Customer", "Project", "Owner", "Parts", "Quoted Value", "Current Stage", "Stage Due Date", "Latest Remark", "Status"];

/**
 * RFQ register. Search filters in the browser; the Excel-style column filters (Month included) are applied by the server,
 * so `rows` already arrive narrowed and `options` (the dropdown values) come from the server too.
 */
export default function RfqRegister({ rows, options, columnFilters, hasColumnFilters, onColumnFilterChange, onResetColumnFilters, filters, onFiltersChange, onSelect }) {
  const updateFilter = (key, value) => onFiltersChange((previous) => ({ ...previous, [key]: value }));

  return (
    <>
      <FilterBar search={filters.search} onSearch={(value) => updateFilter("search", value)} placeholder="Search RFQ, customer, project, part...">
        <RfqFilterBar options={options} filters={columnFilters} hasFilters={hasColumnFilters} onChange={onColumnFilterChange} onReset={onResetColumnFilters} />
      </FilterBar>

      <Panel title="RFQ Register" toolbar={<span className="text-xs text-slate-600">{rows.length} records</span>}>
        {rows.length ? (
          <Table columns={COLUMNS}>
            {rows.map((r) => {
              const isLate = LATE_STATUSES.includes(r.current_stage_status);
              const subPartCount = (r.main_parts || []).reduce((count, part) => count + (part.sub_parts?.length || 0), 0);
              return (
                <tr key={r._id} onClick={() => onSelect(r._id)} className="cursor-pointer hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 font-mono text-xs text-indigo-600 font-semibold">{r.rfq_number}</td>
                  <td className="px-3 py-2 text-slate-900 font-semibold">{r.customer}</td>
                  <td className="px-3 py-2 text-slate-700">{r.project_name}</td>
                  <td className="px-3 py-2 text-slate-600">{r.project_owner_name}</td>
                  <td className="px-3 py-2 text-slate-600">{r.main_parts?.length || 1} / {subPartCount}</td>
                  <td className="px-3 py-2 font-semibold text-emerald-600">{r.costing?.quoted_price ? `₹${Number(r.costing.quoted_price).toLocaleString("en-IN")}` : "—"}</td>
                  <td className="px-3 py-2 text-slate-600 text-xs max-w-[220px]">{stageLabel(r.current_stage)}</td>
                  <td className={`px-3 py-2 text-xs whitespace-nowrap ${isLate ? "font-bold text-rose-600" : "text-slate-600"}`}>
                    {formatDate(r.current_due_date)}{isLate && " · overdue"}
                  </td>
                  <td className={`px-3 py-2 text-xs text-slate-600 truncate ${REMARK_PREVIEW_WIDTH}`} title={r.latest_remark?.text}>
                    {r.latest_remark ? `${r.latest_remark.text} — ${r.latest_remark.user_name}` : "—"}
                  </td>
                  <td className="px-3 py-2"><StatusBadge status={r.rfq_status} /></td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <EmptyState message="No RFQs match the current filters." />
        )}
      </Panel>
    </>
  );
}
