import { Modal } from "../../../components/ui";
import { AttachmentList } from "./AttachmentField";
import { BOM_STAGE, PURCHASE_ITEM_STAGES, attachmentLabel, formatDate, formatMoney, stageLabel } from "./rfqConfig";

const Section = ({ title, children }) => <div><h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-600">{title}</h4>{children}</div>;
const Fact = ({ label, value }) => <div className="rounded-md bg-slate-50 px-2.5 py-1.5"><div className="text-xs font-semibold uppercase text-slate-600">{label}</div><div className="text-xs font-semibold text-slate-800">{value || "—"}</div></div>;
const MiniTable = ({ columns, rows }) => <div className="overflow-x-auto rounded-md border border-slate-200">
  <table className="w-full text-xs">
    <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600"><tr>{columns.map((column) => <th key={column} className="px-3 py-1.5">{column}</th>)}</tr></thead>
    <tbody className="divide-y divide-slate-100">{rows.map((cells, i) => <tr key={i}>{cells.map((cell, j) => <td key={j} className="px-3 py-1.5 text-slate-700">{cell ?? "—"}</td>)}</tr>)}</tbody>
  </table>
</div>;

/** Read-only view of everything captured when a stage was completed. */
export default function StageDetailsDialog({ stage, rfq, entry, components, onClose }) {
  const history = rfq.stage_history?.find((event) => event.stage === stage);
  const attachments = rfq.stage_attachments?.[stage] || [];
  const purchaseItems = (rfq.purchase_items || []).filter((item) => item.stage === stage);
  const bomLines = components.filter((component) => component.bom_stage === BOM_STAGE);
  const po = rfq.purchase_order;

  return <Modal open onClose={onClose} title={stageLabel(stage)} subtitle={`${rfq.rfq_number} · ${rfq.project_name}`} size="xl">
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Fact label="Target Date" value={entry?.target_date ? formatDate(entry.target_date) : "Customer driven"} />
        <Fact label="Submit Date" value={formatDate(entry?.completed_date)} />
        <Fact label="Submitted By" value={history?.user?.name} />
        {stage === "COSTING" && <Fact label="Quoted Value" value={formatMoney(rfq.costing?.quoted_price)} />}
        {stage === "CUSTOMER_DECISION" && <Fact label="Decision" value={rfq.customer_decision?.decision} />}
      </div>

      <Section title="Remarks"><p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">{history?.note || "No remarks."}</p></Section>
      <Section title={attachmentLabel(stage)}><AttachmentList items={attachments} /></Section>

      {PURCHASE_ITEM_STAGES.has(stage) && <Section title="Purchase Items">
        {purchaseItems.length ? <MiniTable columns={["Item", "Qty", "Remarks"]} rows={purchaseItems.map((item) => [item.item_name, item.quantity, item.remarks])} /> : <p className="text-xs text-slate-600">No purchase items added.</p>}
      </Section>}

      {stage === "CUSTOMER_PO_RECEIVED" && po && <Section title="Customer PO">
        <div className="mb-2 grid grid-cols-2 gap-2"><Fact label="PO Number" value={po.po_number} /><Fact label="PO Quantity" value={po.po_qty} /></div>
        <MiniTable columns={["Delivery Date", "Quantity"]} rows={(po.delivery_schedule || []).map((row) => [formatDate(row.date), row.quantity])} />
      </Section>}

      {stage === "ACTUAL_BOM" && <Section title="Actual BOM">
        {bomLines.length ? <MiniTable columns={["Component", "Description", "Per Unit", "Total"]} rows={bomLines.map((line) => [line.component_name, line.component_description, line.per_unit_qty, line.total_qty])} /> : <p className="text-xs text-slate-600">No BOM components.</p>}
      </Section>}
    </div>
  </Modal>;
}
