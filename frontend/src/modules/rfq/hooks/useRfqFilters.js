import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";

// Must match MULTI_VALUE_SEPARATOR in rfqController.js.
const MULTI_VALUE_SEPARATOR = "|";

export const FILTER_COLUMNS = [
  { key: "month", title: "Month" },
  { key: "customer", title: "Customer" },
  { key: "project_name", title: "Project" },
  { key: "project_owner", title: "Project Owner" },
  { key: "current_stage", title: "Current Stage" },
  { key: "rfq_status", title: "Status" },
];
const EMPTY_FILTERS = Object.fromEntries(FILTER_COLUMNS.map(({ key }) => [key, []]));

// Option lists come from the server; `params` is ready to pass straight to GET /rfq.
export default function useRfqFilters() {
  const [options, setOptions] = useState({});
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const reloadOptions = useCallback(() => api.get(ENDPOINTS.RFQ.FILTER_OPTIONS).then((response) => setOptions(response.data)).catch(() => {}), []);
  useEffect(() => { reloadOptions(); }, [reloadOptions]);

  const params = useMemo(() => Object.fromEntries(
    Object.entries(filters).filter(([, values]) => values.length).map(([key, values]) => [key, values.join(MULTI_VALUE_SEPARATOR)]),
  ), [filters]);

  return {
    options,
    reloadOptions,
    filters,
    params,
    hasFilters: Object.keys(params).length > 0,
    setColumn: (key, values) => setFilters((previous) => ({ ...previous, [key]: values })),
    reset: () => setFilters(EMPTY_FILTERS),
  };
}
