"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, ImageDown } from "lucide-react";
import { buildExportRoute, createExportConfig, exportPresets, type ExportLayout, type ExportTheme } from "@trainmap/exporter";

export function ExportDesigner() {
  const [layout, setLayout] = useState<ExportLayout>("poster");
  const [presetId, setPresetId] = useState("4k");
  const [theme, setTheme] = useState<ExportTheme>("dark");
  const [title, setTitle] = useState("Alpine archive");
  const [subtitle, setSubtitle] = useState("Personal rail footprint, 2024-2026");
  const config = useMemo(
    () =>
      createExportConfig({
        layout,
        presetId: presetId as "1080p" | "2k" | "4k" | "8k",
        theme,
        title,
        subtitle,
        includeLegend: true,
        includeAttribution: true
      }),
    [layout, presetId, subtitle, theme, title]
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
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
