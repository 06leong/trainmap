"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { CheckCircle2, FileText, Upload } from "lucide-react";
import type { Station } from "@trainmap/domain";
import { buildImportPreview, importFields, type ColumnMapping, type ImportField, type ImportPreview } from "@trainmap/importer";
import { cn } from "@trainmap/ui";
import { commitImportAction, type ImportActionState } from "@/lib/actions/imports";

const sampleCsv = [
  "from_station_name,to_station_name,departure_date,departure_time,operator,train_code,distance,tags,notes",
  "Paris Gare de Lyon,Zurich HB,2025-05-18,10:22,SBB,TGV Lyria 9223,611,scenic,Window seat",
  "Zurich,Milano Centrale,2025-06-02,09:33,SBB,EC 317,280,scenic,Needs Gotthard via review",
  "Unknown Central,Berlin Hbf,2025-06-03,08:00,DB,ICE 100,500,work,Unmatched origin"
].join("\n");

export function ImportWizard({ stations }: { stations: Station[] }) {
  const [csvText, setCsvText] = useState(sampleCsv);
  const [sourceName, setSourceName] = useState("pasted-viaducttrip.csv");
  const autoPreview = useMemo<ImportPreview>(() => buildImportPreview(csvText, stations), [csvText, stations]);
  const [mapping, setMapping] = useState<ColumnMapping>(autoPreview.mapping);
  const activeMapping = Object.keys(mapping).length > 0 ? mapping : autoPreview.mapping;
  const preview = useMemo<ImportPreview>(() => buildImportPreview(csvText, stations, activeMapping), [activeMapping, csvText, stations]);
  const [state, formAction] = useFormState<ImportActionState, FormData>(commitImportAction, { status: "idle" });

  useEffect(() => {
    setMapping(autoPreview.mapping);
  }, [autoPreview.mapping]);

  return (
    <form action={formAction} className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <input type="hidden" name="csvText" value={csvText} />
      <input type="hidden" name="mappingJson" value={JSON.stringify(activeMapping)} />
      <input type="hidden" name="sourceName" value={sourceName} />
      <section className="rounded-md border border-black/10 bg-white/72 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-ink p-2 text-white">
            <Upload className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-2xl text-ink">CSV source</h2>
            <p className="text-sm text-black/58">Paste or load a viaducttrip.csv-style export for dry-run validation.</p>
          </div>
        </div>
        <label className="mt-4 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-black/20 bg-[#f8f5ef] px-4 py-6 text-sm text-black/58 transition hover:border-ink">
          <FileText className="mr-2 h-4 w-4" />
          Load CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setCsvText(String(reader.result ?? ""));
              setSourceName(file.name);
              reader.readAsText(file);
            }}
          />
        </label>
        <textarea
          value={csvText}
          onChange={(event) => setCsvText(event.target.value)}
          className="mt-4 h-[360px] w-full rounded-md border border-black/10 bg-[#111827] p-4 font-mono text-xs leading-5 text-white outline-none focus:border-rail"
        />
        <div className="mt-4 rounded-md border border-black/10 bg-[#f8f5ef] p-3">
          <div className="text-xs uppercase text-black/45">Column mapping</div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {importFields.map((field) => (
              <label key={field} className="grid gap-1 text-xs text-black/58">
                <span>{fieldLabel(field)}</span>
                <select
                  value={activeMapping[field] ?? ""}
                  onChange={(event) =>
                    setMapping((current) => ({
                      ...current,
                      [field]: event.target.value || undefined
                    }))
                  }
                  className="rounded-md border border-black/10 bg-white px-2 py-2 text-sm text-ink outline-none focus:border-rail"
                >
                  <option value="">Not mapped</option>
                  {preview.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-black/10 bg-white/72 shadow-sm">
        <div className="border-b border-black/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-ink">Dry-run preview</h2>
              <p className="mt-1 text-sm text-black/58">Every row is preserved. Matched and fuzzy rows can be committed; invalid and unmatched rows remain reviewable.</p>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md bg-rail px-4 py-2.5 text-sm text-white disabled:opacity-40"
              disabled={preview.rows.length === 0}
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm import
            </button>
          </div>
          {state.message ? (
            <div
              className={cn(
                "mt-3 rounded-md border px-3 py-2 text-sm",
                state.status === "success" && "border-emerald-700/20 bg-emerald-50 text-emerald-800",
                state.status === "error" && "border-rose-700/20 bg-rose-50 text-rose-800"
              )}
            >
              {state.message}
              {state.result ? <span> Import ID: {state.result.importRun.id}</span> : null}
            </div>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            {Object.entries(preview.counts).map(([status, count]) => (
              <div key={status} className="rounded-md border border-black/10 bg-[#f8f5ef] p-3">
                <div className="text-xs uppercase text-black/45">{status.replace("_", " ")}</div>
                <div className="mt-1 font-display text-2xl text-ink">{count}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="selection-panel max-h-[560px] overflow-auto">
          {preview.rows.map((row) => (
            <div key={row.rowNumber} className="border-b border-black/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-medium text-ink">
                  Row {row.rowNumber}: {row.normalized.from_station_name || "Unknown"} to{" "}
                  {row.normalized.to_station_name || "Unknown"}
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    row.status === "matched" && "border-emerald-700/20 bg-emerald-50 text-emerald-800",
                    row.status === "fuzzy_matched" && "border-amber-700/20 bg-amber-50 text-amber-800",
                    row.status === "unmatched" && "border-rose-700/20 bg-rose-50 text-rose-800",
                    row.status === "invalid" && "border-black/15 bg-black/5 text-black/64"
                  )}
                >
                  {row.status.replace("_", " ")}
                </span>
              </div>
              <div className="mt-2 grid gap-2 text-sm text-black/62 md:grid-cols-2">
                <div>Origin match: {row.fromStation.station?.name ?? "review required"}</div>
                <div>Destination match: {row.toStation.station?.name ?? "review required"}</div>
              </div>
              {row.messages.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-rose-800">
                  {row.messages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </form>
  );
}

function fieldLabel(field: ImportField): string {
  return field.replaceAll("_", " ");
}
