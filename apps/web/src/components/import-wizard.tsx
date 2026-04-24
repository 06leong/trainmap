"use client";

import { useMemo, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { demoStations } from "@trainmap/domain";
import { buildImportPreview, type ImportPreview } from "@trainmap/importer";
import { cn } from "@trainmap/ui";

const sampleCsv = [
  "from_station_name,to_station_name,departure_date,departure_time,operator,train_code,distance,tags,notes",
  "Paris Gare de Lyon,Zurich HB,2025-05-18,10:22,SBB,TGV Lyria 9223,611,scenic,Window seat",
  "Zurich,Milano Centrale,2025-06-02,09:33,SBB,EC 317,280,scenic,Needs Gotthard via review",
  "Unknown Central,Berlin Hbf,2025-06-03,08:00,DB,ICE 100,500,work,Unmatched origin"
].join("\n");

export function ImportWizard() {
  const [csvText, setCsvText] = useState(sampleCsv);
  const preview = useMemo<ImportPreview>(() => buildImportPreview(csvText, demoStations), [csvText]);

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
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
              reader.readAsText(file);
            }}
          />
        </label>
        <textarea
          value={csvText}
          onChange={(event) => setCsvText(event.target.value)}
          className="mt-4 h-[360px] w-full rounded-md border border-black/10 bg-[#111827] p-4 font-mono text-xs leading-5 text-white outline-none focus:border-rail"
        />
      </section>

      <section className="rounded-md border border-black/10 bg-white/72 shadow-sm">
        <div className="border-b border-black/10 p-4">
          <h2 className="font-display text-2xl text-ink">Dry-run preview</h2>
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
    </div>
  );
}
