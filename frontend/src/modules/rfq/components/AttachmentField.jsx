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


const attachmentUrl = (file) => file.url || (file.file_path ? `${ENDPOINTS.RFQ.BASE}/attachments/${encodeURIComponent(file.file_path.split(/[\\/]/).pop())}` : "");
const openAttachment = async (file, download = false) => {
  const url = attachmentUrl(file);
  if (!url) return;
  if (/^https?:\/\//i.test(url)) { window.open(url, "_blank", "noopener,noreferrer"); return; }
  const popup = download ? null : window.open("about:blank", "_blank");
  const response = await api.get(`${url}${download ? "?download=1" : ""}`, { responseType: "blob" });
  const blobUrl = window.URL.createObjectURL(response.data);
  if (download) {
    const anchor = document.createElement("a"); anchor.href = blobUrl; anchor.download = file.file_name || "attachment"; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  } else if (popup) popup.location.href = blobUrl;
  window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
};
const AttachmentActions = ({ file }) => <span className="flex shrink-0 items-center gap-2">
  <button type="button" onClick={() => openAttachment(file).catch(() => window.alert("Unable to open attachment"))} className="font-semibold text-indigo-600 hover:underline">View</button>
  <button type="button" onClick={() => openAttachment(file, true).catch(() => window.alert("Unable to download attachment"))} className="font-semibold text-indigo-600 hover:underline">Download</button>
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
