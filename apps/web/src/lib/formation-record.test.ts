import { describe, expect, it } from "vitest";
import type { TripStop } from "@trainmap/domain";
import { isFormationLiveQueryDate, normalizeStoredTrainFormation } from "./formation-record";

describe("formation records", () => {
  it("allows live Formation queries only on the Europe/Zurich operating day", () => {
    const now = new Date("2026-04-28T11:00:00.000Z");

    expect(isFormationLiveQueryDate("2026-04-28", "Europe/Zurich", now)).toBe(true);
    expect(isFormationLiveQueryDate("2026-04-27", "Europe/Zurich", now)).toBe(false);
    expect(isFormationLiveQueryDate("2026-04-29", "Europe/Zurich", now)).toBe(false);
  });

  it("normalizes old saved Formation strings with the current parser", () => {
    const record = normalizeStoredTrainFormation({
      provider: "swiss_train_formation",
      requestedAt: "2026-04-28T12:00:00Z",
      configured: true,
      summaries: [
        {
          evu: "SBBP",
          operationDate: "2026-04-28",
          trainNumber: "33",
          status: "available",
          endpoint: "https://example.test",
          formationStrings: ["@A,[1:10,:11,2:12]"]
        }
      ]
    });

    expect(record?.schemaVersion).toBe(2);
    expect(record?.archived).toBe(true);
    expect(record?.summaries[0].parsedFormationStrings[0].vehicles.map((vehicle) => vehicle.displayNumber)).toEqual(["10", "11", "12"]);
    expect(record?.summaries[0].parsedFormationStrings[0].vehicles[1].typeCode).toBe("1");
  });

  it("fills unavailable Formation stop names from saved OJP stops", () => {
    const referenceStops: TripStop[] = [
      referenceStop("8503000", "Zurich HB", 1),
      referenceStop("8301700", "Milano Centrale", 2)
    ];
    const record = normalizeStoredTrainFormation(
      {
        provider: "swiss_train_formation",
        requestedAt: "2026-04-28T12:00:00Z",
        configured: true,
        summaries: [
          {
            evu: "SBBP",
            operationDate: "2026-04-28",
            trainNumber: "33",
            status: "available",
            endpoint: "https://example.test",
            rawFormationStrings: ["@A,[1]", "@B,[2]"],
            stops: [
              { sequence: 1, name: "Zurich HB", uic: "8503000", formationString: "@A,[1]", vehicleGoals: [] },
              { sequence: 2, name: "Unknown stop", uic: "8301700", formationString: "@B,[2]", vehicleGoals: [] }
            ]
          }
        ]
      },
      referenceStops
    );

    expect(record?.summaries[0].stops?.map((stop) => stop.name)).toEqual(["Zurich HB", "Milano Centrale"]);
  });
});

function referenceStop(stationId: string, stationName: string, sequence: number): TripStop {
  return {
    id: `stop-${sequence}`,
    stationId,
    stationName,
    countryCode: stationId.startsWith("83") ? "IT" : "CH",
    coordinates: [8 + sequence, 47 - sequence],
    sequence,
    source: "provider",
    confidence: "matched"
  };
}
