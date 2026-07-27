import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ImportedProspect {
  name: string;
  company: string;
  phone?: string;
  email?: string;
  notes?: string;
}

interface Props {
  onImport: (rows: ImportedProspect[]) => Promise<{ imported: number; skipped: number[] }>;
  onClose: () => void;
}

type Step = "upload" | "map" | "preview" | "result";

const FIELDS = [
  { key: "name",    label: "Name *",    required: true },
  { key: "company", label: "Company *", required: true },
  { key: "phone",   label: "Phone",     required: false },
  { key: "email",   label: "Email",     required: false },
  { key: "notes",   label: "Notes",     required: false },
] as const;

type FieldKey = typeof FIELDS[number]["key"];

function guessMapping(headers: string[]): Record<FieldKey, string> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const find = (...terms: string[]) =>
    headers.find((h) => terms.some((t) => norm(h).includes(t))) ?? "";
  return {
    name:    find("name", "contact", "person", "full"),
    company: find("company", "firm", "business", "org", "organisation", "organization"),
    phone:   find("phone", "mobile", "whatsapp", "cell", "tel", "contact"),
    email:   find("email", "mail"),
    notes:   find("note", "remark", "comment", "desc", "source"),
  };
}

export default function CsvImportModal({ onImport, onClose }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({ name: "", company: "", phone: "", email: "", notes: "" });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv" || ext === "txt") {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const hdrs = res.meta.fields ?? [];
          const rows = res.data as Record<string, string>[];
          setHeaders(hdrs);
          setRawRows(rows);
          setMapping(guessMapping(hdrs));
          setStep("map");
        },
        error: (err) => setImportError(`CSV parse error: ${err.message}`),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "binary" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
          const hdrs = json.length > 0 ? Object.keys(json[0]) : [];
          setHeaders(hdrs);
          setRawRows(json);
          setMapping(guessMapping(hdrs));
          setStep("map");
        } catch (err) {
          setImportError(`Excel parse error: ${err instanceof Error ? err.message : "unknown"}`);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setImportError("Unsupported file type. Please upload a .csv, .xlsx, or .xls file.");
    }
  }, []);

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) { setImportError(null); parseFile(file); }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) { setImportError(null); parseFile(file); }
  }

  function buildPreview(): ImportedProspect[] {
    return rawRows.map((row) => ({
      name:    mapping.name    ? (row[mapping.name]    ?? "").trim() : "",
      company: mapping.company ? (row[mapping.company] ?? "").trim() : "",
      phone:   mapping.phone   ? (row[mapping.phone]   ?? "").trim() || undefined : undefined,
      email:   mapping.email   ? (row[mapping.email]   ?? "").trim() || undefined : undefined,
      notes:   mapping.notes   ? (row[mapping.notes]   ?? "").trim() || undefined : undefined,
    }));
  }

  const preview = step === "preview" || step === "result" ? buildPreview() : [];
  const validPreview = preview.filter((r) => r.name && r.company);
  const invalidPreview = preview.length - validPreview.length;

  async function handleImport() {
    setImporting(true);
    setImportError(null);
    try {
      const res = await onImport(buildPreview());
      setResult(res);
      setStep("result");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const canProceedMap = mapping.name && mapping.company;

  const inp = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-300/40 bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold">Import Prospect List</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Supports CSV, Excel (.xlsx / .xls)</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-slate-50 text-xs font-semibold">
          {(["upload", "map", "preview", "result"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <span className="text-slate-300">›</span>}
              <span className={step === s ? "text-primary" : "text-slate-400"}>
                {i + 1}. {s === "upload" ? "Upload" : s === "map" ? "Map Columns" : s === "preview" ? "Preview" : "Done"}
              </span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* STEP 1: Upload */}
          {step === "upload" && (
            <div>
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileRef.current?.click()}
              >
                <div className="text-4xl mb-3">📄</div>
                <p className="font-semibold text-slate-700 mb-1">Drop your file here, or click to browse</p>
                <p className="text-xs text-muted-foreground">Accepted formats: .csv · .xlsx · .xls</p>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileSelect} />
              </div>
              {importError && <p className="text-sm text-red-600 mt-3">⚠️ {importError}</p>}
              <div className="mt-5 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs font-semibold text-slate-600 mb-2">Expected columns (any order, any header name):</p>
                <div className="flex flex-wrap gap-2">
                  {["Name *", "Company *", "Phone", "Email", "Notes"].map((col) => (
                    <span key={col} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded-md text-slate-600">{col}</span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">You'll be able to match your column headers to these fields in the next step.</p>
              </div>
            </div>
          )}

          {/* STEP 2: Column mapping */}
          {step === "map" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Found <strong>{rawRows.length}</strong> rows with <strong>{headers.length}</strong> columns. Map your columns to the fields below:
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {FIELDS.map((field) => (
                  <div key={field.key}>
                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">{field.label}</label>
                    <select
                      value={mapping[field.key]}
                      onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                      className={inp}
                    >
                      <option value="">— skip —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {!canProceedMap && (
                <p className="text-xs text-amber-600">⚠️ You must map at least Name and Company to continue.</p>
              )}
            </div>
          )}

          {/* STEP 3: Preview */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="text-sm">
                  <span className="font-semibold text-emerald-700">{validPreview.length}</span> prospects ready to import
                  {invalidPreview > 0 && <span className="text-amber-600 ml-2">· {invalidPreview} will be skipped (missing name or company)</span>}
                </div>
              </div>
              <div className="overflow-x-auto border border-border rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-muted-foreground uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Company</th>
                      <th className="px-3 py-2 text-left">Phone</th>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((row, i) => {
                      const valid = Boolean(row.name && row.company);
                      return (
                        <tr key={i} className={`border-t border-border/50 ${valid ? "" : "bg-red-50"}`}>
                          <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-2 font-medium">{row.name || <span className="text-red-400">—</span>}</td>
                          <td className="px-3 py-2">{row.company || <span className="text-red-400">—</span>}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.phone || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.email || "—"}</td>
                          <td className="px-3 py-2">{valid ? <span className="text-emerald-600">✓</span> : <span className="text-red-500">Skip</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {preview.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center py-2 border-t border-border/50">
                    Showing first 10 of {preview.length} rows
                  </p>
                )}
              </div>
              {importError && <p className="text-sm text-red-600">⚠️ {importError}</p>}
            </div>
          )}

          {/* STEP 4: Result */}
          {step === "result" && result && (
            <div className="text-center py-8 space-y-4">
              <div className="text-5xl">🎉</div>
              <h3 className="text-xl font-bold">Import Complete</h3>
              <div className="flex justify-center gap-6">
                <div className="text-center">
                  <div className="text-3xl font-extrabold text-emerald-600">{result.imported}</div>
                  <div className="text-xs text-muted-foreground mt-1">Prospects added</div>
                </div>
                {result.skipped.length > 0 && (
                  <div className="text-center">
                    <div className="text-3xl font-extrabold text-amber-500">{result.skipped.length}</div>
                    <div className="text-xs text-muted-foreground mt-1">Rows skipped</div>
                  </div>
                )}
              </div>
              {result.skipped.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Rows {result.skipped.join(", ")} were skipped — they were missing a required Name or Company value.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          {step === "upload" && (
            <button onClick={onClose} className="flex-1 border border-border rounded-lg py-2 text-sm text-muted-foreground hover:bg-slate-50 transition">Cancel</button>
          )}
          {step === "map" && (
            <>
              <button onClick={() => { setStep("upload"); setImportError(null); }} className="px-4 border border-border rounded-lg py-2 text-sm text-muted-foreground hover:bg-slate-50 transition">← Back</button>
              <button onClick={() => setStep("preview")} disabled={!canProceedMap} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition">Preview →</button>
            </>
          )}
          {step === "preview" && (
            <>
              <button onClick={() => setStep("map")} className="px-4 border border-border rounded-lg py-2 text-sm text-muted-foreground hover:bg-slate-50 transition">← Back</button>
              <button onClick={handleImport} disabled={importing || validPreview.length === 0} className="flex-1 bg-emerald-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition">
                {importing ? "Importing…" : `Import ${validPreview.length} Prospect${validPreview.length !== 1 ? "s" : ""}`}
              </button>
            </>
          )}
          {step === "result" && (
            <button onClick={onClose} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-semibold hover:opacity-90 transition">Done</button>
          )}
        </div>
      </div>
    </div>
  );
}
