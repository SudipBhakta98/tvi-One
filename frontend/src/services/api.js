import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

const getMessage = (payload, fallback) => payload?.message || payload?.error || payload?.errors?.[0]?.message || fallback;
const isMutation = (method) => !["get", "head", "options"].includes(String(method || "").toLowerCase());

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("tviOneToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    const message = response.data?.message;
    if (isMutation(response.config?.method) && message && response.config?.toast !== false) {
      window.dispatchEvent(new CustomEvent("tvi:toast", { detail: { message, type: "success" } }));
    }
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const config = error.config || {};
    if (status === 401) {
      localStorage.removeItem("tviOneToken");
      localStorage.removeItem("tviOneUser");
      if (window.location.pathname !== "/login") {
        window.dispatchEvent(new CustomEvent("tvi:toast", { detail: { message: getMessage(error.response?.data, "Your session has expired. Please sign in again."), type: "warning" } }));
        window.setTimeout(() => { window.location.href = "/login"; }, 250);
      }
    } else if (config.toast !== false) {
      const type = status >= 500 ? "error" : status === 409 ? "warning" : "error";
      window.dispatchEvent(new CustomEvent("tvi:toast", { detail: { message: getMessage(error.response?.data, error.message || "Request failed"), type } }));
    }
    return Promise.reject(error);
  },
);

export default api;
