import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  BarChart3,
  IndianRupee,
  Target,
} from "lucide-react";

import { useAuth } from "../../auth/contexts/AuthContext";
import { useRfq } from "../contexts/RfqContext";
import {
  AddButton,
  Alert,
  KpiCard,
  PageHeader,
} from "../../../components/ui";

import RfqRegister from "../components/RfqRegister";
import RfqCreatePage from "./RfqCreatePage";
import RfqDetailPage from "./RfqDetailPage";
import useRfqFilters from "../hooks/useRfqFilters";
import { RFQ_CREATE_ROLES, formatMoney } from "../components/rfqConfig";

const DECIDED_STATUSES = [
  "AWARDED",
  "LOST",
];

const PERCENT = 100;

export default function RfqPage() {
  const { user } = useAuth();
  const { rows, error: loadError, load } = useRfq();

  const [params, setParams] = useSearchParams();

  // Search filters in the browser; the Excel-style column filters (including Month) are sent to the server, which also supplies their options.
  const [filters, setFilters] = useState({ search: "" });
  const columnFilters = useRfqFilters();

  const canCreate = RFQ_CREATE_ROLES.includes(user?.role);
  const showCreate = params.get("create") === "1" && canCreate;
  const selectedId = params.get("id");

  useEffect(() => {
    load({ params: columnFilters.params }).catch(() => {});
  }, [load, columnFilters.params]);

  // Reload with the active filters (a plain load() would drop them) and refresh the dropdown values.
  const { reloadOptions } = columnFilters;
  const reload = useCallback(() => {
    reloadOptions();
    return load({ params: columnFilters.params }, { force: true }).catch(() => {});
  }, [load, columnFilters.params, reloadOptions]);

  /**
   * Filter RFQs.
   *
   * This is now the single source of truth for:
   * - KPI
   * - Register
   */
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const haystack = `
        ${r.rfq_number}
        ${r.customer}
        ${r.project_name}
        ${(r.main_parts || [])
          .map((p) => p.main_part_no)
          .join(" ")}
      `.toLowerCase();

      return (
        haystack.includes(filters.search.toLowerCase())
      );
    });
  }, [rows, filters]);

  /**
   * KPI calculations are based on filteredRows.
   */
  const stats = useMemo(() => {
    const quoted = filteredRows.reduce(
      (sum, r) =>
        sum + Number(r.total_quoted_value || 0),
      0
    );

    const quotedCount = filteredRows.filter(
      (r) =>
        Number(r.total_quoted_value || 0) > 0
    ).length;

    const awarded = filteredRows.filter(
      (r) => Number(r.total_awarded_value || 0) > 0
    );

    const decided = filteredRows.filter(
      (r) => DECIDED_STATUSES.includes(r.rfq_status)
    );

    return {
      total: filteredRows.length,

      active: filteredRows.filter(
        (r) => Number(r.workflow_count || 0) > 0 && !["AWARDED", "LOST"].includes(r.rfq_status)
      ).length,

      awarded: awarded.length,

      completed: filteredRows.filter(
        (r) => r.workflow_count > 0 && r.current_stage === "COMPLETED"
      ).length,

      quoted,

      awardedValue: awarded.reduce(
        (sum, r) =>
          sum + Number(r.total_awarded_value || 0),
        0
      ),

      avgQuote: quotedCount
        ? quoted / quotedCount
        : 0,

      decisionRate: decided.length
        ? (awarded.length / decided.length) * PERCENT
        : 0,
    };
  }, [filteredRows]);

  const backToRegister = () => {
    setParams({});
  };

  const openRfq = (id) => {
    setParams({ id });
  };

  if (showCreate) {
    return (
      <RfqCreatePage
        onClose={backToRegister}
        onCreated={(id) => {
          reload();
          openRfq(id);
        }}
      />
    );
  }

  if (selectedId) {
    return (
      <RfqDetailPage
        rfqId={selectedId}
        user={user}
        onClose={backToRegister}
        onChanged={reload}
      />
    );
  }

  return (
    <div className="space-y-3 bg-slate-50">
      <PageHeader
        eyebrow="NPD Department"
        title="RFQ & NPD"
        subtitle="Pipeline visibility, costing value, stage performance and customer decision tracking."
        actions={
          canCreate && (
            <AddButton
              onClick={() => setParams({ create: "1" })}
            >
              New RFQ
            </AddButton>
          )
        }
      />

      {loadError && <Alert>{loadError}</Alert>}

      {/* KPI */}
      <div className="grid grid-cols-2 xl:grid-cols-8 gap-2">
        <KpiCard
          label="Total RFQs"
          value={stats.total}
          hint="Filtered pipeline"
          tone="blue"
          icon={BarChart3}
        />

        <KpiCard
          label="Active / Pending"
          value={stats.active}
          hint="Filtered open pipeline"
          tone="amber"
          icon={Activity}
        />

        <KpiCard
          label="Awarded"
          value={stats.awarded}
          hint="Filtered awarded RFQs"
          tone="green"
          icon={Target}
        />

        <KpiCard
          label="Completed"
          value={stats.completed}
          hint="Filtered lifecycle complete"
          tone="blue"
        />

        <KpiCard
          label="Quoted Value"
          value={formatMoney(stats.quoted)}
          hint="Filtered RFQs with costing"
          tone="green"
          icon={IndianRupee}
        />

        <KpiCard
          label="Awarded Value"
          value={formatMoney(stats.awardedValue)}
          hint="Filtered awarded value"
          tone="green"
        />

        <KpiCard
          label="Avg Quote"
          value={formatMoney(stats.avgQuote)}
          hint="Filtered average"
          tone="blue"
        />

        <KpiCard
          label="Decision Rate"
          value={`${stats.decisionRate.toFixed(1)}%`}
          hint="Awarded / decided"
          tone="amber"
        />
      </div>

      <RfqRegister
        rows={filteredRows}
        options={columnFilters.options}
        columnFilters={columnFilters.filters}
        hasColumnFilters={columnFilters.hasFilters}
        onColumnFilterChange={columnFilters.setColumn}
        onResetColumnFilters={columnFilters.reset}
        onSelect={openRfq}
        filters={filters}
        onFiltersChange={setFilters}
      />
    </div>
  );
}