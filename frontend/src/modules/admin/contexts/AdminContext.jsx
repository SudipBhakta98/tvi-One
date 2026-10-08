import { createContext, useCallback, useContext, useMemo, useState } from "react";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";

const AdminCtx = createContext(null);

export function AdminProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [u, s, l] = await Promise.all([
        api.get(ENDPOINTS.ADMIN.USERS),
        api.get(ENDPOINTS.ADMIN.SESSIONS),
        api.get(ENDPOINTS.ADMIN.LOGS)
      ]);
      setUsers(u.data.data || []);
      setSessions(s.data.data || []);
      setLogs(l.data.data || []);
    } catch (e) {
      setError(e.response?.data?.message || "Unable to load administration data");
    } finally { setLoading(false); }
  }, []);

  const createUser = useCallback(async (payload) => { await api.post(ENDPOINTS.ADMIN.USERS, payload); await load(); }, [load]);
  const updateUser = useCallback(async (id, payload) => { await api.patch(`${ENDPOINTS.ADMIN.USERS}/${id}`, payload); await load(); }, [load]);

  const value = useMemo(() => ({ users, sessions, logs, loading, error, load, createUser, updateUser }),
    [users, sessions, logs, loading, error, load, createUser, updateUser]);

  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error("useAdmin must be used within an AdminProvider");
  return ctx;
}
