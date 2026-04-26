import { describe, expect, it } from "vitest";
import { demoStations } from "@trainmap/domain";
import { parseCsv } from "./csv";
import { buildImportCommitInput, buildImportPreview, inferColumnMapping, importRowFingerprint } from "./mapping";

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

  it("marks malformed rows invalid without dropping their raw values", () => {
    const preview = buildImportPreview(
      ["from_station_name,to_station_name,departure_date", '"Paris Gare de Lyon,Zurich HB,2025-05-18'].join("\n"),
      demoStations
    );

    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].status).toBe("invalid");
    expect(preview.rows[0].raw.__raw_line).toContain("Paris Gare de Lyon");
    expect(preview.rows[0].messages).toContain("Malformed quoted CSV row.");
  });

  it("keeps unknown station names in a reviewable unmatched state", () => {
    const preview = buildImportPreview(
      ["from_station_name,to_station_name,departure_date", "Unknown Central,Zurich HB,2025-05-18"].join("\n"),
      demoStations
    );

    expect(preview.counts.unmatched).toBe(1);
    expect(preview.rows[0].messages[0]).toContain("Origin station not matched");
  });

  it("fuzzy matches partial station names", () => {
    const preview = buildImportPreview(
      ["from_station_name,to_station_name,departure_date", "Zurich,Milano Centrale,2025-05-18"].join("\n"),
      demoStations
    );

    expect(preview.rows[0].status).toBe("fuzzy_matched");
    expect(preview.rows[0].fromStation.station?.name).toBe("Zurich HB");
  });

  it("cleans common encoding artifacts before matching", () => {
    const preview = buildImportPreview(
      "\uFEFFfrom_station_name,to_station_name,departure_date\nZurich\uFFFD HB,Milano Centrale,2025-05-18",
      demoStations
    );

    expect(preview.rows[0].status).toBe("matched");
    expect(preview.rows[0].fromStation.station?.name).toBe("Zurich HB");
  });

  it("builds deterministic commit rows for idempotent imports", () => {
    const preview = buildImportPreview(
      ["from_station_name,to_station_name,departure_date,operator", "Paris Gare de Lyon,Zurich HB,2025-05-18,SBB"].join("\n"),
      demoStations
    );
    const rowHash = importRowFingerprint(preview.rows[0]);
    const firstCommit = buildImportCommitInput(preview, "viaducttrip.csv");
    const secondCommit = buildImportCommitInput(preview, "viaducttrip.csv", new Set([rowHash]));

    expect(firstCommit.rows[0].tripInput).toBeDefined();
    expect(secondCommit.rows[0].tripInput).toBeUndefined();
    expect(secondCommit.rows[0].normalized.trainmap_duplicate).toBe(true);
  });
});
