import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    environment: "node"
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
      "@trainmap/domain": fileURLToPath(new URL("./packages/domain/src/index.ts", import.meta.url)),
      "@trainmap/exporter": fileURLToPath(new URL("./packages/exporter/src/index.ts", import.meta.url)),
      "@trainmap/geo": fileURLToPath(new URL("./packages/geo/src/index.ts", import.meta.url)),
      "@trainmap/importer": fileURLToPath(new URL("./packages/importer/src/index.ts", import.meta.url)),
      "@trainmap/timetable-adapters": fileURLToPath(new URL("./packages/timetable-adapters/src/index.ts", import.meta.url))
    }
  }
});
