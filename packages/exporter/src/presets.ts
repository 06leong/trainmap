export type ExportPresetId = "1080p" | "2k" | "4k" | "8k";
export type ExportLayout = "map-only" | "stats-only" | "poster";
export type ExportTheme = "light" | "dark";

export interface ExportPreset {
  id: ExportPresetId;
  label: string;
  width: number;
  height: number;
}

export interface ExportConfig {
  layout: ExportLayout;
  preset: ExportPreset;
  theme: ExportTheme;
  title: string;
  subtitle?: string;
  includeLegend: boolean;
  includeAttribution: boolean;
}

export const exportPresets: ExportPreset[] = [
  { id: "1080p", label: "1080p", width: 1920, height: 1080 },
  { id: "2k", label: "2K", width: 2560, height: 1440 },
  { id: "4k", label: "4K", width: 3840, height: 2160 },
  { id: "8k", label: "8K", width: 7680, height: 4320 }
];

export function createExportConfig(input: {
  layout: ExportLayout;
  presetId: ExportPresetId;
  theme: ExportTheme;
  title?: string;
  subtitle?: string;
  includeLegend?: boolean;
  includeAttribution?: boolean;
}): ExportConfig {
  const preset = exportPresets.find((candidate) => candidate.id === input.presetId);
  if (!preset) {
    throw new Error(`Unknown export preset: ${input.presetId}`);
  }

  return {
    layout: input.layout,
    preset,
    theme: input.theme,
    title: input.title ?? "trainmap",
    subtitle: input.subtitle,
    includeLegend: input.includeLegend ?? true,
    includeAttribution: input.includeAttribution ?? true
  };
}

export function buildExportRoute(config: ExportConfig): string {
  const params = new URLSearchParams({
    layout: config.layout,
    preset: config.preset.id,
    theme: config.theme,
    title: config.title,
    legend: String(config.includeLegend),
    attribution: String(config.includeAttribution)
  });

  if (config.subtitle) {
    params.set("subtitle", config.subtitle);
  }

  return `/export/render?${params.toString()}`;
}

export function getViewportStyle(config: ExportConfig): { width: string; height: string; aspectRatio: string } {
  return {
    width: `${config.preset.width}px`,
    height: `${config.preset.height}px`,
    aspectRatio: `${config.preset.width} / ${config.preset.height}`
  };
}
