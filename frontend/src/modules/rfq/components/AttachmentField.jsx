import { useState } from "react";
import { Link2, Paperclip, X } from "lucide-react";
import { TextInput } from "./FormControls";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";

const ACCEPTED_FILE_TYPES = ".pdf,.xls,.xlsx,.csv,.doc,.docx,.txt,.png,.jpg,.jpeg";
const HTTP_URL = /^https?:\/\/\S+$/i;
const LINK_FILE_TYPE = "link";

// Files are uploaded through the backend storage driver; the UI keeps only returned metadata and URL.
const linkToAttachment = (url) => ({ file_name: url.split("/").filter(Boolean).pop(), file_type: LINK_FILE_TYPE, file_size: 0, url });


const FILE_SEPARATORS = /[\\/]/;
const PREVIEWABLE = /\.(pdf|png|jpe?g|gif|webp|txt)$/i;

/**
 * Where a stored attachment can be fetched from.
 * - External links / cloud URLs (absolute http/https) are used as they are.
 * - Locally stored files are always requested through the RFQ attachments endpoint, built from the stored file name.
 *   (The saved `url` starts with "/api/…", which breaks when the API client already adds the "/api" prefix.)
 */
export const attachmentUrl = (file) => {
  const raw = file?.url || "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const name = String(file?.file_path || raw).split(FILE_SEPARATORS).filter(Boolean).pop();
  if (!name) return "";
  let plain = name;
  try { plain = decodeURIComponent(name); } catch { /* already plain */ }
  return `${ENDPOINTS.RFQ.BASE}/attachments/${encodeURIComponent(plain)}`;
};

/** Readable reason for a failed open / download, so users and developers can see what went wrong. */
export const attachmentError = (error, verb) => {
  const status = error?.response?.status;
  const reason = status === 404 ? "file not found on the server" : status === 401 || status === 403 ? "you are not allowed to access this file" : status ? `server error ${status}` : error?.message || "network error";
  return `Unable to ${verb} this attachment — ${reason}.`;
};

export const openAttachment = async (file, download = false) => {
  const url = attachmentUrl(file);
  if (!url) throw new Error("this file has no stored location");
  if (/^https?:\/\//i.test(url)) { window.open(url, "_blank", "noopener,noreferrer"); return; }
  const saveToDisk = download || !PREVIEWABLE.test(file.file_name || "");   // Excel / Word files cannot be shown in a tab, so "View" downloads them
  const popup = saveToDisk ? null : window.open("about:blank", "_blank");
  try {
    const response = await api.get(url, { responseType: "blob" });
    const blobUrl = window.URL.createObjectURL(response.data);
    if (saveToDisk) {
      const anchor = document.createElement("a"); anchor.href = blobUrl; anchor.download = file.file_name || "attachment"; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    } else if (popup) popup.location.href = blobUrl;
    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
  } catch (error) {
    if (popup) popup.close();   // do not leave a blank tab behind
    throw error;
  }
};
const AttachmentActions = ({ file }) => <span className="flex shrink-0 items-center gap-2">
  <button type="button" onClick={() => openAttachment(file).catch((e) => window.alert(attachmentError(e, "open")))} className="font-semibold text-indigo-600 hover:underline">View</button>
  <button type="button" onClick={() => openAttachment(file, true).catch((e) => window.alert(attachmentError(e, "download")))} className="font-semibold text-indigo-600 hover:underline">Download</button>
</span>;

/** Read-only attachment list (used in stage cards and the details dialog). */
export function AttachmentList({ items }) {
  if (!items?.length) return <p className="text-xs text-slate-600">No attachments.</p>;
  return <ul className="space-y-1">
    {items.map((file, index) => <li key={`${file.file_name}-${index}`} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs">
      <span className="flex min-w-0 items-center gap-1.5 text-slate-700"><Paperclip size={12} className="shrink-0 text-slate-600" /><span className="truncate">{file.file_name}</span></span>
      {attachmentUrl(file) ? <AttachmentActions file={file} /> : <span className="shrink-0 text-xs text-slate-600">File unavailable</span>}
    </li>)}
  </ul>;
}

/** Editable attachment picker: choose files and/or paste links. `items` are attachment objects. */
export default function AttachmentField({ items, onChange }) {
  const [link, setLink] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const addFiles = async (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length) return;
    const payload = new FormData();
    selected.forEach((file) => payload.append("files", file));
    setUploading(true); setUploadError("");
    try {
      const response = await api.post(`${ENDPOINTS.RFQ.BASE}/attachments`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange([...items, ...(response.data.attachments || [])]);
    } catch (error) {
      setUploadError(error.response?.data?.error || error.message || "File upload failed");
    } finally { setUploading(false); }
  };
  const addLink = () => {
    const url = link.trim();
    if (!HTTP_URL.test(url)) return;
    onChange([...items, linkToAttachment(url)]);
    setLink("");
  };
  const removeAt = (index) => onChange(items.filter((_, i) => i !== index));

  return <div className="space-y-1.5">
    <div className="flex flex-wrap items-center gap-2">
      <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-400 hover:text-indigo-600 ${uploading ? "pointer-events-none opacity-50" : ""}`}>
        <Paperclip size={13} /> {uploading ? "Uploading…" : "Choose files"}
        <input type="file" multiple accept={ACCEPTED_FILE_TYPES} onChange={addFiles} className="hidden" disabled={uploading} />
      </label>
      <TextInput placeholder="or paste a link (https://…)" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }} className="min-w-[160px] flex-1" />
      <button type="button" onClick={addLink} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Link2 size={13} /> Add</button>
    </div>
    {uploadError && <p className="text-xs font-semibold text-rose-600">{uploadError}</p>}
    {items.map((file, index) => <div key={`${file.file_name}-${index}`} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
      <span className="min-w-0 truncate">{file.file_name}</span>
      {attachmentUrl(file) && <AttachmentActions file={file} />}
      <button type="button" onClick={() => removeAt(index)} aria-label={`Remove ${file.file_name}`} className="text-slate-600 hover:text-rose-600"><X size={13} /></button>
    </div>)}
  </div>;
}
