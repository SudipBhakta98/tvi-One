import React, { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Upload, Download, X, ArrowLeft, CheckCircle2, AlertCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from "../../../../core/notifications/ToastContext";

// Wrap a value in quotes when it contains a comma, quote or line break.
const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// Preview cell text. Rate columns are stored as fractions (0.18) but shown as the percent the user typed (18%).
const formatPreviewValue = (column, value) => {
  if (value === "" || value === null || value === undefined) return "";
  if (column.percent && typeof value === "number" && Number.isFinite(value)) {
    return `${Number((value * 100).toFixed(4))}%`;
  }
  return String(value);
};

function DownloadTemplate({ columnGuide, fileName }) {
  const downloadTemplate = () => {
    // Headers use the readable labels (e.g. "Invoice Number"); the parser accepts these as well as the field names.
    const header = columnGuide.map((column) => csvCell(column.label || column.key)).join(",");
    const example = columnGuide.map((column) => csvCell(column.example)).join(",");
    // Leading BOM so Excel opens the file as UTF-8 (keeps the ₹ and other characters intact).
    const csv = `\uFEFF${header}\r\n${example}\r\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={downloadTemplate}
      className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-100"
    >
      <Download size={17} /> Download CSV Template
    </button>
  );
}

/**
 * Full-screen bulk upload (Excel / CSV) used by both Add Payable and Add Receivable.
 * The caller supplies what differs:
 *   title / dataLabel / partyLabel / partyField : wording and the party column of the failed-rows table
 *   columnGuide    : [{ key, label, required, example, hint, percent }] describing the columns
 *   formatNotes    : string[] of rules listed under "File format requirements"
 *   parseFile      : (file) => Promise<{ rows }>  (browser-side parser)
 *   createInvoices : (rows) => axios request that saves the rows
 *   templateFileName : name of the downloadable CSV template
 */
export default function BulkUploadWorkspace({
  title,
  dataLabel,
  partyLabel,
  partyField,
  columnGuide,
  formatNotes = [],
  parseFile,
  createInvoices,
  templateFileName,
  onBack,
  onClose,
  onSuccess,
}) {
  const inputRef = useRef(null);
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [parseError, setParseError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [result, setResult] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const previewRows = useMemo(() => rows.slice(0, 8), [rows]);

  const handleFile = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setRows([]);
    setResult(null);
    setParseError("");
    setUploadError("");
    setParsing(true);
    try {
      const parsed = await parseFile(selectedFile);
      setRows(parsed.rows);
    } catch (error) {
      setParseError(error.message || "Unable to parse the file.");
    } finally {
      setParsing(false);
    }
  };

  const handleUpload = async () => {
    if (!rows.length) {
      setUploadError("Upload a valid file with at least one data row first.");
      return;
    }

    setUploading(true);
    setUploadError("");
    setResult(null);
    try {
      const response = await createInvoices(rows);
      const resData = response.data;
      setResult(resData);

      const failedInvoices = resData.failedInvoices || resData.invalidItems || [];
      const failedCount = resData.summary?.failedCount ?? failedInvoices.length;
      const successCount = resData.summary?.successfullyInserted ?? 0;

      if (failedCount > 0 && successCount > 0) {
        toast.warning(`${failedCount} invoice(s) failed validation while ${successCount} were created successfully.`);
      } else if (failedCount > 0 && successCount === 0) {
        toast.error(`Bulk upload failed. All ${failedCount} invoice(s) have validation errors.`);
      } else {
        toast.success(`Bulk process completed successfully! ${successCount} invoice(s) created.`);
      }

      if (successCount > 0 && onSuccess) {
        onSuccess();
      }
    } catch (error) {
      const errResponse = error.response?.data;
      const failedInvoices = errResponse?.failedInvoices || errResponse?.invalidItems || [];

      if (errResponse) {
        setResult(errResponse);
      }

      const errMsg =
        errResponse?.message ||
        error.message ||
        `Bulk ${dataLabel} upload failed.`;

      setUploadError(errMsg);
      toast.error(errMsg);

      if (failedInvoices.length > 0) {
        console.error("Bulk Upload Validation Failures:", failedInvoices);
      }
    } finally {
      setUploading(false);
    }
  };

  const failedItemsList = result?.failedInvoices || result?.invalidItems || [];

  return (
    <div className="fixed top-14 left-64 right-0 bottom-0 z-50 bg-slate-50 overflow-y-auto">
      <div className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-100"
            >
              <ArrowLeft size={17} /> Back
            </button>
            <div>
              <h2 className="text-2xl font-black text-slate-900">{title}</h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Upload your file to validate and process bulk invoices.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-700"
          >
            <X size={18} /> Close
          </button>
        </header>

        <main className="flex-1 p-6 space-y-5 max-w-[1500px] w-full mx-auto">
          <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">File format requirements</h3>
                <p className="text-sm text-slate-700 mt-1">
                  Use the columns below. Column order does not matter, and header names are matched case-insensitively.
                  The CSV template already has the right headers and a sample row.
                </p>
              </div>
              <DownloadTemplate columnGuide={columnGuide} fileName={templateFileName} />
            </div>

            {formatNotes.length > 0 && (
              <ul className="mt-4 list-disc list-inside space-y-1 text-sm font-medium text-slate-800">
                {formatNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}

            <div className="mt-4 overflow-x-auto rounded-lg border border-indigo-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-800">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-black">Column</th>
                    <th className="px-3 py-2.5 text-left font-black">Required</th>
                    <th className="px-3 py-2.5 text-left font-black">Example</th>
                    <th className="px-3 py-2.5 text-left font-black">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {columnGuide.map((column) => (
                    <tr key={column.key} className="border-t border-slate-200">
                      <td className="px-3 py-2 font-bold text-indigo-700 whitespace-nowrap">{column.label || column.key}</td>
                      <td
                        className={`px-3 py-2 font-bold ${column.required === false ? "text-slate-500" : "text-emerald-700"}`}
                      >
                        {column.required === false ? "No" : "Yes"}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap">{column.example}</td>
                      <td className="px-3 py-2 text-slate-700">{column.hint || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">1. Select file</h3>
                <p className="text-sm text-slate-600 mt-1">Accepted: .xlsx, .xls, .csv</p>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-indigo-700"
              >
                <Upload size={18} /> Choose Excel / CSV
              </button>
              <input
                ref={inputRef}
                hidden
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
            </div>

            {file && (
              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 flex items-center gap-3">
                <FileSpreadsheet className="text-emerald-600" size={22} />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 truncate">{file.name}</div>
                  <div className="text-xs text-slate-600">{Math.round(file.size / 1024)} KB</div>
                </div>
                {parsing && <RefreshCw size={18} className="animate-spin text-indigo-600" />}
                {!parsing && rows.length > 0 && <CheckCircle2 size={20} className="text-emerald-600" />}
              </div>
            )}

            {parseError && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
                <AlertCircle className="inline mr-2" size={17} />
                {parseError}
              </div>
            )}
          </section>

          {rows.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900">2. Review {dataLabel} data</h3>
                  <p className="text-sm text-slate-600">
                    {rows.length} rows data. Showing first {previewRows.length} rows for review.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {uploading ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  {uploading ? "Uploading..." : "Upload The Data"}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1100px] w-full text-sm">
                  <thead className="bg-slate-100 text-slate-800">
                    <tr>
                      {columnGuide.map((column) => (
                        <th key={column.key} className="px-3 py-3 text-left font-black whitespace-nowrap">
                          {column.label || column.key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={row.__sourceRow} className="border-t border-slate-200">
                        {columnGuide.map((column) => (
                          <td key={column.key} className="px-3 py-3 text-slate-700 whitespace-nowrap">
                            {formatPreviewValue(column, row[column.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {uploadError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
              <AlertCircle className="inline mr-2" size={17} />
              {uploadError}
            </div>
          )}

          {result && (
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
              <h3 className="text-lg font-black text-slate-900">3. Bulk Import Results</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                  <div className="text-xs font-bold uppercase text-slate-500">Received</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {result.summary?.totalReceived ?? rows.length}
                  </div>
                </div>
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                  <div className="text-xs font-bold uppercase text-emerald-700">Created</div>
                  <div className="text-2xl font-black text-emerald-700 mt-1">
                    {result.summary?.successfullyInserted ?? 0}
                  </div>
                </div>
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-4">
                  <div className="text-xs font-bold uppercase text-rose-700">Failed</div>
                  <div className="text-2xl font-black text-rose-700 mt-1">
                    {result.summary?.failedCount ?? failedItemsList.length}
                  </div>
                </div>
              </div>

              {failedItemsList.length > 0 && (
                <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                  <div className="flex items-center gap-2 mb-3 text-rose-800 font-black">
                    <AlertTriangle size={18} />
                    <span>Failed Invoices Log ({failedItemsList.length} items requiring attention)</span>
                  </div>
                  <div className="overflow-x-auto bg-white rounded-lg border border-rose-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-rose-100/70 text-rose-900">
                        <tr>
                          <th className="px-3 py-2 text-left font-black">Row</th>
                          <th className="px-3 py-2 text-left font-black">Invoice No</th>
                          <th className="px-3 py-2 text-left font-black">GRN</th>
                          <th className="px-3 py-2 text-left font-black">{partyLabel}</th>
                          <th className="px-3 py-2 text-left font-black">Validation Error Logs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {failedItemsList.map((item) => (
                          <tr key={item.index} className="border-t border-rose-100 hover:bg-rose-50/30">
                            <td className="px-3 py-2.5 font-bold text-slate-700">#{item.index}</td>
                            <td className="px-3 py-2.5 font-mono font-semibold text-slate-900">
                              {item.invoiceNumber}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-slate-700">{item.grnNumber}</td>
                            <td className="px-3 py-2.5 text-slate-700">{item[partyField] || "N/A"}</td>
                            <td className="px-3 py-2.5 text-rose-700 font-medium">
                              {Array.isArray(item.errors) ? (
                                <ul className="list-disc list-inside space-y-1">
                                  {item.errors.map((err, i) => (
                                    <li key={i}>{err}</li>
                                  ))}
                                </ul>
                              ) : (
                                String(item.errors || "")
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}