import { describe, expect, it } from "vitest";
import type { Trip } from "@trainmap/domain";
import { buildTransportMapData } from "./transport-map-data";

describe("transport map data", () => {
  it("splits endpoint and intermediate station sources", () => {
    const trip = tripWithStops(6);
    const data = buildTransportMapData([trip]);

    expect(data.endpointStations.features).toHaveLength(2);
    expect(data.endpointStations.features.map((feature) => feature.properties?.role)).toEqual(["origin", "destination"]);
    expect(data.intermediateStations.features).toHaveLength(4);
    expect(data.intermediateStations.features.every((feature) => feature.properties?.role === "intermediate")).toBe(true);
  });

  it("keeps route segments independent from station sources", () => {
    const trip = {
      ...tripWithStops(3),
      rawImportRow: {
        routeSegments: [
          { sequence: 1, geometry: { type: "LineString", coordinates: [[8, 47], [8.5, 47.5]] } },
          { sequence: 2, geometry: { type: "LineString", coordinates: [[8.5, 47.5], [9, 48]] } }
        ]
      }
    } as Trip;
    const data = buildTransportMapData([trip]);

    expect(data.routes.features).toHaveLength(2);
    expect(data.routes.features.map((feature) => feature.properties?.segmentIndex)).toEqual([0, 1]);
    expect(data.endpointStations.features).toHaveLength(2);
    expect(data.intermediateStations.features).toHaveLength(1);
  });
});

function tripWithStops(count: number): Trip {
  const stops = Array.from({ length: count }, (_, index) => ({
    id: `stop-${index + 1}`,
    stationId: `station-${index + 1}`,
    stationName: `Station ${index + 1}`,
    countryCode: "CH",
    coordinates: [8 + index * 0.1, 47 + index * 0.1] as [number, number],
    sequence: index + 1,
    source: "provider" as const,
    confidence: "matched" as const
  }));

  return {
    id: "trip-1",
    title: "Test trip",
    mode: "rail",
    status: "completed",
    serviceClass: "second",
    date: "2026-04-28T10:00:00Z",
    operatorId: "operator-1",
    operatorName: "SBB",
    tagIds: [],
    countryCodes: ["CH"],
    distanceKm: 100,
    stops,
    segments: [],
    geometry: {
      id: "geometry-1",
      tripId: "trip-1",
      version: 1,
      source: "provider",
      confidence: "exact",
      geometry: {
        type: "LineString",
        coordinates: stops.map((stop) => stop.coordinates)
      },
      manualViaPoints: [],
      createdAt: "2026-04-28T10:00:00Z",
      createdBy: "test"
    },
    geometryVersions: [],
    createdAt: "2026-04-28T10:00:00Z",
    updatedAt: "2026-04-28T10:00:00Z"
  };
}
