export const humanize = (value) => String(value ?? "").replaceAll("_", " ");
export const formatDateTime = (value) => (value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");
