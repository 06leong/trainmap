import { describe, expect, it } from "vitest";
import { demoTrips } from "./seed";
import { calculateTripStats, filterTrips } from "./stats";

describe("trip stats", () => {
  it("calculates distance, country, and route confidence totals", () => {
    const stats = calculateTripStats(demoTrips);

    expect(stats.totalTrips).toBe(3);
    expect(stats.totalDistanceKm).toBe(1547);
    expect(stats.countryCount).toBe(5);
    expect(stats.confidence.manual).toBe(1);
    expect(stats.confidence.inferred).toBe(2);
  });

  it("filters by country, status, and text query", () => {
    const filtered = filterTrips(demoTrips, {
      countryCode: "CH",
      status: "needs_review",
      query: "milano"
    });

    expect(filtered.map((trip) => trip.id)).toEqual(["trip-zurich-milano"]);
  });
});
