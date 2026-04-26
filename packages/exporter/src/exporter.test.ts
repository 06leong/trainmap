import { describe, expect, it } from "vitest";
import {
  buildExportRenderUrl,
  buildExportRoute,
  createExportConfig,
  exportLayoutToJobType,
  exportPresets,
  getExportPresetByDimensions,
  getViewportStyle
} from "./presets";

describe("export presets", () => {
  it("exposes only 1080p, 2k, and 4k presets", () => {
    expect(exportPresets.map((preset) => preset.id)).toEqual(["1080p", "2k", "4k"]);
  });

  it("creates 4k poster export configs", () => {
    const config = createExportConfig({
      layout: "poster",
      presetId: "4k",
      theme: "dark",
      title: "Alpine archive"
    });

    expect(config.preset.width).toBe(3840);
    expect(config.preset.height).toBe(2160);
    expect(getViewportStyle(config).aspectRatio).toBe("3840 / 2160");
  });

  it("serializes export routes for dedicated render pages", () => {
    const config = createExportConfig({
      layout: "map-only",
      presetId: "1080p",
      theme: "light",
      title: "Full map"
    });

    expect(buildExportRoute(config)).toContain("/export/render?");
    expect(buildExportRoute(config)).toContain("preset=1080p");
  });

  it("generates absolute render URLs for Playwright capture", () => {
    const config = createExportConfig({
      layout: "stats-only",
      presetId: "2k",
      theme: "dark",
      title: "Stats"
    });

    expect(buildExportRenderUrl(config, "http://127.0.0.1:3000")).toBe(
      "http://127.0.0.1:3000/export/render?layout=stats-only&preset=2k&theme=dark&title=Stats&legend=true&attribution=true"
    );
    expect(exportLayoutToJobType(config.layout)).toBe("stats");
  });

  it("rejects unsupported export dimensions", () => {
    expect(() => getExportPresetByDimensions(7680, 4320)).toThrow("Unsupported export dimensions: 7680x4320");
    expect(() =>
      createExportConfig({
        layout: "poster",
        presetId: "7680x4320",
        theme: "dark"
      })
    ).toThrow("Unsupported export preset: 7680x4320");
  });
});
