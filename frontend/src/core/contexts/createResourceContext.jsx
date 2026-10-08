import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import api from "../../services/api";

const unwrap = (payload) => payload?.data ?? payload?.rfqItem ?? payload?.purchaseOrder ?? payload?.production ?? payload?.grn ?? payload?.dispatch ?? payload?.project ?? payload;
const identity = (row) => row?._id || row?.id;

export function createResourceContext({ displayName, baseEndpoint, cacheMs = 15000 }) {
  const Ctx = createContext(null);
  function Provider({ children }) {
    const [rows, setRows] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
    const cacheRef = useRef({ at: 0, key: "" });
    const load = useCallback(async (config = {}, options = {}) => {
      const key = JSON.stringify(config?.params || {});
      if (!options.force && cacheRef.current.key === key && Date.now() - cacheRef.current.at < cacheMs) return;
      setLoading(true); setError("");
      try { const res = await api.get(baseEndpoint, config); const next = res.data?.data ?? res.data ?? []; setRows(Array.isArray(next) ? next : []); cacheRef.current = { at: Date.now(), key }; return next; }
      catch (e) { setError(e.response?.data?.message || e.response?.data?.error || `Unable to load ${displayName}`); throw e; }
      finally { setLoading(false); }
    }, [cacheMs, displayName]);
    const create = useCallback(async (payload) => { const res = await api.post(baseEndpoint, payload); const item=unwrap(res.data); if (item && identity(item)) setRows((current)=>[item,...current]); cacheRef.current.at=Date.now(); return res.data; }, [baseEndpoint]);
    const update = useCallback(async (id, payload, method = "put") => { const res=await api[method](`${baseEndpoint}/${id}`,payload); const item=unwrap(res.data); if(item&&identity(item)) setRows(current=>current.map(row=>String(identity(row))===String(id)?item:row)); else cacheRef.current.at=0; return res.data; }, [baseEndpoint]);
    const remove = useCallback(async (id) => { await api.delete(`${baseEndpoint}/${id}`); setRows(current=>current.filter(row=>String(identity(row))!==String(id))); cacheRef.current.at=Date.now(); }, [baseEndpoint]);
    const value=useMemo(()=>({rows,setRows,loading,error,setError,load,create,update,remove,invalidate:()=>{cacheRef.current.at=0;}}),[rows,loading,error,load,create,update,remove]);
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }
  function useResource(){const ctx=useContext(Ctx);if(!ctx)throw new Error(`use${displayName} must be used within its ${displayName}Provider`);return ctx;}
  return {Provider,useResource,Ctx};
}
