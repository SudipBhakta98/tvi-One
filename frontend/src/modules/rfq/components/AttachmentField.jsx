import { useState } from "react";
import { Link2, Paperclip, X } from "lucide-react";
import { TextInput } from "./FormControls";

const ACCEPTED_FILE_TYPES = ".pdf,.xls,.xlsx,.csv,.doc,.docx,.txt,.png,.jpg,.jpeg";
const HTTP_URL = /^https?:\/\/\S+$/i;
const LINK_FILE_TYPE = "link";

// Files are stored as metadata only for now; the url field is where the S3 link goes later.
const fileToAttachment = (file) => ({ file_name: file.name, file_type: file.type, file_size: file.size, url: "" });
const linkToAttachment = (url) => ({ file_name: url.split("/").filter(Boolean).pop(), file_type: LINK_FILE_TYPE, file_size: 0, url });

/** Read-only attachment list (used in stage cards and the details dialog). */
export function AttachmentList({ items }) {
  if (!items?.length) return <p className="text-xs text-slate-600">No attachments.</p>;
  return <ul className="space-y-1">
    {items.map((file, index) => <li key={`${file.file_name}-${index}`} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs">
      <span className="flex min-w-0 items-center gap-1.5 text-slate-700"><Paperclip size={12} className="shrink-0 text-slate-600" /><span className="truncate">{file.file_name}</span></span>
      {file.url
        ? <a href={file.url} target="_blank" rel="noreferrer" className="shrink-0 font-semibold text-indigo-600 hover:underline">Open</a>
        : <span className="shrink-0 text-xs text-slate-600">File name only</span>}
    </li>)}
  </ul>;
}

/** Editable attachment picker: choose files and/or paste links. `items` are attachment objects. */
export default function AttachmentField({ items, onChange }) {
  const [link, setLink] = useState("");
  const addFiles = (event) => {
    onChange([...items, ...Array.from(event.target.files || []).map(fileToAttachment)]);
    event.target.value = "";
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
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-400 hover:text-indigo-600">
        <Paperclip size={13} /> Choose files
        <input type="file" multiple accept={ACCEPTED_FILE_TYPES} onChange={addFiles} className="hidden" />
      </label>
      <TextInput placeholder="or paste a link (https://…)" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }} className="min-w-[160px] flex-1" />
      <button type="button" onClick={addLink} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Link2 size={13} /> Add</button>
    </div>
    {items.map((file, index) => <div key={`${file.file_name}-${index}`} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
      <span className="truncate">{file.file_name}</span>
      <button type="button" onClick={() => removeAt(index)} aria-label={`Remove ${file.file_name}`} className="text-slate-600 hover:text-rose-600"><X size={13} /></button>
    </div>)}
  </div>;
}
