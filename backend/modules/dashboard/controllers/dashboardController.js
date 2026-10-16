import RfqItem from "../../rfq/models/rfqItemModel.js";
import Project from "../../project/models/projectModel.js";
import PurchaseOrder from "../../purchase/models/purchaseOrderModel.js";
import Production from "../../production/models/productionModel.js";
import Dispatch from "../../dispatch/models/dispatchModel.js";
import GRN from "../../warehouse/models/grnModel.js";
import Component from "../../rfq/models/componentModel.js";
import Stage from "../../production/models/stageModel.js";
import Machine from "../../production/models/machineModel.js";
import Payable from "../../finance/models/payableModel.js";
import Payment from "../../finance/models/paymentModel.js";
import Credit from "../../finance/models/creditModel.js";
import Debit from "../../finance/models/debitModel.js";
import { rfqScope, reportDepartmentsFor } from "../../rfq/services/rfqPermissions.js";
import { buildRfqReport } from "../../rfq/services/rfqReport.js";

const dateRange = (from, to) => {
  if (!from && !to) return null;
  const range = {};
  if (from) {
    const d = new Date(`${from}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) range.$gte = d;
  }
  if (to) {
    const d = new Date(`${to}T23:59:59.999Z`);
    if (!Number.isNaN(d.getTime())) range.$lte = d;
  }
  return Object.keys(range).length ? range : null;
};

const scoped = (field, range) => (range ? { [field]: range } : {});
const sum = (rows, key) => rows.reduce((total, row) => total + Number(row[key] || 0), 0);
const monthLabel = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
};

const getPath = (row, path) => path.split(".").reduce((value, key) => value?.[key], row);
const buildTrend = (rows, dateField, valueField = null) => {
  const map = new Map();
  rows.forEach((row) => {
    const key = monthLabel(getPath(row, dateField));
    if (key === "Unknown") return;
    map.set(key, (map.get(key) || 0) + (valueField ? Number(getPath(row, valueField) || 0) : 1));
  });
  return [...map.entries()].map(([label, value]) => ({ label, value }));
};

const productionGroups = async (match) => {
  const [stageRows, machineRows, byStage, byMachine] = await Promise.all([
    Stage.find({ isActive: true }).select("name code").sort({ name: 1 }).lean(),
    Machine.find({ isActive: true }).select("name code").sort({ name: 1 }).lean(),
    Production.aggregate([
      { $match: match },
      { $group: { _id: "$stage", qty: { $sum: "$finished_qty" }, entries: { $sum: 1 }, runMinutes: { $sum: { $divide: [{ $subtract: ["$end_time", "$start_time"] }, 60000] } } } },
    ]),
    Production.aggregate([
      { $match: match },
      { $group: { _id: "$machine", qty: { $sum: "$finished_qty" }, entries: { $sum: 1 }, runMinutes: { $sum: { $divide: [{ $subtract: ["$end_time", "$start_time"] }, 60000] } } } },
    ]),
  ]);

  const mapRows = (masters, grouped) => {
    const groupedMap = new Map(grouped.filter((x) => x._id).map((x) => [String(x._id), x]));
    return masters.map((m) => {
      const x = groupedMap.get(String(m._id)) || { qty: 0, entries: 0, runMinutes: 0 };
      return {
        id: m._id,
        name: m.name,
        code: m.code,
        qty: Number(x.qty || 0),
        entries: Number(x.entries || 0),
        run_minutes: Math.round(Number(x.runMinutes || 0)),
        pieces_per_hour: x.runMinutes ? Math.round((Number(x.qty || 0) / Number(x.runMinutes)) * 60 * 100) / 100 : 0,
      };
    });
  };
  return { by_stage: mapRows(stageRows, byStage), by_machine: mapRows(machineRows, byMachine) };
};

export const getRfqDashboard = async (req, res) => {
  try {
    const range = dateRange(req.query.from_date, req.query.to_date);
    // NPD users only ever see the RFQs they own, on the dashboards too.
    const match = { ...scoped("rfq_dated", range), ...rfqScope(req.user) };
    if (req.query.rfq_status) match.rfq_status = req.query.rfq_status;
    if (req.query.current_stage) match.current_stage = req.query.current_stage;
    if (req.query.customer) match.customer = req.query.customer;
    if (req.query.project_lead) match.project_lead = req.query.project_lead;
    const [summary, byStage, byStatus, rows, valueTrend] = await Promise.all([
      RfqItem.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: 1 }, awarded: { $sum: { $cond: [{ $eq: ["$rfq_status", "AWARDED"] }, 1, 0] } }, lost: { $sum: { $cond: [{ $eq: ["$rfq_status", "LOST"] }, 1, 0] } }, quoted_value: { $sum: { $ifNull: ["$costing.quoted_price", 0] } }, awarded_value: { $sum: { $cond: [{ $eq: ["$rfq_status", "AWARDED"] }, { $ifNull: ["$costing.quoted_price", 0] }, 0] } }, avg_quote: { $avg: { $cond: [{ $gt: [{ $ifNull: ["$costing.quoted_price", 0] }, 0] }, "$costing.quoted_price", null] } } } }]),
      RfqItem.aggregate([{ $match: match }, { $group: { _id: "$current_stage", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      RfqItem.aggregate([{ $match: match }, { $group: { _id: "$rfq_status", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      RfqItem.find(match).select("rfq_number customer project_lead project_name current_stage rfq_status rfq_dated costing stage_schedule").sort({ rfq_dated: -1 }).limit(50).lean(),
      RfqItem.find(match).select("rfq_dated costing.quoted_price").sort({ rfq_dated: 1 }).lean(),
    ]);
    const total = summary[0] || { total: 0, awarded: 0, lost: 0, quoted_value: 0, awarded_value: 0, avg_quote: 0 };
    const decided = Number(total.awarded || 0) + Number(total.lost || 0);
    const today = new Date();
    const overdue = rows.reduce((count, row) => count + (row.stage_schedule || []).filter((item) => item.target_date && !item.completed_date && new Date(item.target_date) < today).length, 0);
    res.json({
      filters: req.query,
      summary: { total: total.total, awarded: total.awarded, lost: total.lost, quoted_value: total.quoted_value, awarded_value: total.awarded_value, avg_quote: total.avg_quote || 0, decision_rate: decided ? (Number(total.awarded || 0) / decided) * 100 : 0, overdue_targets: overdue, by_stage: Object.fromEntries(byStage.map((x) => [x._id || "UNKNOWN", x.count])), by_status: Object.fromEntries(byStatus.map((x) => [x._id || "UNKNOWN", x.count])) },
      trend: buildTrend(rows, "rfq_dated"),
      value_trend: buildTrend(valueTrend, "rfq_dated", "costing.quoted_price"),
      data: rows,
    });
  } catch (error) { res.status(500).json({ success: false, message: "RFQ dashboard error", error: error.message }); }
};

export const getProjectDashboard = async (req, res) => {
  try {
    const range = dateRange(req.query.from_date, req.query.to_date);
    const projectMatch = scoped("createdAt", range);
    const [projects, poAgg, productionAgg, dispatchAgg, componentAgg] = await Promise.all([
      Project.find(projectMatch).select("project_name customer project_owner status order_qty createdAt").sort({ createdAt: -1 }).limit(100).lean(),
      PurchaseOrder.aggregate([{ $match: { purchase_type: "PRODUCTION" } }, { $group: { _id: "$project", count: { $sum: 1 }, cost: { $sum: { $ifNull: ["$cost", 0] } } } }]),
      Production.aggregate([{ $group: { _id: "$project", qty: { $sum: "$finished_qty" } } }]),
      Dispatch.aggregate([{ $group: { _id: "$project", qty: { $sum: "$dispatched_qty" } } }]),
      Component.aggregate([{ $match: { project: { $ne: null } } }, { $group: { _id: "$project", count: { $sum: 1 } } }]),
    ]);
    const map = (rows) => new Map(rows.map((x) => [String(x._id), x]));
    const poMap = map(poAgg), prodMap = map(productionAgg), dispatchMap = map(dispatchAgg), componentMap = map(componentAgg);
    const data = projects.map((p) => ({
      ...p,
      metrics: {
        produced_qty: prodMap.get(String(p._id))?.qty || 0,
        dispatched_qty: dispatchMap.get(String(p._id))?.qty || 0,
        purchase_orders: poMap.get(String(p._id))?.count || 0,
        purchase_cost: poMap.get(String(p._id))?.cost || 0,
        components: componentMap.get(String(p._id))?.count || 0,
      },
    }));
    res.json({ filters: req.query, summary: { projects: projects.length, order_qty: sum(projects, "order_qty"), produced_qty: sum(data.map((x) => x.metrics), "produced_qty"), dispatched_qty: sum(data.map((x) => x.metrics), "dispatched_qty"), purchase_orders: poAgg.reduce((n, x) => n + x.count, 0), components: componentAgg.reduce((n, x) => n + x.count, 0) }, data });
  } catch (error) { res.status(500).json({ success: false, message: "Project dashboard error", error: error.message }); }
};

export const getProjectOperationalDashboard = async (req, res) => {
  try {
    const id = req.params.projectID;
    const project = await Project.findById(id).lean();
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    const [pos, prod, disp, components] = await Promise.all([
      PurchaseOrder.find({ project: id, purchase_type: "PRODUCTION" }).lean(),
      Production.find({ project: id }).sort({ date: 1 }).lean(),
      Dispatch.find({ project: id }).sort({ date: 1 }).lean(),
      Component.find({ project: id }).lean(),
    ]);
    res.json({ success: true, project, summary: { order_qty: project.order_qty, produced_qty: sum(prod, "finished_qty"), dispatched_qty: sum(disp, "dispatched_qty"), purchase_orders: pos.length, components: components.length }, production: prod, dispatch: disp, purchase_orders: pos, components });
  } catch (error) { res.status(500).json({ success: false, message: "Project dashboard error", error: error.message }); }
};

export const getProductionDashboard = async (req, res) => {
  try {
    const range = dateRange(req.query.from_date, req.query.to_date);
    const match = { ...scoped("date", range) };
    if (req.query.project) match.project = req.query.project;
    if (req.query.stage) match.stage = req.query.stage;
    if (req.query.machine) match.machine = req.query.machine;
    const [summary, qc, groups, trendRows] = await Promise.all([
      Production.aggregate([{ $match: match }, { $group: { _id: null, total_entries: { $sum: 1 }, total_qty: { $sum: "$finished_qty" }, qc_passed_qty: { $sum: { $cond: [{ $eq: ["$qc_status", "PASSED"] }, "$finished_qty", 0] } }, qc_pending: { $sum: { $cond: [{ $eq: ["$qc_status", "PENDING"] }, 1, 0] } }, qc_failed: { $sum: { $cond: [{ $eq: ["$qc_status", "FAILED"] }, 1, 0] } } } }]),
      Production.aggregate([{ $match: match }, { $group: { _id: "$qc_status", qty: { $sum: "$finished_qty" }, entries: { $sum: 1 } } }]),
      productionGroups(match),
      Production.find(match).select("date finished_qty").sort({ date: 1 }).lean(),
    ]);
    res.json({ filters: req.query, summary: summary[0] || { total_entries: 0, total_qty: 0, qc_passed_qty: 0, qc_pending: 0, qc_failed: 0 }, qc: qc.map((x) => ({ status: x._id, qty: x.qty, entries: x.entries })), ...groups, trend: buildTrend(trendRows, "date", "finished_qty") });
  } catch (error) { res.status(500).json({ success: false, message: "Production dashboard error", error: error.message }); }
};

export const getPurchaseDashboard = async (req, res) => {
  try {
    const range = dateRange(req.query.from_date, req.query.to_date);
    const match = scoped("createdAt", range);
    const [summary, byStatus, byType, bySupplier, trendRows] = await Promise.all([
      PurchaseOrder.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: 1 }, quantity: { $sum: "$total_quantity" }, cost: { $sum: { $ifNull: ["$cost", 0] } } } }]),
      PurchaseOrder.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      PurchaseOrder.aggregate([{ $match: match }, { $group: { _id: "$purchase_type", count: { $sum: 1 }, quantity: { $sum: "$total_quantity" }, cost: { $sum: { $ifNull: ["$cost", 0] } } } }, { $sort: { count: -1 } }]),
      PurchaseOrder.aggregate([{ $match: match }, { $group: { _id: "$supplier", count: { $sum: 1 }, cost: { $sum: { $ifNull: ["$cost", 0] } } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
      PurchaseOrder.find(match).select("createdAt cost total_quantity").sort({ createdAt: 1 }).lean(),
    ]);
    res.json({ filters: req.query, summary: summary[0] || { total: 0, quantity: 0, cost: 0 }, by_status: byStatus, by_type: byType, by_supplier: bySupplier, trend: buildTrend(trendRows, "createdAt", "cost") });
  } catch (error) { res.status(500).json({ success: false, message: "Purchase dashboard error", error: error.message }); }
};

export const getWarehouseDashboard = async (req, res) => {
  try {
    const range = dateRange(req.query.from_date, req.query.to_date);
    const match = scoped("received_date", range);
    const [summary, quality, trendRows] = await Promise.all([
      GRN.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: 1 }, received_qty: { $sum: "$received_qty" }, accepted_qty: { $sum: "$accepted_qty" }, rejected_qty: { $sum: "$rejected_qty" } } }]),
      GRN.aggregate([{ $match: match }, { $group: { _id: "$quality_status", count: { $sum: 1 }, qty: { $sum: "$received_qty" } } }, { $sort: { count: -1 } }]),
      GRN.find(match).select("received_date received_qty").sort({ received_date: 1 }).lean(),
    ]);
    res.json({ filters: req.query, summary: summary[0] || { total: 0, received_qty: 0, accepted_qty: 0, rejected_qty: 0 }, quality, trend: buildTrend(trendRows, "received_date", "received_qty") });
  } catch (error) { res.status(500).json({ success: false, message: "Warehouse dashboard error", error: error.message }); }
};

export const getDispatchDashboard = async (req, res) => {
  try {
    const range = dateRange(req.query.from_date, req.query.to_date);
    const match = scoped("date", range);
    const [summary, byProject, trendRows] = await Promise.all([
      Dispatch.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: 1 }, dispatched_qty: { $sum: "$dispatched_qty" } } }]),
      Dispatch.aggregate([{ $match: match }, { $group: { _id: "$project", qty: { $sum: "$dispatched_qty" }, entries: { $sum: 1 } } }, { $sort: { qty: -1 } }, { $limit: 10 }, { $lookup: { from: "projects", localField: "_id", foreignField: "_id", as: "project" } }, { $unwind: { path: "$project", preserveNullAndEmptyArrays: true } }, { $project: { _id: 1, qty: 1, entries: 1, project_name: "$project.project_name", customer: "$project.customer" } }]),
      Dispatch.find(match).select("date dispatched_qty").sort({ date: 1 }).lean(),
    ]);
    res.json({ filters: req.query, summary: summary[0] || { total: 0, dispatched_qty: 0 }, by_project: byProject, trend: buildTrend(trendRows, "date", "dispatched_qty") });
  } catch (error) { res.status(500).json({ success: false, message: "Dispatch dashboard error", error: error.message }); }
};

export const getFinanceDashboard = async (req, res) => {
  try {
    const range = dateRange(req.query.from_date, req.query.to_date);
    const [payable, payments, credits, debits] = await Promise.all([
      Payable.aggregate([{ $match: scoped("invoiceDate", range) }, { $group: { _id: null, invoices: { $sum: 1 }, payable: { $sum: "$payableAmount" }, total: { $sum: "$totalAmount" } } }]),
      Payment.aggregate([{ $match: scoped("paymentDate", range) }, { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$paidAmount" } } }]),
      Credit.aggregate([{ $match: scoped("creditNoteDate", range) }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$creditNoteAmount" }, allocated: { $sum: "$totalAllocatedAmount" }, pending: { $sum: "$pendingAllocationAmount" } } }]),
      Debit.aggregate([{ $match: scoped("createdAt", range) }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$debitAmount" } } }]),
    ]);
    res.json({ filters: req.query, summary: { payable_invoices: payable[0]?.invoices || 0, payable_amount: payable[0]?.payable || 0, payments: payments.reduce((n, x) => n + x.count, 0), approved_payment_amount: payments.find((x) => x._id === "Approved")?.amount || 0, credit_notes: credits[0]?.count || 0, credit_amount: credits[0]?.amount || 0, credit_pending: credits[0]?.pending || 0, debit_notes: debits[0]?.count || 0, debit_amount: debits[0]?.amount || 0 }, payment_status: payments });
  } catch (error) { res.status(500).json({ success: false, message: "Finance dashboard error", error: error.message }); }
};

export const getOverviewDashboard = async (req, res) => {
  try {
    const [rfq, projects, purchase, production, warehouse, dispatch, finance] = await Promise.all([
      getDashboardPayload(getRfqDashboard, req), getDashboardPayload(getProjectDashboard, req), getDashboardPayload(getPurchaseDashboard, req), getDashboardPayload(getProductionDashboard, req), getDashboardPayload(getWarehouseDashboard, req), getDashboardPayload(getDispatchDashboard, req), getDashboardPayload(getFinanceDashboard, req),
    ]);
    res.json({ success: true, filters: req.query, summary: { rfq: rfq.summary?.total || 0, projects: projects.summary?.projects || 0, production_qty: production.summary?.total_qty || 0, purchase_cost: purchase.summary?.cost || 0, received_qty: warehouse.summary?.received_qty || 0, dispatched_qty: dispatch.summary?.dispatched_qty || 0, payable_amount: finance.summary?.payable_amount || 0, pending_qc: production.summary?.qc_pending || 0 }, rfq, projects, purchase, production, warehouse, dispatch, finance, generatedAt: new Date().toISOString() });
  } catch (error) { res.status(500).json({ success: false, message: "Overview dashboard error", error: error.message }); }
};

const getDashboardPayload = (handler, req) => new Promise((resolve, reject) => {
  const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; codeDone(); } };
  const codeDone = () => response.statusCode >= 400 ? reject(new Error(response.body?.message || "Dashboard query failed")) : resolve(response.body);
  Promise.resolve(handler(req, response)).catch(reject);
});

const reportRange = (from, to) => dateRange(from, to);

export const getDepartmentReport = async (req, res) => {
  try {
    const department = String(req.query.department || "all").toLowerCase();
    const range = reportRange(req.query.from_date, req.query.to_date);
    // NPD roles may only report on NPD departments; "all" expands to what the role is allowed to see.
    const allowed = reportDepartmentsFor(req.user.role);
    const requested = department === "all" ? allowed : [department];
    if (requested.some((dept) => !allowed.includes(dept))) return res.status(403).json({ success: false, message: "Your role cannot access this department's report" });
    const reports = {};
    if (requested.includes("rfq")) reports.rfq = await buildRfqReport(req.user, req.query);
    if (requested.includes("purchase")) {
      const rows = await PurchaseOrder.find(scoped("createdAt", range)).select("po_number supplier purchase_type total_quantity cost status createdAt").sort({ createdAt: -1 }).lean();
      reports.purchase = { count: rows.length, quantity: sum(rows, "total_quantity"), cost: sum(rows, "cost"), rows };
    }
    if (requested.includes("production")) {
      const rows = await Production.find(scoped("date", range)).select("date project finished_qty qc_status operator_name stage machine").populate("project", "project_name").populate("stage machine", "name code").sort({ date: -1 }).lean();
      reports.production = { count: rows.length, quantity: sum(rows, "finished_qty"), rows };
    }
    if (requested.includes("warehouse")) {
      const rows = await GRN.find(scoped("received_date", range)).select("received_date purchase_order invoice_number received_qty accepted_qty rejected_qty quality_status").populate("purchase_order", "po_number supplier").sort({ received_date: -1 }).lean();
      reports.warehouse = { count: rows.length, received_qty: sum(rows, "received_qty"), accepted_qty: sum(rows, "accepted_qty"), rejected_qty: sum(rows, "rejected_qty"), rows };
    }
    if (requested.includes("dispatch")) {
      const rows = await Dispatch.find(scoped("date", range)).select("date project dispatched_qty vehicle_number customer_reference").populate("project", "project_name customer").sort({ date: -1 }).lean();
      reports.dispatch = { count: rows.length, dispatched_qty: sum(rows, "dispatched_qty"), rows };
    }
    if (requested.includes("finance")) {
      const [payables, payments, credits, debits] = await Promise.all([
        Payable.find(scoped("invoiceDate", range)).select("invoiceNumber grnNumber supplierName invoiceDate payableAmount totalAmount").sort({ invoiceDate: -1 }).lean(),
        Payment.find(scoped("paymentDate", range)).select("invoiceNumber supplierName paidAmount paymentDate status paymentMethod").sort({ paymentDate: -1 }).lean(),
        Credit.find(scoped("creditNoteDate", range)).select("creditNoteNumber creditNoteAmount totalAllocatedAmount pendingAllocationAmount creditNoteDate status").sort({ creditNoteDate: -1 }).lean(),
        Debit.find(scoped("createdAt", range)).select("invoiceNumber grnNumber debitAmount createdAt description").sort({ createdAt: -1 }).lean(),
      ]);
      reports.finance = { payable_count: payables.length, payable_amount: sum(payables, "payableAmount"), payment_count: payments.length, paid_amount: sum(payments, "paidAmount"), credit_count: credits.length, credit_amount: sum(credits, "creditNoteAmount"), debit_count: debits.length, debit_amount: sum(debits, "debitAmount"), rows: { payables, payments, credits, debits } };
    }
    if (requested.includes("projects")) {
      const rows = await Project.find(scoped("createdAt", range)).select("project_name customer project_owner order_qty status createdAt").sort({ createdAt: -1 }).lean();
      reports.projects = { count: rows.length, order_qty: sum(rows, "order_qty"), rows };
    }
    res.json({ success: true, department, from_date: req.query.from_date || null, to_date: req.query.to_date || null, allowed_departments: allowed, reports });
  } catch (error) { res.status(500).json({ success: false, message: "Report generation failed", error: error.message }); }
};
