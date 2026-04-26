"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Download, ExternalLink, ImageDown, Loader2 } from "lucide-react";
import {
  buildExportRoute,
  createExportConfig,
  exportPresets,
  type ExportLayout,
  type ExportPresetId,
  type ExportTheme
} from "@trainmap/exporter";
import { createExportAction, type ExportActionState } from "@/lib/actions/exports";

export function ExportDesigner() {
  const [layout, setLayout] = useState<ExportLayout>("poster");
  const [presetId, setPresetId] = useState("4k");
  const [theme, setTheme] = useState<ExportTheme>("dark");
  const [title, setTitle] = useState("Alpine archive");
  const [subtitle, setSubtitle] = useState("Personal rail footprint, 2024-2026");
  const [state, formAction] = useFormState<ExportActionState, FormData>(createExportAction, { status: "idle" });
  const config = useMemo(
    () =>
      createExportConfig({
        layout,
        presetId: presetId as ExportPresetId,
        theme,
        title,
        subtitle,
        includeLegend: true,
        includeAttribution: true
      }),
    [layout, presetId, subtitle, theme, title]
  );

  return (
    <form action={formAction} className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <input type="hidden" name="layout" value={layout} />
      <input type="hidden" name="preset" value={config.preset.id} />
      <input type="hidden" name="theme" value={theme} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="subtitle" value={subtitle} />
      <input type="hidden" name="legend" value="true" />
      <input type="hidden" name="attribution" value="true" />

      <section className="rounded-md border border-black/10 bg-white/72 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-brass p-2 text-white">
            <ImageDown className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-2xl text-ink">Export designer</h2>
            <p className="text-sm text-black/58">Dedicated render routes for map, stats, and poster PNG output.</p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          <SegmentedControl
            label="Layout"
            value={layout}
            options={[
              ["map-only", "Map"],
              ["stats-only", "Stats"],
              ["poster", "Poster"]
            ]}
            onChange={(value) => setLayout(value as ExportLayout)}
          />
          <SegmentedControl
            label="Preset"
            value={presetId}
            options={exportPresets.map((preset) => [preset.id, `${preset.label} · ${preset.width}x${preset.height}`])}
            onChange={setPresetId}
          />
          <SegmentedControl
            label="Theme"
            value={theme}
            options={[
              ["light", "Light"],
              ["dark", "Dark"]
            ]}
            onChange={(value) => setTheme(value as ExportTheme)}
          />
          <label className="block text-sm">
            <span className="text-black/54">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-black/10 bg-[#f8f5ef] px-3 outline-none focus:border-ink"
            />
          </label>
          <label className="block text-sm">
            <span className="text-black/54">Subtitle</span>
            <input
              value={subtitle}
              onChange={(event) => setSubtitle(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-black/10 bg-[#f8f5ef] px-3 outline-none focus:border-ink"
            />
          </label>
          <Link
            href={buildExportRoute(config)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm text-white"
          >
            <ExternalLink className="h-4 w-4" />
            Open render route
          </Link>
          <ExportSubmitButton />
          <ExportStatusPanel state={state} />
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-black/10 bg-white/72 shadow-sm">
        <div
          className={theme === "dark" ? "bg-[#111827] p-8 text-white" : "bg-[#f8f5ef] p-8 text-ink"}
          style={{ aspectRatio: `${config.preset.width} / ${config.preset.height}` }}
        >
          <div className="flex h-full flex-col justify-between border border-current/20 p-8">
            <div>
              <div className="text-sm uppercase opacity-55">{layout.replace("-", " ")}</div>
              <h3 className="mt-4 font-display text-5xl">{title}</h3>
              <p className="mt-3 text-lg opacity-70">{subtitle}</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {["1,547 km", "5 countries", "3 operators"].map((metric) => (
                <div key={metric} className="border-t border-current/25 pt-3 font-display text-3xl">
                  {metric}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </form>
  );
}

function ExportSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-rail px-4 py-2.5 text-sm text-white disabled:opacity-45"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
      {pending ? "Rendering PNG" : "Generate PNG"}
    </button>
  );
}

function ExportStatusPanel({ state }: { state: ExportActionState }) {
  const { pending } = useFormStatus();
  const status = pending ? "rendering" : state.status === "idle" ? "queued" : state.status;
  const label = status === "complete" ? "completed" : status;

  return (
    <div className="rounded-md border border-black/10 bg-[#f8f5ef] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase text-black/45">Job status</div>
          <div className="mt-1 font-medium capitalize text-ink">{label}</div>
        </div>
        <span
          className={
            status === "complete"
              ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800"
              : status === "failed"
                ? "rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-800"
                : "rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-800"
          }
        >
          {label}
        </span>
      </div>
      {state.message ? <p className="mt-2 text-sm text-black/62">{state.message}</p> : null}
      {state.job?.outputPath ? <p className="mt-2 break-all text-xs text-black/45">{state.job.outputPath}</p> : null}
      {state.downloadUrl ? (
        <Link href={state.downloadUrl} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-rail">
          <Download className="h-4 w-4" />
          Download PNG
        </Link>
      ) : null}
    </div>
  );
}

function SegmentedControl({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-sm text-black/54">{label}</div>
      <div className="grid gap-1 rounded-md border border-black/10 bg-[#f8f5ef] p-1">
        {options.map(([optionValue, optionLabel]) => (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            className={
              value === optionValue
                ? "rounded bg-ink px-3 py-2 text-left text-xs text-white"
                : "rounded px-3 py-2 text-left text-xs text-black/62 hover:bg-white"
            }
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}
