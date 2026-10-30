import { FilterBar, Panel, StatusBadge, Table, EmptyState } from "../../../components/ui";
import RfqFilterBar from "./RfqFilterBar";

const COLUMNS = ["RFQ No", "Customer Name", "Project Name", "Project Owner", "Main Part Qty", "Sub Part Qty", "Total Quoted Value", "Total Awarded Value", "Status"];

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
            {rows.map((r) => (
              <tr key={r._id} onClick={() => onSelect(r._id)} className="cursor-pointer hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2 font-mono text-xs text-indigo-600 font-semibold">{r.rfq_number}</td>
                <td className="px-3 py-2 text-slate-900 font-semibold">{r.customer}</td>
                <td className="px-3 py-2 text-slate-700">{r.project_name}</td>
                <td className="px-3 py-2 text-slate-600">{r.project_owner_name}</td>
                <td className="px-3 py-2 text-slate-600">{r.main_part_qty ?? r.main_parts?.length ?? 0}</td>
                <td className="px-3 py-2 text-slate-600">{r.sub_part_qty ?? (r.main_parts || []).reduce((count, part) => count + (part.sub_parts?.length || 0), 0)}</td>
                <td className="px-3 py-2 font-semibold text-emerald-600">{`₹${Number(r.total_quoted_value || 0).toLocaleString("en-IN")}`}</td>
                <td className="px-3 py-2 font-semibold text-emerald-600">{`₹${Number(r.total_awarded_value || 0).toLocaleString("en-IN")}`}</td>
                <td className="px-3 py-2"><StatusBadge status={r.lifecycle_status || "ACTIVE"} /></td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState message="No RFQs match the current filters." />
        )}
      </Panel>
    </>
  );
}
