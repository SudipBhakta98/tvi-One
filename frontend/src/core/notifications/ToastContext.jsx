import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from "lucide-react";

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const remove = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const push = useCallback((message, type = "info", duration = 4500) => {
    if (!message) return;
    const id = nextId++;
    setToasts((current) => [...current.slice(-3), { id, message: String(message), type }]);
    window.setTimeout(() => remove(id), duration);
  }, [remove]);

  useEffect(() => {
    const onToast = (event) => push(event.detail?.message, event.detail?.type || "info", event.detail?.duration);
    window.addEventListener("tvi:toast", onToast);
    return () => window.removeEventListener("tvi:toast", onToast);
  }, [push]);

  const value = useMemo(() => ({ push, success: (m) => push(m, "success"), error: (m) => push(m, "error"), warning: (m) => push(m, "warning"), info: (m) => push(m, "info") }), [push]);

  return <ToastContext.Provider value={value}>
    {children}
    <div className="fixed top-3 right-3 z-[9999] w-[min(420px,calc(100vw-24px))] space-y-2 pointer-events-none">
      {toasts.map((toast) => <Toast key={toast.id} {...toast} onClose={() => remove(toast.id)} />)}
    </div>
  </ToastContext.Provider>;
}

function Toast({ message, type, onClose }) {
  const config = {
    success: { Icon: CheckCircle2, box: "border-emerald-500/30 bg-slate-50/95", icon: "text-emerald-600" },
    error: { Icon: AlertCircle, box: "border-rose-300/30 bg-slate-50/95", icon: "text-rose-600" },
    warning: { Icon: AlertTriangle, box: "border-amber-500/30 bg-slate-50/95", icon: "text-amber-400" },
    info: { Icon: Info, box: "border-indigo-500/30 bg-slate-50/95", icon: "text-indigo-600" },
  }[type] || {};
  const Icon = config.Icon || Info;
  return <div className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3 py-2.5 shadow-2xl backdrop-blur-md ${config.box}`}>
    <Icon size={17} className={`${config.icon} mt-0.5 shrink-0`} />
    <div className="flex-1 text-xs leading-5 text-slate-700">{message}</div>
    <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-700"><X size={14} /></button>
  </div>;
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
};

export const emitToast = (message, type = "info") => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("tvi:toast", { detail: { message, type } }));
};
