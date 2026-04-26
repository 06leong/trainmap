"use server";

import type { ExportJob } from "@trainmap/domain";
import {
  buildExportRenderUrl,
  buildExportRoute,
  createExportConfig,
  exportLayoutToJobType,
  type ExportLayout,
  type ExportTheme
} from "@trainmap/exporter";
import { getRequiredTrainmapRepository } from "@/lib/db";
import { captureExportPng, renderBaseUrl } from "@/lib/export/capture";

export interface ExportActionState {
  status: "idle" | "queued" | "rendering" | "complete" | "failed";
  message?: string;
  job?: ExportJob;
  renderRoute?: string;
  downloadUrl?: string;
}

export async function createExportAction(_previousState: ExportActionState, formData: FormData): Promise<ExportActionState> {
  const repository = getRequiredTrainmapRepository();
  const config = createExportConfig({
    layout: String(formData.get("layout") ?? "poster") as ExportLayout,
    presetId: String(formData.get("preset") ?? "4k"),
    theme: String(formData.get("theme") ?? "dark") as ExportTheme,
    title: String(formData.get("title") ?? "trainmap"),
    subtitle: optionalString(formData.get("subtitle")),
    includeLegend: formData.get("legend") === "true",
    includeAttribution: formData.get("attribution") === "true"
  });
  const renderRoute = buildExportRoute(config);
  const renderUrl = buildExportRenderUrl(config, renderBaseUrl());

  const queued = await repository.createExport({
    type: exportLayoutToJobType(config.layout),
    preset: config.preset.id,
    theme: config.theme,
    title: config.title,
    subtitle: config.subtitle,
    includeLegend: config.includeLegend,
    includeAttribution: config.includeAttribution,
    renderUrl
  });

  try {
    await repository.updateExport({ id: queued.id, status: "rendering" });
    const capture = await captureExportPng({
      exportId: queued.id,
      config,
      renderUrl
    });
    const completed = await repository.updateExport({
      id: queued.id,
      status: "complete",
      outputPath: capture.outputPath,
      completedAt: new Date().toISOString()
    });

    return {
      status: "complete",
      message: "PNG export completed.",
      job: completed,
      renderRoute,
      downloadUrl: `/api/exports/${completed.id}/png`
    };
  } catch (error) {
    const failed = await repository.updateExport({
      id: queued.id,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Export capture failed.",
      completedAt: new Date().toISOString()
    });

    return {
      status: "failed",
      message: failed.errorMessage ?? "Export capture failed.",
      job: failed,
      renderRoute
    };
  }
}

function optionalString(value: FormDataEntryValue | null): string | undefined {
  const stringValue = String(value ?? "").trim();
  return stringValue ? stringValue : undefined;
}
