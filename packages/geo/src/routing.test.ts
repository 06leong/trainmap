import { describe, expect, it } from "vitest";
import { demoTrips } from "@trainmap/domain";
import { fitBoundsFromCoordinates, getRoute, regenerateRouteGeometry } from "./routing";

describe("route generation", () => {
  it("uses manual vias and marks geometry as manual", () => {
    const trip = demoTrips[0];
    const result = getRoute({
      tripId: trip.id,
      stops: trip.stops,
      manualViaPoints: [
        {
          id: "via-basel",
          label: "Basel",
          coordinates: [7.5886, 47.5596],
          sequence: 2
        }
      ]
    });

    expect(result.confidence).toBe("manual");
    expect(result.geometry.coordinates).toContainEqual([7.5886, 47.5596]);
  });

  it("creates a new geometry version when regenerating", () => {
    const trip = demoTrips[1];
    const geometry = regenerateRouteGeometry(trip, []);

    expect(geometry.version).toBe(3);
    expect(geometry.confidence).toBe("inferred");
  });

  it("calculates fit bounds from route coordinates", () => {
    const bounds = fitBoundsFromCoordinates(demoTrips[0].geometry?.geometry.coordinates ?? []);

    expect(bounds).toEqual({
      west: 2.373,
      south: 47.322,
      east: 8.5402,
      north: 48.844
    });
  });
});
