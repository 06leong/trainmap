import { describe, expect, it } from "vitest";
import { getTimetableAdapter, listTimetableProviders } from "./adapters";

describe("timetable adapters", () => {
  it("lists Europe-first provider adapters with stable capabilities", () => {
    const providers = listTimetableProviders();

    expect(providers.map((provider) => provider.id)).toEqual([
      "swiss_open_data",
      "db_api",
      "ns_api",
      "generic_gtfs"
    ]);
    expect(providers[0].capabilities.stopSequence).toBe(true);
  });

  it("returns schedule-assisted stop sequences through a provider boundary", async () => {
    const adapter = getTimetableAdapter("swiss_open_data");
    const options = await adapter.searchTrips({
      origin: "Zurich HB",
      destination: "Milano Centrale",
      departureDate: "2026-05-01"
    });
    const stops = await adapter.getTripStopSequence(options[0].id);

    expect(options[0].providerId).toBe("swiss_open_data");
    expect(stops.length).toBeGreaterThan(1);
    expect(stops[0].source).toBe("provider");
  });
});
