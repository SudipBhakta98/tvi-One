import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Panel } from "../../../components/ui";

export default function RfqParts({ mainParts }) {
  const [open, setOpen] = useState({});
  const parts = mainParts || [];
  return <Panel title="Part Hierarchy" toolbar={<span className="text-xs text-slate-600">RFQ → Main Part → Sub Part</span>}>
    <div className="space-y-1.5">
      {parts.map((part, i) => {
        const id = part._id || i, expanded = open[id] !== false;
        return <div key={id} className="border border-slate-200 rounded-md overflow-hidden">
          <button type="button" onClick={() => setOpen((x) => ({ ...x, [id]: !expanded }))} className="w-full flex items-center justify-between px-2.5 py-2 bg-slate-50 hover:bg-white">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {part.main_part_no}</span>
            <span className="text-xs text-slate-600">{part.volume_per_annum_nos || 0} / year · {part.sub_parts?.length || 0} sub parts</span>
          </button>
          {expanded && <div className="p-2 bg-white/50 space-y-1">
            <p className="text-xs text-slate-600">{part.description || "No description"}</p>
            {(part.sub_parts || []).map((sub, si) => <div key={sub._id || si} className="grid grid-cols-3 gap-2 rounded-md bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs"><span className="text-slate-900 font-mono">{sub.sub_part_no}</span><span className="text-slate-600">{sub.description || "—"}</span><span className="text-right text-slate-700">Qty {sub.qty_per_main_part || 1}</span></div>)}
          </div>}
        </div>;
      })}
    </div>
  </Panel>;
}
