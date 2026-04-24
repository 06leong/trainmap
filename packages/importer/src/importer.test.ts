import { describe, expect, it } from "vitest";
import { demoStations } from "@trainmap/domain";
import { parseCsv } from "./csv";
import { buildImportPreview, inferColumnMapping } from "./mapping";

describe("viaduct-style CSV import", () => {
  it("detects semicolon-delimited CSV and preserves quoted commas", () => {
    const parsed = parseCsv('from;to;notes\n"Paris, Lyon";Zurich HB;"window seat"');

    expect(parsed.delimiter).toBe(";");
    expect(parsed.rows[0].from).toBe("Paris, Lyon");
  });

  it("infers common viaduct column mappings", () => {
    const mapping = inferColumnMapping(["from_station_name", "to_station_name", "departure_date"]);

    expect(mapping.from_station_name).toBe("from_station_name");
    expect(mapping.to_station_name).toBe("to_station_name");
    expect(mapping.departure_date).toBe("departure_date");
  });

  it("separates matched, fuzzy, unmatched, and invalid rows", () => {
    const preview = buildImportPreview(
      [
        "from_station_name,to_station_name,departure_date,operator",
        "Paris Gare de Lyon,Zurich HB,2025-05-18,SBB",
        "Zurich,Milano Centrale,2025-06-02,SBB",
        "Unknown,Nowhere,2025-06-03,",
        "Amsterdam Centraal,Berlin Hbf,,DB"
      ].join("\n"),
      demoStations
    );

    expect(preview.counts.matched).toBe(1);
    expect(preview.counts.fuzzy_matched).toBe(1);
    expect(preview.counts.unmatched).toBe(1);
    expect(preview.counts.invalid).toBe(1);
  });
});
