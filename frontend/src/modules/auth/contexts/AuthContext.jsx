import { createContext, useContext, useMemo, useState, useCallback } from "react";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";

const AuthContext = createContext(null);

const readStoredUser = () => {
  try { return JSON.parse(localStorage.getItem("tviOneUser") || "null"); }
  catch { return null; }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  const login = useCallback((nextUser, token) => {
    localStorage.setItem("tviOneUser", JSON.stringify(nextUser));
    if (token) localStorage.setItem("tviOneToken", token);
    setUser(nextUser);
  }, []);

  const logout = useCallback(async () => {
    try { await api.post(ENDPOINTS.AUTH.LOGOUT); } catch { /* ignore — clear local session regardless */ }
    localStorage.clear();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
