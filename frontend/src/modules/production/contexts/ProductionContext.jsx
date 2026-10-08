import { createContext, useCallback, useContext, useMemo, useState } from "react";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";

const ProductionContext = createContext(null);

export function ProductionProvider({ children }) {
  const [rows, setRows] = useState([]), [stages, setStages] = useState([]), [machines, setMachines] = useState([]), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const [entries, stageRows, machineRows] = await Promise.all([api.get(ENDPOINTS.PRODUCTION.BASE), api.get(ENDPOINTS.PRODUCTION.STAGES), api.get(ENDPOINTS.PRODUCTION.MACHINES)]); setRows(entries.data || []); setStages(stageRows.data || []); setMachines(machineRows.data || []); }
    catch (e) { setError(e.response?.data?.error || "Unable to load production"); } finally { setLoading(false); }
  }, []);
  const addEntry = useCallback(async (payload) => { await api.post(ENDPOINTS.PRODUCTION.BASE, payload); await load(); }, [load]);
  const setQc = useCallback(async (id, qc_status) => { await api.patch(`${ENDPOINTS.PRODUCTION.BASE}/${id}/qc`, { qc_status }); await load(); }, [load]);
  const createStage = useCallback(async (payload) => { await api.post(ENDPOINTS.PRODUCTION.STAGES, payload); await load(); }, [load]);
  const createMachine = useCallback(async (name) => { await api.post(ENDPOINTS.PRODUCTION.MACHINES, { name }); await load(); }, [load]);
  const value = useMemo(() => ({ rows, stages, machines, loading, error, setError, load, addEntry, setQc, createStage, createMachine }), [rows, stages, machines, loading, error, load, addEntry, setQc, createStage, createMachine]);
  return <ProductionContext.Provider value={value}>{children}</ProductionContext.Provider>;
}
export const useProduction = () => { const ctx = useContext(ProductionContext); if (!ctx) throw new Error("useProduction must be used within ProductionProvider"); return ctx; };
