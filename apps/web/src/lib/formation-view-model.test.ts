import { describe, expect, it } from "vitest";
import type { TripStop } from "@trainmap/domain";
import { parseSwissFormationShortString, type SwissTrainFormationSummary } from "@trainmap/timetable-adapters";
import { buildFormationViewModel, stopLabel } from "./formation-view-model";

describe("formation view model", () => {
  it("turns CUS short strings into passenger-facing coaches", () => {
    const viewModel = buildFormationViewModel(
      summaryWithFormation("@B,F,[(LK,2:3#BHP;KW;NF,W2:4,1:5,:6,WR:7,X)]"),
      [referenceStop("8503000", "Zurich HB", 1), referenceStop("8301700", "Milano Centrale", 2)]
    );

    expect(viewModel.title).toBe("Zurich HB -> Milano Centrale");
    expect(viewModel.coaches.map((coach) => coach.coachNumber)).toEqual(["3", "4", "5", "6", "7"]);
    expect(viewModel.coaches.map((coach) => coach.classLabel)).toEqual(["2", "2", "1", "1", "dining"]);
    expect(viewModel.coaches[0].services.map((service) => service.icon)).toEqual(["wheelchair", "stroller", "lowFloor"]);
    expect(viewModel.coaches[1].services.map((service) => service.icon)).toContain("restaurant");
    expect(viewModel.diagnostics.hiddenVehicleCount).toBe(3);
  });

  it("fills foreign stop names from OJP reference stops", () => {
    const summary = summaryWithFormation("@A,[1:10]", [
      { sequence: 1, name: "Zurich HB", uic: "8503000", formationString: "@A,[1:10]", parsedFormation: parseSwissFormationShortString("@A,[1:10]"), vehicleGoals: [] },
      { sequence: 2, name: "Unknown stop", uic: "8301700", formationString: "@A,[1:10]", parsedFormation: parseSwissFormationShortString("@A,[1:10]"), vehicleGoals: [] }
    ]);
    const viewModel = buildFormationViewModel(summary, [
      referenceStop("8503000", "Zurich HB", 1),
      referenceStop("8301700", "Milano Centrale", 2)
    ], 1);

    expect(viewModel.selectedStop.name).toBe("Milano Centrale");
    expect(stopLabel(viewModel.selectedStop, 1)).toBe("2 - Milano Centrale - track unavailable");
  });
});

function summaryWithFormation(formationString: string, stops = [
  { sequence: 1, name: "Zurich HB", uic: "8503000", track: "7", formationString, parsedFormation: parseSwissFormationShortString(formationString), vehicleGoals: [] }
]): SwissTrainFormationSummary {
  return {
    evu: "SBBP",
    operationDate: "2026-04-28",
    trainNumber: "33",
    serviceLabel: "EC 33",
    status: "available",
    endpoint: "https://example.test",
    formationStrings: [formationString],
    rawFormationStrings: [formationString],
    parsedFormationStrings: [parseSwissFormationShortString(formationString)],
    stops,
    vehicles: [
      { position: 3, displayNumber: "3", typeCodeName: "B", secondClassSeats: 80, sectorsByStop: [] },
      { position: 4, displayNumber: "4", typeCodeName: "WRB", secondClassSeats: 40, sectorsByStop: [] },
      { position: 5, displayNumber: "5", typeCodeName: "A", firstClassSeats: 50, sectorsByStop: [] },
      { position: 6, displayNumber: "6", typeCodeName: "A", firstClassSeats: 50, sectorsByStop: [] },
      { position: 7, displayNumber: "7", typeCodeName: "WR", sectorsByStop: [] }
    ],
    vehicleTypeLegend: {},
    serviceLegend: {}
  };
}

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
