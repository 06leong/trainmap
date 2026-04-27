import { describe, expect, it } from "vitest";
import { getTimetableAdapter, listTimetableProviders } from "./adapters";
import { buildSwissOjpTripRequest, createSwissOpenDataAdapter, parseSwissOjpTripResponse } from "./swiss-open-data";

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

  it("builds Swiss OJP TripRequest XML with route geometry flags", () => {
    const xml = buildSwissOjpTripRequest({
      requestorRef: "trainmap_test",
      origin: { name: "Zurich HB", coordinates: [8.5402, 47.3782] },
      destination: { name: "Milano Centrale", coordinates: [9.2042, 45.4864] },
      departureAt: "2026-05-01T09:00:00Z"
    });

    expect(xml).toContain("<ojp:IncludeTrackSections>true</ojp:IncludeTrackSections>");
    expect(xml).toContain("<ojp:IncludeLegProjection>true</ojp:IncludeLegProjection>");
    expect(xml).toContain("<ojp:IncludeIntermediateStops>true</ojp:IncludeIntermediateStops>");
    expect(xml).toContain("<ojp:PtMode>rail</ojp:PtMode>");
  });

  it("parses Swiss OJP stops and projected geometry", () => {
    const [option] = parseSwissOjpTripResponse(sampleSwissOjpResponse);

    expect(option.providerId).toBe("swiss_open_data");
    expect(option.trainCode).toBe("EC 317");
    expect(option.stops.map((stop) => stop.stationName)).toEqual(["Zurich HB", "Lugano", "Milano Centrale"]);
    expect(option.geometry?.coordinates).toEqual([
      [8.5402, 47.3782],
      [8.95, 46.01],
      [9.2042, 45.4864]
    ]);
  });

  it("posts Swiss OJP requests with required headers", async () => {
    const metadata = listTimetableProviders()[0];
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const adapter = createSwissOpenDataAdapter(metadata, {
      apiKey: "token",
      requestorRef: "trainmap_test",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(sampleSwissOjpResponse, { status: 200 });
      }
    });

    const [option] = await adapter.searchRoute({
      origin: { name: "Zurich HB", coordinates: [8.5402, 47.3782] },
      destination: { name: "Milano Centrale", coordinates: [9.2042, 45.4864] },
      departureAt: "2026-05-01T09:00:00Z"
    });

    expect(calls[0].url).toBe("https://api.opentransportdata.swiss/ojp20");
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer token");
    expect(option.stops).toHaveLength(3);
  });
});

const sampleSwissOjpResponse = `<?xml version="1.0" encoding="UTF-8"?>
<siri:OJPResponse xmlns:siri="http://www.siri.org.uk/siri" xmlns:ojp="http://www.vdv.de/ojp">
  <siri:ServiceDelivery>
    <ojp:OJPTripDelivery>
      <ojp:TripResponseContext>
        <ojp:Places>
          <ojp:Location>
            <siri:StopPointRef>8503000</siri:StopPointRef>
            <ojp:LocationName><ojp:Text>Zurich HB</ojp:Text></ojp:LocationName>
            <ojp:GeoPosition><siri:Longitude>8.5402</siri:Longitude><siri:Latitude>47.3782</siri:Latitude></ojp:GeoPosition>
          </ojp:Location>
          <ojp:Location>
            <siri:StopPointRef>8505300</siri:StopPointRef>
            <ojp:LocationName><ojp:Text>Lugano</ojp:Text></ojp:LocationName>
            <ojp:GeoPosition><siri:Longitude>8.95</siri:Longitude><siri:Latitude>46.01</siri:Latitude></ojp:GeoPosition>
          </ojp:Location>
          <ojp:Location>
            <siri:StopPointRef>8300207</siri:StopPointRef>
            <ojp:LocationName><ojp:Text>Milano Centrale</ojp:Text></ojp:LocationName>
            <ojp:GeoPosition><siri:Longitude>9.2042</siri:Longitude><siri:Latitude>45.4864</siri:Latitude></ojp:GeoPosition>
          </ojp:Location>
        </ojp:Places>
      </ojp:TripResponseContext>
      <ojp:TripResult>
        <ojp:ResultId>result-zurich-milan</ojp:ResultId>
        <ojp:Trip>
          <ojp:StartTime>2026-05-01T09:00:00Z</ojp:StartTime>
          <ojp:EndTime>2026-05-01T12:17:00Z</ojp:EndTime>
          <ojp:TripLeg>
            <ojp:TimedLeg>
              <ojp:LegBoard>
                <siri:StopPointRef>8503000</siri:StopPointRef>
                <ojp:StopPointName><ojp:Text>Zurich HB</ojp:Text></ojp:StopPointName>
                <ojp:ServiceDeparture><ojp:TimetabledTime>2026-05-01T09:00:00Z</ojp:TimetabledTime></ojp:ServiceDeparture>
                <ojp:Order>1</ojp:Order>
              </ojp:LegBoard>
              <ojp:LegIntermediates>
                <siri:StopPointRef>8505300</siri:StopPointRef>
                <ojp:StopPointName><ojp:Text>Lugano</ojp:Text></ojp:StopPointName>
                <ojp:ServiceArrival><ojp:TimetabledTime>2026-05-01T10:55:00Z</ojp:TimetabledTime></ojp:ServiceArrival>
                <ojp:ServiceDeparture><ojp:TimetabledTime>2026-05-01T10:57:00Z</ojp:TimetabledTime></ojp:ServiceDeparture>
                <ojp:Order>2</ojp:Order>
              </ojp:LegIntermediates>
              <ojp:LegAlight>
                <siri:StopPointRef>8300207</siri:StopPointRef>
                <ojp:StopPointName><ojp:Text>Milano Centrale</ojp:Text></ojp:StopPointName>
                <ojp:ServiceArrival><ojp:TimetabledTime>2026-05-01T12:17:00Z</ojp:TimetabledTime></ojp:ServiceArrival>
                <ojp:Order>3</ojp:Order>
              </ojp:LegAlight>
              <ojp:Service>
                <ojp:PublishedLineName><ojp:Text>EC</ojp:Text></ojp:PublishedLineName>
                <ojp:Extension><ojp:PublishedJourneyNumber>317</ojp:PublishedJourneyNumber></ojp:Extension>
                <ojp:Extension><ojp:OperatorName>Swiss Federal Railways SBB</ojp:OperatorName></ojp:Extension>
              </ojp:Service>
              <ojp:LegProjection>
                <ojp:Point><siri:Longitude>8.5402</siri:Longitude><siri:Latitude>47.3782</siri:Latitude></ojp:Point>
                <ojp:Point><siri:Longitude>8.9500</siri:Longitude><siri:Latitude>46.0100</siri:Latitude></ojp:Point>
                <ojp:Point><siri:Longitude>9.2042</siri:Longitude><siri:Latitude>45.4864</siri:Latitude></ojp:Point>
              </ojp:LegProjection>
            </ojp:TimedLeg>
          </ojp:TripLeg>
        </ojp:Trip>
      </ojp:TripResult>
    </ojp:OJPTripDelivery>
  </siri:ServiceDelivery>
</siri:OJPResponse>`;
