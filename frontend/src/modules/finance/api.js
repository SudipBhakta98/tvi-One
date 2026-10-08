import api from "../../services/api";
import { ENDPOINTS } from "../../services/endpoints";

// ---------------------------------------------------------------------------
// Finance module API client.
//
// This file is the ONLY thing that changed from the original finance
// application's `client/src/api.js`. The original created its own axios
// instance with a hardcoded server IP and no auth handling:
//
//   axios.create({ baseURL: "http://100.64.13.19:5000/api/" })
//
// Here it reuses TVI One's shared, authenticated `api` instance (auto
// attaches the bearer token, auto-redirects on 401, single base URL driven
// by VITE_API_URL) and points at the `/finance/*` routes mounted in
// backend/server.js. Every exported object/method name below is identical
// to the original (payablesApi, paymentApi, debitApi, creditApi and all
// their methods), so none of the finance pages/components/contexts needed
// to change — only this network-wiring file did.
// ---------------------------------------------------------------------------

const PAYABLE = ENDPOINTS.FINANCE.PAYABLE;
const PAYMENT = ENDPOINTS.FINANCE.PAYMENT;
const DEBIT = ENDPOINTS.FINANCE.DEBIT;
const CREDIT = ENDPOINTS.FINANCE.CREDIT;
const RECEIVABLE = ENDPOINTS.FINANCE.RECEIVABLE;
const COLLECTION = ENDPOINTS.FINANCE.COLLECTION;

export const payablesApi = {
  getAnalytics: (selectedPeriods = []) => {
    const params = {};
    if (selectedPeriods.length > 0) {
      params.period = JSON.stringify(selectedPeriods);
    }
    return api.get(`${PAYABLE}/getPayablesAnalytics`, { params });
  },

  search: ({ search, page = 1, limit = 10 }) => {
    return api.get(`${PAYABLE}/getSearchPayable`, {
      params: { search, page, limit },
    });
  },

  getDetails: (invoiceNumber, grnNumber) => {
    return api.get(`${PAYABLE}/getPayableDetails`, {
      params: { invoiceNumber, grnNumber },
    });
  },

  create: (payload) => {
    return api.post(`${PAYABLE}/createPayable`, payload);
  },

  update: (id, updateData) => {
    return api.put(`${PAYABLE}/updatePayable/${id}`, updateData);
  },

  delete: (id) => {
    return api.delete(`${PAYABLE}/deletePayable/${id}`);
  },
};

export const supplierAdvanceApi = {
  list: () => api.get(`${PAYMENT}/getSupplierAdvances`),
  details: (id) => api.get(`${PAYMENT}/getSupplierAdvanceDetails/${id}`),
  balance: (supplierName, excludePaymentId) =>
    api.get(`${PAYMENT}/getSupplierAdvanceBalance`, {
      params: { supplierName, ...(excludePaymentId ? { excludePaymentId } : {}) },
    }),
  create: (payload) => api.post(`${PAYMENT}/createSupplierAdvance`, payload),
  updateStatus: (id, status) => api.patch(`${PAYMENT}/updateSupplierAdvanceStatus/${id}`, { status }),
};

export const paymentApi = {
  getSupplierAdvances: () => api.get(`${PAYMENT}/getSupplierAdvances`),
  getSupplierAdvanceBalance: (supplierName, excludePaymentId) =>
    api.get(`${PAYMENT}/getSupplierAdvanceBalance`, {
      params: { supplierName, ...(excludePaymentId ? { excludePaymentId } : {}) },
    }),
  createSupplierAdvance: (payload) => api.post(`${PAYMENT}/createSupplierAdvance`, payload),
  updateSupplierAdvanceStatus: (id, status) => api.patch(`${PAYMENT}/updateSupplierAdvanceStatus/${id}`, { status }),
  getPayments: (selectedPeriods = []) => {
    const params = {};
    if (selectedPeriods.length > 0) {
      params.period = JSON.stringify(selectedPeriods);
    }
    return api.get(`${PAYMENT}/getPayments`, { params });
  },

  getPendingPayments: () => {
    return api.get(`${PAYMENT}/getPendingPayments`);
  },

  searchPayment: ({ search, page = 1, limit = 10 }) => {
    return api.get(`${PAYMENT}/searchPayment`, {
      params: { search, page, limit },
    });
  },

  createSinglePayment: (payload) => {
    return api.post(`${PAYMENT}/createSinglePayment`, payload);
  },

  updatePayment: (paymentId, updateData) => {
    return api.put(`${PAYMENT}/updatePayment/${paymentId}`, updateData);
  },

  updatePaymentStatus: (paymentId, { status, remarks }) => {
    return api.patch(`${PAYMENT}/updatePaymentStatus/${paymentId}`, {
      status,
      remarks,
    });
  },

  deletePayment: (paymentId) => {
    return api.delete(`${PAYMENT}/deletePayment/${paymentId}`);
  },
};

export const debitApi = {
  createDebit: (payload) => {
    return api.post(`${DEBIT}/createDebit`, payload);
  },

  updateDebit: (debitId, updateData) => {
    return api.put(`${DEBIT}/editDebit/${debitId}`, updateData);
  },

  deleteDebit: (debitId) => {
    return api.delete(`${DEBIT}/deleteDebit/${debitId}`);
  },
};

export const creditApi = {
  getCreditNotes: () => {
    return api.get(`${CREDIT}/getCreditNotes`);
  },

  createCredit: (payload) => {
    return api.post(`${CREDIT}/createCredit`, payload);
  },

  updateCredit: (creditNoteNumber, updateData) => {
    return api.put(`${CREDIT}/updateCredit/${creditNoteNumber}`, updateData);
  },

  deleteCredit: (creditNoteNumber) => {
    return api.delete(`${CREDIT}/deleteCredit/${creditNoteNumber}`);
  },

  creditDetails: (creditNoteNumber) => {
    return api.get(`${CREDIT}/getCreditDetails/${creditNoteNumber}`);
  },

  pendingAndPartialCredits: () => {
    return api.get(`${CREDIT}/getPendingAndPartialCredits`);
  },
};

export const receivablesApi = {
  getAnalytics: (selectedPeriods = []) => {
    const params = {};
    if (selectedPeriods.length > 0) {
      params.period = JSON.stringify(selectedPeriods);
    }
    return api.get(`${RECEIVABLE}/getReceivablesAnalytics`, { params });
  },

  search: ({ search, page = 1, limit = 10 }) =>
    api.get(`${RECEIVABLE}/getSearchReceivable`, { params: { search, page, limit } }),

  getDetails: (invoiceNumber, grnNumber) =>
    api.get(`${RECEIVABLE}/getReceivableDetails`, { params: { invoiceNumber, grnNumber } }),

  create: (payload) => api.post(`${RECEIVABLE}/createReceivable`, payload),

  update: (id, updateData) => api.put(`${RECEIVABLE}/updateReceivable/${id}`, updateData),

  delete: (id) => api.delete(`${RECEIVABLE}/deleteReceivable/${id}`),
};

export const collectionApi = {
  // status: "Pending" | "Approved" | "Rejected"
  getCollections: (status = "Pending") =>
    api.get(`${COLLECTION}/getCollections`, { params: { status } }),

  createCollection: (payload) => api.post(`${COLLECTION}/createCollection`, payload),

  updateCollection: (collectionId, updateData) =>
    api.put(`${COLLECTION}/updateCollection/${collectionId}`, updateData),

  updateCollectionStatus: (collectionId, status) =>
    api.patch(`${COLLECTION}/updateCollectionStatus/${collectionId}`, { status }),

  deleteCollection: (collectionId) => api.delete(`${COLLECTION}/deleteCollection/${collectionId}`),
};
