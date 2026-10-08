import React, { createContext, useContext, useState } from "react";

const ReceivablesContext = createContext(null);

const EMPTY_PAGINATION = { currentPage: 1, limit: 10, totalPages: 0, totalItems: 0 };
const EMPTY_DETAILS = { collections: [], totalCollectedAmount: 0, totalTdsAmount: 0, totalPendingAmount: 0 };
const EMPTY_SEARCH_STATE = { search: "", page: 1, limit: 10, loading: false, error: null };

const sumBy = (items, status, pick) =>
  items
    .filter((item) => String(item.status || "").toLowerCase() === status)
    .reduce((sum, item) => sum + pick(item), 0);

export const ReceivablesProvider = ({ children }) => {
  const [analyticsData, setAnalyticsData] = useState({ data: [], availablePeriods: [], selectedPeriods: [] });
  const [searchResults, setSearchResults] = useState({ searchReceivables: [], pagination: EMPTY_PAGINATION });
  const [searchState, setSearchState] = useState(EMPTY_SEARCH_STATE);
  const [detailsData, setDetailsData] = useState(EMPTY_DETAILS);

  const storeAnalytics = (responseData) =>
    setAnalyticsData({
      data: responseData?.data || [],
      availablePeriods: responseData?.availablePeriods || [],
      selectedPeriods: responseData?.selectedPeriods || [],
    });

  const storeSearchResults = (responseData) =>
    setSearchResults({
      searchReceivables: responseData?.searchReceivables || [],
      pagination: responseData?.pagination || EMPTY_PAGINATION,
    });

  const updateSearchState = (updates) => setSearchState((prev) => ({ ...prev, ...updates }));

  const clearSearch = () => {
    setSearchState(EMPTY_SEARCH_STATE);
    setSearchResults({ searchReceivables: [], pagination: EMPTY_PAGINATION });
  };

  const removeInvoice = (targetId) => {
    if (!targetId) return;
    const keep = (item) => (item._id || item.id) !== targetId;

    setSearchResults((prev) => ({
      ...prev,
      searchReceivables: prev.searchReceivables.filter(keep),
      pagination: { ...prev.pagination, totalItems: Math.max(0, prev.pagination.totalItems - 1) },
    }));
    setAnalyticsData((prev) => ({ ...prev, data: prev.data.filter(keep) }));
    setDetailsData(EMPTY_DETAILS);
  };

  // Approved collections are settled; Pending ones are reserved but not settled yet.
  const storeDetails = (responseData) => {
    const collections = responseData?.data?.collections || [];
    const received = (c) => Number(c.receivedAmount || 0);
    const tds = (c) => Number(c.tdsAmount || 0);

    setDetailsData({
      collections,
      totalCollectedAmount: sumBy(collections, "approved", received),
      totalTdsAmount: sumBy(collections, "approved", tds),
      totalPendingAmount: sumBy(collections, "pending", (c) => received(c) + tds(c)),
    });
  };

  return (
    <ReceivablesContext.Provider
      value={{
        analyticsData,
        searchResults,
        detailsData,
        searchState,
        updateSearchState,
        storeAnalytics,
        storeSearchResults,
        storeDetails,
        clearSearch,
        removeInvoice,
      }}
    >
      {children}
    </ReceivablesContext.Provider>
  );
};

export const useReceivables = () => {
  const context = useContext(ReceivablesContext);
  if (!context) throw new Error("useReceivables must be used within a ReceivablesProvider");
  return context;
};
