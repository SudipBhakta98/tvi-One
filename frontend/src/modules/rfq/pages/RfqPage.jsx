import { useEffect, useMemo, useState } from "react";
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
import { formatMoney } from "../components/rfqConfig";

const OPEN_STATUSES = [
  "ACTIVE",
  "WAITING_FOR_APPROVAL",
  "ON_HOLD",
];

const DECIDED_STATUSES = [
  "AWARDED",
  "LOST",
];

const PERCENT = 100;

export default function RfqPage() {
  const { user } = useAuth();
  const { rows, error: loadError, load } = useRfq();

  const [params, setParams] = useSearchParams();

  const [filters, setFilters] = useState({
    search: "",
    month: "",
    customer: "",
    projectLead: "",
    status: "",
    stage: "",
  });

  const showCreate = params.get("create") === "1";
  const selectedId = params.get("id");

  useEffect(() => {
    load();
  }, [load]);

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

      const d = r.rfq_dated
        ? new Date(r.rfq_dated)
        : null;

      return (
        haystack.includes(filters.search.toLowerCase())

        && (
          !filters.month ||
          (
            d &&
            d.getMonth() === Number(filters.month)
          )
        )

        && (
          !filters.customer ||
          r.customer === filters.customer
        )

        && (
          !filters.projectLead ||
          r.project_lead === filters.projectLead
        )

        && (
          !filters.status ||
          r.rfq_status === filters.status
        )

        && (
          !filters.stage ||
          r.current_stage === filters.stage
        )
      );
    });
  }, [rows, filters]);

  /**
   * KPI calculations are based on filteredRows.
   */
  const stats = useMemo(() => {
    const quoted = filteredRows.reduce(
      (sum, r) =>
        sum + Number(r.costing?.quoted_price || 0),
      0
    );

    const quotedCount = filteredRows.filter(
      (r) =>
        Number(r.costing?.quoted_price || 0) > 0
    ).length;

    const awarded = filteredRows.filter(
      (r) => r.rfq_status === "AWARDED"
    );

    const decided = filteredRows.filter(
      (r) => DECIDED_STATUSES.includes(r.rfq_status)
    );

    return {
      total: filteredRows.length,

      active: filteredRows.filter(
        (r) => OPEN_STATUSES.includes(r.rfq_status)
      ).length,

      awarded: awarded.length,

      completed: filteredRows.filter(
        (r) => r.current_stage === "COMPLETED"
      ).length,

      quoted,

      awardedValue: awarded.reduce(
        (sum, r) =>
          sum + Number(r.costing?.quoted_price || 0),
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
        defaultProjectLead={user?.name || ""}
        onClose={backToRegister}
        onCreated={(id) => {
          load();
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
        onChanged={load}
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
          <AddButton
            onClick={() => setParams({ create: "1" })}
          >
            New RFQ
          </AddButton>
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
        rows={rows}
        onSelect={openRfq}
        filters={filters}
        onFiltersChange={setFilters}
      />
    </div>
  );
}