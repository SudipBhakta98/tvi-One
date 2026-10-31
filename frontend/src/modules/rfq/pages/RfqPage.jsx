import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  BarChart3,
  IndianRupee,
  PauseCircle,
  Ban,
  CheckCircle2,
  Workflow,
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
import RfqWorkflowDetailPage from "./RfqWorkflowDetailPage";
import useRfqFilters from "../hooks/useRfqFilters";
import { RFQ_CREATE_ROLES, formatMoney } from "../components/rfqConfig";

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
  const selectedWorkflowId = params.get("workflow");

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

  const stats = useMemo(() => ({
    total: filteredRows.length,
    active: filteredRows.filter((r) => r.register_status === "ACTIVE").length,
    pending: filteredRows.filter((r) => (r.register_status || "PENDING") === "PENDING").length,
    hold: filteredRows.filter((r) => r.register_status === "HOLD").length,
    cancel: filteredRows.filter((r) => r.register_status === "CANCEL").length,
    completed: filteredRows.filter((r) => r.register_status === "COMPLETED").length,
    awardedValue: filteredRows.reduce((sum, r) => sum + Number(r.total_awarded_value || 0), 0),
    activeBatch: filteredRows.reduce((sum, r) => sum + Number(r.active_workflow_count || 0), 0),
  }), [filteredRows]);

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

  if (selectedId && selectedWorkflowId) {
    return <RfqWorkflowDetailPage
      rfqId={selectedId}
      workflowId={selectedWorkflowId}
      user={user}
      onClose={() => setParams({ id: selectedId })}
      onChanged={reload}
    />;
  }

  if (selectedId) {
    return (
      <RfqDetailPage
        rfqId={selectedId}
        user={user}
        onClose={backToRegister}
        onOpenWorkflow={(workflowId) => setParams({ id: selectedId, workflow: workflowId })}
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

      {/* RFQ lifecycle KPIs */}
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-8">
        <KpiCard label="Total RFQ" value={stats.total} hint="Filtered RFQ register" tone="blue" icon={BarChart3} />
        <KpiCard label="Active RFQ" value={stats.active} hint="At least one workflow started" tone="green" icon={Activity} />
        <KpiCard label="Pending RFQ" value={stats.pending} hint="No batch workflow started" tone="amber" />
        <KpiCard label="Hold RFQ" value={stats.hold} hint="Manually placed on hold" tone="amber" icon={PauseCircle} />
        <KpiCard label="Cancel RFQ" value={stats.cancel} hint="Cancelled RFQs" tone="red" icon={Ban} />
        <KpiCard label="Completed RFQ" value={stats.completed} hint="Completed RFQs" tone="blue" icon={CheckCircle2} />
        <KpiCard label="Awarded Value" value={formatMoney(stats.awardedValue)} hint="Awarded batch workflow value" tone="green" icon={IndianRupee} />
        <KpiCard label="Active Batch Workflow" value={stats.activeBatch} hint="Currently in progress" tone="blue" icon={Workflow} />
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