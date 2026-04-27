import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { getTimetableAdapter, listTimetableProviders } from "./adapters";
import {
  buildSwissOjpLocationInformationRequest,
  buildSwissOjpTripRequest,
  createSwissOpenDataAdapter,
  parseSwissOjpLocationInformationResponse,
  parseSwissOjpTripResponse
} from "./swiss-open-data";

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
      origin: { id: "8503000", name: "Zurich HB", coordinates: [8.5402, 47.3782] },
      destination: { id: "8300207", name: "Milano Centrale", coordinates: [9.2042, 45.4864] },
      departureAt: "2026-05-01T09:00:00Z"
    });

    expect(xml).toContain('<OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" version="2.0"');
    expect(xml).toContain("<siri:ServiceRequest>");
    expect(xml).toContain("<siri:RequestTimestamp>");
    expect(xml).toContain("<siri:RequestorRef>trainmap_test</siri:RequestorRef>");
    expect(xml).toContain("<siri:MessageIdentifier>");
    expect(xml).toContain("<OJPTripRequest>");
    expect(xml).toContain("<Origin>");
    expect(xml).toContain("<StopPlaceRef>8503000</StopPlaceRef>");
    expect(xml).toContain("<Name>");
    expect(xml).toContain("<Text>Zurich HB</Text>");
    expect(xml).toContain("<DepArrTime>2026-05-01T09:00:00Z</DepArrTime>");
    expect(xml).toContain("<IncludeTrackSections>true</IncludeTrackSections>");
    expect(xml).toContain("<IncludeLegProjection>true</IncludeLegProjection>");
    expect(xml).toContain("<IncludeIntermediateStops>true</IncludeIntermediateStops>");
    expect(xml).not.toContain("PtModeFilter");
    expect(xml).not.toContain("LocationName");
  });

  it("builds and parses Swiss OJP location search requests", () => {
    const xml = buildSwissOjpLocationInformationRequest({
      requestorRef: "trainmap_test",
      query: "Zurich HB"
    });
    const stations = parseSwissOjpLocationInformationResponse(sampleSwissOjpLocationResponse);

    expect(xml).toContain('<OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" version="2.0"');
    expect(xml).toContain("<siri:ServiceRequest>");
    expect(xml).toContain("<OJPLocationInformationRequest>");
    expect(xml).toContain("<InitialInput>");
    expect(xml).toContain("<Name>Zurich HB</Name>");
    expect(xml).toContain("<Type>stop</Type>");
    expect(xml).not.toContain("LocationName");
    expect(stations[0]).toEqual({
      id: "8503000",
      name: "Zurich HB",
      countryCode: "CH",
      coordinates: [8.5402, 47.3782]
    });
  });

  it("parses Swiss OJP stops and projected geometry", () => {
    const [option] = parseSwissOjpTripResponse(sampleSwissOjpResponse);

    expect(option.providerId).toBe("swiss_open_data");
    expect(option.trainCode).toBe("EC 317");
    expect(option.operatorName).toBe("Swiss Federal Railways SBB");
    expect(option.transferCount).toBe(0);
    expect(option.serviceSummary).toBe("Direct | EC 317");
    expect(option.stops.map((stop) => stop.stationName)).toEqual(["Zurich HB", "Lugano", "Milano Centrale"]);
    expect(option.geometry?.coordinates).toEqual([
      [8.5402, 47.3782],
      [8.95, 46.01],
      [9.2042, 45.4864]
    ]);
  });

  it("parses OJP 2.0 service metadata and merges same-station transfer stops", () => {
    const [option] = parseSwissOjpTripResponse(sampleSwissOjpTransferResponse);

    expect(option.trainCode).toBe("IC 61 + EC 317");
    expect(option.operatorName).toBe("Swiss Federal Railways SBB + Trasporti Pubblici Luganesi SA");
    expect(option.transferCount).toBe(1);
    expect(option.serviceSummary).toBe("1 transfer | IC 61 + EC 317");
    expect(option.stops.map((stop) => stop.stationName)).toEqual(["Bern", "Olten", "Lugano", "Milano Centrale"]);
    expect(option.stops[1].arrivalAt).toBe("2026-04-29T09:24:00Z");
    expect(option.stops[1].departureAt).toBe("2026-04-29T09:30:00Z");
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

  it("includes upstream response snippets in Swiss OJP errors without exposing credentials", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const metadata = listTimetableProviders()[0];
    const adapter = createSwissOpenDataAdapter(metadata, {
      apiKey: "super-secret-token",
      requestorRef: "trainmap_test",
      fetchImpl: async () =>
        new Response("<Problem>Invalid OJP request shape. Bearer accidental-token</Problem>", { status: 400 })
    });

    await expect(adapter.searchStations("Zurich HB")).rejects.toThrow(
      "Swiss Open Data OJP station_search request failed with HTTP 400 at https://api.opentransportdata.swiss/ojp20. Response: <Problem>Invalid OJP request shape. Bearer [redacted]</Problem>"
    );
    consoleError.mockRestore();
  });

  it("does not use token hash in runtime Swiss Open Data config", () => {
    const runtimeConfig = readFileSync(resolve(process.cwd(), "apps/web/src/lib/providers/swiss-open-data.ts"), "utf8");
    const composeConfig = readFileSync(resolve(process.cwd(), "infra/compose/docker-compose.yml"), "utf8");
    const envExample = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");

    expect(`${runtimeConfig}\n${composeConfig}\n${envExample}`).not.toMatch(/SWISS_OPEN_DATA_.*TOKEN_HASH/i);
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

const sampleSwissOjpTransferResponse = `<?xml version="1.0" encoding="UTF-8"?>
<OJPResponse xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri">
  <siri:ServiceDelivery>
    <OJPTripDelivery>
      <TripResponseContext>
        <Places>
          <Location>
            <siri:StopPointRef>ch:1:sloid:7000:5:10</siri:StopPointRef>
            <Name><Text>Bern</Text></Name>
            <GeoPosition><siri:Longitude>7.4391</siri:Longitude><siri:Latitude>46.9488</siri:Latitude></GeoPosition>
          </Location>
          <Location>
            <siri:StopPointRef>ch:1:sloid:218:4:7</siri:StopPointRef>
            <Name><Text>Olten</Text></Name>
            <GeoPosition><siri:Longitude>7.9079</siri:Longitude><siri:Latitude>47.3519</siri:Latitude></GeoPosition>
          </Location>
          <Location>
            <siri:StopPointRef>ch:1:sloid:218:7:12</siri:StopPointRef>
            <Name><Text>Olten</Text></Name>
            <GeoPosition><siri:Longitude>7.9078</siri:Longitude><siri:Latitude>47.3518</siri:Latitude></GeoPosition>
          </Location>
          <Location>
            <siri:StopPointRef>ch:1:sloid:5300:1:1</siri:StopPointRef>
            <Name><Text>Lugano</Text></Name>
            <GeoPosition><siri:Longitude>8.9462</siri:Longitude><siri:Latitude>46.0049</siri:Latitude></GeoPosition>
          </Location>
          <Location>
            <siri:StopPointRef>8301700</siri:StopPointRef>
            <Name><Text>Milano Centrale</Text></Name>
            <GeoPosition><siri:Longitude>9.2042</siri:Longitude><siri:Latitude>45.4864</siri:Latitude></GeoPosition>
          </Location>
        </Places>
      </TripResponseContext>
      <TripResult>
        <Id>result-bern-milan-transfer</Id>
        <Trip>
          <StartTime>2026-04-29T08:38:00Z</StartTime>
          <EndTime>2026-04-29T13:17:00Z</EndTime>
          <Transfers>1</Transfers>
          <Leg>
            <TimedLeg>
              <LegBoard>
                <siri:StopPointRef>ch:1:sloid:7000:5:10</siri:StopPointRef>
                <StopPointName><Text>Bern</Text></StopPointName>
                <ServiceDeparture><TimetabledTime>2026-04-29T08:38:00Z</TimetabledTime></ServiceDeparture>
                <Order>1</Order>
              </LegBoard>
              <LegAlight>
                <siri:StopPointRef>ch:1:sloid:218:4:7</siri:StopPointRef>
                <StopPointName><Text>Olten</Text></StopPointName>
                <ServiceArrival><TimetabledTime>2026-04-29T09:24:00Z</TimetabledTime></ServiceArrival>
                <Order>2</Order>
              </LegAlight>
              <Service>
                <PublishedServiceName><Text>IC</Text></PublishedServiceName>
                <TrainNumber>61</TrainNumber>
                <JourneyRef>ch:1:sjyid:ic-61</JourneyRef>
                <siri:OperatorRef>11</siri:OperatorRef>
              </Service>
            </TimedLeg>
          </Leg>
          <Leg>
            <TimedLeg>
              <LegBoard>
                <siri:StopPointRef>ch:1:sloid:218:7:12</siri:StopPointRef>
                <StopPointName><Text>Olten</Text></StopPointName>
                <ServiceDeparture><TimetabledTime>2026-04-29T09:30:00Z</TimetabledTime></ServiceDeparture>
                <Order>1</Order>
              </LegBoard>
              <LegIntermediate>
                <siri:StopPointRef>ch:1:sloid:5300:1:1</siri:StopPointRef>
                <StopPointName><Text>Lugano</Text></StopPointName>
                <ServiceArrival><TimetabledTime>2026-04-29T11:58:00Z</TimetabledTime></ServiceArrival>
                <ServiceDeparture><TimetabledTime>2026-04-29T12:02:00Z</TimetabledTime></ServiceDeparture>
                <Order>2</Order>
              </LegIntermediate>
              <LegAlight>
                <siri:StopPointRef>8301700</siri:StopPointRef>
                <StopPointName><Text>Milano Centrale</Text></StopPointName>
                <ServiceArrival><TimetabledTime>2026-04-29T13:17:00Z</TimetabledTime></ServiceArrival>
                <Order>3</Order>
              </LegAlight>
              <Service>
                <PublishedServiceName><Text>EC</Text></PublishedServiceName>
                <Extension><PublishedJourneyNumber>317</PublishedJourneyNumber></Extension>
                <JourneyRef>ch:1:sjyid:ec-317</JourneyRef>
                <siri:OperatorRef>955</siri:OperatorRef>
              </Service>
            </TimedLeg>
          </Leg>
        </Trip>
      </TripResult>
    </OJPTripDelivery>
  </siri:ServiceDelivery>
</OJPResponse>`;

const sampleSwissOjpLocationResponse = `<?xml version="1.0" encoding="UTF-8"?>
<siri:OJPResponse xmlns:siri="http://www.siri.org.uk/siri" xmlns:ojp="http://www.vdv.de/ojp">
  <siri:ServiceDelivery>
    <ojp:OJPLocationInformationDelivery>
      <ojp:Location>
        <ojp:Location>
          <ojp:StopPlace>
            <ojp:StopPlaceRef>8503000</ojp:StopPlaceRef>
            <ojp:StopPlaceName><ojp:Text>Zurich HB</ojp:Text></ojp:StopPlaceName>
          </ojp:StopPlace>
          <ojp:LocationName><ojp:Text>Zurich HB</ojp:Text></ojp:LocationName>
          <ojp:GeoPosition>
            <siri:Longitude>8.5402</siri:Longitude>
            <siri:Latitude>47.3782</siri:Latitude>
          </ojp:GeoPosition>
          <ojp:Complete>true</ojp:Complete>
        </ojp:Location>
      </ojp:Location>
    </ojp:OJPLocationInformationDelivery>
  </siri:ServiceDelivery>
</siri:OJPResponse>`;
