import { useMemo } from "react";

import {
  FilterBar,
  Panel,
  Select,
  StatusBadge,
  Table,
  EmptyState,
} from "../../../components/ui";

import {
  STAGES,
  stageLabel,
} from "./rfqConfig";

const INITIAL_STAGES = STAGES.slice(0, 8);
const MONTHS = Array.from(
  { length: 12 },
  (_, i) => i
);

export default function RfqRegister({
  rows,
  onSelect,
  filters,
  onFiltersChange,
}) {
  const {
    search,
    month,
    customer,
    projectLead,
    status,
    stage,
  } = filters;

  const customers = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((r) => r.customer)
            .filter(Boolean)
        ),
      ].sort(),
    [rows]
  );

  const owners = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((r) => r.project_lead)
            .filter(Boolean)
        ),
      ].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const haystack = `
        ${r.rfq_number}
        ${r.customer}
        ${r.project_name}
        ${(r.main_parts || [])
          .map((p) => p.main_part_no)
          .join(" ")}
      `.toLowerCase();

      const d = r.rfq_dated
        ? new Date(r.rfq_dated)
        : null;

      return (
        haystack.includes(search.toLowerCase())

        && (
          !month ||
          (
            d &&
            d.getMonth() === Number(month)
          )
        )

        && (
          !customer ||
          r.customer === customer
        )

        && (
          !projectLead ||
          r.project_lead === projectLead
        )

        && (
          !status ||
          r.rfq_status === status
        )

        && (
          !stage ||
          r.current_stage === stage
        )
      );
    });
  }, [
    rows,
    search,
    month,
    customer,
    projectLead,
    status,
    stage,
  ]);

  const updateFilter = (key, value) => {
    onFiltersChange((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const selectClass = "min-w-[145px]";

  return (
    <>
      <FilterBar
        search={search}
        onSearch={(value) =>
          updateFilter("search", value)
        }
        placeholder="Search RFQ, customer, project, part..."
      >
        {/* MONTH */}
        <Select
          value={month}
          onChange={(e) =>
            updateFilter("month", e.target.value)
          }
          className={selectClass}
          aria-label="Filter by month"
        >
          <option value="">
            All months
          </option>

          {MONTHS.map((m) => (
            <option
              key={m}
              value={m}
            >
              {new Date(
                2026,
                m,
                1
              ).toLocaleString(
                "en-IN",
                {
                  month: "long",
                }
              )}
            </option>
          ))}
        </Select>

        {/* CUSTOMER */}
        <Select
          value={customer}
          onChange={(e) =>
            updateFilter(
              "customer",
              e.target.value
            )
          }
          className={selectClass}
          aria-label="Filter by customer"
        >
          <option value="">
            All customers
          </option>

          {customers.map((x) => (
            <option
              key={x}
              value={x}
            >
              {x}
            </option>
          ))}
        </Select>

        {/* PROJECT OWNER */}
        <Select
          value={projectLead}
          onChange={(e) =>
            updateFilter(
              "projectLead",
              e.target.value
            )
          }
          className={selectClass}
          aria-label="Filter by project owner"
        >
          <option value="">
            All project owners
          </option>

          {owners.map((x) => (
            <option
              key={x}
              value={x}
            >
              {x}
            </option>
          ))}
        </Select>

        {/* STATUS */}
        <Select
          value={status}
          onChange={(e) =>
            updateFilter(
              "status",
              e.target.value
            )
          }
          className={selectClass}
          aria-label="Filter by status"
        >
          <option value="">
            All statuses
          </option>

          {[
            "WAITING_FOR_APPROVAL",
            "ACTIVE",
            "ON_HOLD",
            "AWARDED",
            "LOST",
            "CANCELLED",
          ].map((x) => (
            <option
              key={x}
              value={x}
            >
              {x}
            </option>
          ))}
        </Select>

        {/* STAGE */}
        <Select
          value={stage}
          onChange={(e) =>
            updateFilter(
              "stage",
              e.target.value
            )
          }
          className="min-w-[230px]"
          aria-label="Filter by stage"
        >
          <option value="">
            All stages
          </option>

          {INITIAL_STAGES.map(
            ([key, label], i) => (
              <option
                key={key}
                value={key}
              >
                Stage {i + 1} · {label}
              </option>
            )
          )}

          {STAGES.slice(8).map(
            ([key, label]) => (
              <option
                key={key}
                value={key}
              >
                {label}
              </option>
            )
          )}
        </Select>
      </FilterBar>

      <Panel
        title="RFQ Register"
        toolbar={
          <span className="text-xs text-slate-600">
            {filtered.length} of {rows.length} records
          </span>
        }
      >
        {filtered.length ? (
          <Table
            columns={[
              "RFQ",
              "Customer",
              "Project",
              "Owner",
              "Parts",
              "Quoted Value",
              "Current Stage",
              "Status",
            ]}
          >
            {filtered.map((r) => (
              <tr
                key={r._id}
                onClick={() =>
                  onSelect(r._id)
                }
                className="cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <td className="px-3 py-2 font-mono text-xs text-indigo-600 font-semibold">
                  {r.rfq_number}
                </td>

                <td className="px-3 py-2 text-slate-900 font-semibold">
                  {r.customer}
                </td>

                <td className="px-3 py-2 text-slate-700">
                  {r.project_name}
                </td>

                <td className="px-3 py-2 text-slate-600">
                  {r.project_lead}
                </td>

                <td className="px-3 py-2 text-slate-600">
                  {r.main_parts?.length || 1}
                  {" / "}
                  {(r.main_parts || [])
                    .reduce(
                      (n, p) =>
                        n +
                        (p.sub_parts?.length || 0),
                      0
                    )}
                </td>

                <td className="px-3 py-2 font-semibold text-emerald-600">
                  {r.costing?.quoted_price
                    ? `₹${Number(
                        r.costing.quoted_price
                      ).toLocaleString("en-IN")}`
                    : "—"}
                </td>

                <td className="px-3 py-2 text-slate-600 text-xs max-w-[220px]">
                  {stageLabel(
                    r.current_stage
                  )}
                </td>

                <td className="px-3 py-2">
                  <StatusBadge
                    status={r.rfq_status}
                  />
                </td>
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