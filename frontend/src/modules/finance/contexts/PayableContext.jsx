import React, { createContext, useContext, useState } from "react";

// Shared state for the Payables screens:
//   analyticsData : invoices shown in the Payable Register
//   detailsData   : payments / debit notes of the invoice currently open in PayablesInvoiceDialog

const PayablesContext = createContext(null);

const EMPTY_DETAILS = {
  payments: [],
  debits: [],
  totalPaidAmount: 0,
  totalPendingPaymentAmount: 0,
  totalDebitAmount: 0,
};

const sumPaymentsWithStatus = (payments, status) =>
  payments
    .filter((payment) => String(payment.status || "").toLowerCase() === status)
    .reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0);

export const PayablesProvider = ({ children }) => {
  const [analyticsData, setAnalyticsData] = useState({ data: [], availablePeriods: [], selectedPeriods: [] });
  const [detailsData, setDetailsData] = useState(EMPTY_DETAILS);

  const storeAnalytics = (responseData) =>
    setAnalyticsData({
      data: responseData?.data || [],
      availablePeriods: responseData?.availablePeriods || [],
      selectedPeriods: responseData?.selectedPeriods || [],
    });

  // Approved payments are settled; Pending ones are reserved but not settled yet.
  const storeDetails = (responseData) => {
    const payments = responseData?.data?.payments || [];
    const debits = responseData?.data?.debits || [];

    setDetailsData({
      payments,
      debits,
      totalPaidAmount: sumPaymentsWithStatus(payments, "approved"),
      totalPendingPaymentAmount: sumPaymentsWithStatus(payments, "pending"),
      totalDebitAmount: debits.reduce((sum, debit) => sum + Number(debit.debitAmount || 0), 0),
    });
  };

  // Remove a deleted invoice from the register straight away (no reload needed).
  const removeInvoice = (targetId) => {
    if (!targetId) return;
    setAnalyticsData((prev) => ({ ...prev, data: prev.data.filter((item) => (item._id || item.id) !== targetId) }));
    setDetailsData(EMPTY_DETAILS);
  };

  return (
    <PayablesContext.Provider value={{ analyticsData, detailsData, storeAnalytics, storeDetails, removeInvoice }}>
      {children}
    </PayablesContext.Provider>
  );
};

export const usePayables = () => {
  const context = useContext(PayablesContext);
  if (!context) throw new Error("usePayables must be used within a PayablesProvider");
  return context;
};
