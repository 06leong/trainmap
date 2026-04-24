import { describe, expect, it } from "vitest";
import { buildExportRoute, createExportConfig, getViewportStyle } from "./presets";

describe("export presets", () => {
  it("creates 8k poster export configs", () => {
    const config = createExportConfig({
      layout: "poster",
      presetId: "8k",
      theme: "dark",
      title: "Alpine archive"
    });

    expect(config.preset.width).toBe(7680);
    expect(config.preset.height).toBe(4320);
    expect(getViewportStyle(config).aspectRatio).toBe("7680 / 4320");
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
});
