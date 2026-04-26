import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import type { ExportConfig } from "@trainmap/exporter";

export interface CaptureExportInput {
  exportId: string;
  config: ExportConfig;
  renderUrl: string;
}

export interface CaptureExportResult {
  outputPath: string;
}

export async function captureExportPng(input: CaptureExportInput): Promise<CaptureExportResult> {
  const outputDir = exportOutputDirectory();
  await mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${input.exportId}-${input.config.preset.id}.png`);
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });

  try {
    const page = await browser.newPage({
      viewport: {
        width: input.config.preset.width,
        height: input.config.preset.height
      },
      deviceScaleFactor: 1
    });
    await page.goto(input.renderUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.locator("[data-export-ready='true']").waitFor({ timeout: 30_000 }).catch(() => undefined);
    await page.screenshot({
      path: outputPath,
      type: "png",
      fullPage: false
    });
  } finally {
    await browser.close();
  }

  return { outputPath };
}

export function exportOutputDirectory(): string {
  return path.resolve(process.env.TRAINMAP_EXPORT_DIR ?? path.join(process.cwd(), "storage", "exports"));
}

export function renderBaseUrl(): string {
  return (
    process.env.TRAINMAP_RENDER_BASE_URL ??
    `http://127.0.0.1:${process.env.PORT ?? process.env.TRAINMAP_INTERNAL_PORT ?? "3000"}`
  );
}
