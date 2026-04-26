export type ExportPresetId = "1080p" | "2k" | "4k";
export type ExportLayout = "map-only" | "stats-only" | "poster";
export type ExportTheme = "light" | "dark";
export type ExportJobType = "map" | "stats" | "poster";

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
  { id: "4k", label: "4K", width: 3840, height: 2160 }
];

export function getExportPresetById(presetId: string): ExportPreset {
  const preset = exportPresets.find((candidate) => candidate.id === presetId);
  if (!preset) {
    throw new Error(`Unsupported export preset: ${presetId}`);
  }
  return preset;
}

export function getExportPresetByDimensions(width: number, height: number): ExportPreset {
  const preset = exportPresets.find((candidate) => candidate.width === width && candidate.height === height);
  if (!preset) {
    throw new Error(`Unsupported export dimensions: ${width}x${height}`);
  }
  return preset;
}

export function createExportConfig(input: {
  layout: ExportLayout;
  presetId: string;
  theme: ExportTheme;
  title?: string;
  subtitle?: string;
  includeLegend?: boolean;
  includeAttribution?: boolean;
}): ExportConfig {
  const preset = getExportPresetById(input.presetId);

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

export function buildExportRenderUrl(config: ExportConfig, baseUrl: string): string {
  return new URL(buildExportRoute(config), withTrailingSlash(baseUrl)).toString();
}

export function exportLayoutToJobType(layout: ExportLayout): ExportJobType {
  if (layout === "map-only") {
    return "map";
  }
  if (layout === "stats-only") {
    return "stats";
  }
  return "poster";
}

export function exportJobTypeToLayout(type: ExportJobType): ExportLayout {
  if (type === "map") {
    return "map-only";
  }
  if (type === "stats") {
    return "stats-only";
  }
  return "poster";
}

export function getViewportStyle(config: ExportConfig): { width: string; height: string; aspectRatio: string } {
  return {
    width: `${config.preset.width}px`,
    height: `${config.preset.height}px`,
    aspectRatio: `${config.preset.width} / ${config.preset.height}`
  };
}

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
