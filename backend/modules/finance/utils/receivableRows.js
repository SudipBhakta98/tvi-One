import Collection from "../models/collectionModel.js";
import { round2 } from "./receivableFinancials.js";

// Customers are expected to pay within this many days of the invoice date.
const PAYMENT_TERM_DAYS = 45;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const formatDate = (dateObj) => {
  const d = new Date(dateObj);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${d.getFullYear()}`;
};

/**
 * Turns receivable invoices into register rows with their approved collections applied:
 * collectedAmount (cash), tdsAmount, outstanding, status and due days.
 * Used by both the register (analytics) and the search endpoint.
 */
export const buildReceivableRows = async (invoiceRecords) => {
  if (invoiceRecords.length === 0) return [];

  const approvedCollections = await Collection.find(
    {
      $or: invoiceRecords.map(({ invoiceNumber, grnNumber }) => ({ invoiceNumber, grnNumber })),
      status: "Approved",
    },
    { invoiceNumber: 1, grnNumber: 1, receivedAmount: 1, tdsAmount: 1, _id: 0 },
  ).lean();

  // Composite key: invoiceNumber + grnNumber
  const collectedMap = new Map();
  for (const c of approvedCollections) {
    const key = `${c.invoiceNumber}_${c.grnNumber}`;
    const current = collectedMap.get(key) || { received: 0, tds: 0 };
    collectedMap.set(key, {
      received: current.received + (c.receivedAmount || 0),
      tds: current.tds + (c.tdsAmount || 0),
    });
  }

  const nowTime = Date.now();

  return invoiceRecords.map((invoice) => {
    const { received = 0, tds = 0 } = collectedMap.get(`${invoice.invoiceNumber}_${invoice.grnNumber}`) || {};
    const collectedAmount = round2(received);
    const tdsAmount = round2(tds);
    const settledAmount = round2(collectedAmount + tdsAmount);
    const outstanding = Math.max(0, round2(invoice.totalAmount - settledAmount));

    let status = "uncollected";
    if (settledAmount >= invoice.totalAmount && invoice.totalAmount > 0) status = "collected";
    else if (settledAmount > 0) status = "partial";

    const elapsedDays = Math.floor((nowTime - new Date(invoice.invoiceDate).getTime()) / MS_PER_DAY);
    const dueDays = PAYMENT_TERM_DAYS - elapsedDays;

    return {
      _id: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      grnNumber: invoice.grnNumber,
      customerName: invoice.customerName,
      invoiceDate: formatDate(invoice.invoiceDate),
      subTotal: invoice.subTotal,
      gstAmount: invoice.gstAmount,
      totalAmount: invoice.totalAmount,
      collectedAmount,
      tdsAmount,
      settledAmount,
      outstanding,
      status,
      dueDays,
      isOverdue: dueDays < 0 && outstanding > 0,
    };
  });
};
