import { useState } from "react";
import { Upload } from "lucide-react";
import { useAttendance } from "../contexts/AttendanceContext";
import { parseAttendanceFile } from "../utils/parseAttendanceFile";
import { REQUIRED_COLUMNS, XLSX_EXTENSION } from "../constants/attendanceConstants";
import { Alert } from "../../../components/ui";

/** Drag-and-drop / click uploader for the biometric .xlsx export. Parsing happens in the browser; only normalized rows are sent. */
export default function AttendanceUploader({ onUploaded }) {
  const { uploadAttendance } = useAttendance();
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const processFile = async (file) => {
    if (!file) return;
    if (!file.name.endsWith(XLSX_EXTENSION)) return setErrorMessage("Please upload an .xlsx file only.");
    setProcessing(true);
    setErrorMessage("");
    try {
      await uploadAttendance(await parseAttendanceFile(file));
      onUploaded?.();
    } catch (error) {
      console.error("Attendance upload failed:", error);
      setErrorMessage("File Error: Ensure it is a valid .xlsx with required columns.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
        <h4 className="text-xs font-bold text-indigo-800 mb-1">Required Format ({XLSX_EXTENSION}):</h4>
        <p className="text-xs text-indigo-600 mb-2">Ensure your Excel file contains these exact columns:</p>
        <div className="flex flex-wrap gap-1.5">
          {REQUIRED_COLUMNS.map((column) => <span key={column} className="rounded border border-indigo-200 bg-white px-2 py-0.5 font-mono text-[11px] text-indigo-700">{column}</span>)}
        </div>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]); }}
        className={`block rounded-lg border-2 border-dashed px-5 py-10 text-center ${dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white"} ${processing ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <input type="file" accept={XLSX_EXTENSION} disabled={processing} className="hidden" onChange={(e) => { processFile(e.target.files?.[0]); e.target.value = ""; }} />
        <Upload size={32} className="mx-auto mb-2 text-indigo-500" />
        <span className="text-sm font-semibold text-slate-800">{processing ? "Processing..." : "Upload Attendance File"}</span>
      </label>

      {errorMessage && <Alert>{errorMessage}</Alert>}
    </div>
  );
}
