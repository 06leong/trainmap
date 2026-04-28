import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { getTimetableAdapter, listTimetableProviders } from "./adapters";
import { swissBusinessOrganisationNames } from "./swiss-business-organisations.generated";
import {
  buildSwissTrainFormationUrl,
  fetchSwissTrainFormation,
  inferSwissTrainFormationQueries,
  normalizeSwissTrainFormationPayload,
  parseSwissFormationShortString,
  summarizeSwissTrainFormationPayload
} from "./swiss-formation";
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
    expect(option.routeSegments).toHaveLength(1);
    expect(option.routeSegments[0].trainCode).toBe("EC 317");
    expect(option.routeSegments[0].geometry?.coordinates).toEqual([
      [8.5402, 47.3782],
      [8.95, 46.01],
      [9.2042, 45.4864]
    ]);
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
    expect(option.routeSegments).toHaveLength(2);
    expect(option.routeSegments.map((segment) => segment.trainCode)).toEqual(["IC 61", "EC 317"]);
    expect(option.routeSegments[0].geometry?.coordinates).toEqual([
      [7.4391, 46.9488],
      [7.9079, 47.3519]
    ]);
    expect(option.routeSegments[1].geometry?.coordinates).toEqual([
      [7.9078, 47.3518],
      [8.9462, 46.0049],
      [9.2042, 45.4864]
    ]);
  });

  it("bundles Swiss Business Organisation names for OJP OperatorRef mapping", () => {
    expect(Object.keys(swissBusinessOrganisationNames).length).toBeGreaterThan(1000);
    expect(swissBusinessOrganisationNames["11"]).toBe("Swiss Federal Railways SBB");
    expect(swissBusinessOrganisationNames["955"]).toBe("Trasporti Pubblici Luganesi SA");
    expect(swissBusinessOrganisationNames["1183"]).toBe("Trenitalia S.p.A.");
  });

  it("builds Train Formation URLs from the versionless product base URL", () => {
    const url = buildSwissTrainFormationUrl("https://api.opentransportdata.swiss/formation", {
      evu: "SBBP",
      operationDate: "2026-04-27",
      trainNumber: "61"
    });

    expect(url).toBe(
      "https://api.opentransportdata.swiss/formation/v2/formations_full?evu=SBBP&operationDate=2026-04-27&trainNumber=61"
    );
  });

  it("allows a full Train Formation endpoint override", () => {
    const url = buildSwissTrainFormationUrl(
      "https://ignored.example.test/formation",
      {
        evu: "SBBP",
        operationDate: "2026-04-27",
        trainNumber: "61"
      },
      { fullEndpoint: "https://api.opentransportdata.swiss/formation/v2/formations_full" }
    );

    expect(url).toBe(
      "https://api.opentransportdata.swiss/formation/v2/formations_full?evu=SBBP&operationDate=2026-04-27&trainNumber=61"
    );
  });

  it("infers supported Train Formation queries from OJP service metadata", () => {
    const [option] = parseSwissOjpTripResponse(sampleSwissOjpTransferResponse);
    const queries = inferSwissTrainFormationQueries(option);

    expect(queries).toEqual([
      {
        evu: "SBBP",
        operationDate: "2026-04-29",
        trainNumber: "61",
        serviceLabel: "IC 61"
      }
    ]);
  });

  it("summarizes Train Formation payloads without depending on exact upstream nesting", () => {
    expect(
      summarizeSwissTrainFormationPayload({
        trainMetaInformation: { trainNumber: "61" },
        formationsAtScheduledStops: [
          {
            scheduledStop: { stopPoint: { uic: 8507000, name: "Bern" }, track: "5" },
            formationShort: { formationShortString: "@A,[1,2]" }
          },
          {
            scheduledStop: { stopPoint: { uic: 8500218, name: "Olten" }, track: "7" },
            formationShort: { formationShortString: "@B,[1,2]" }
          }
        ],
        formations: [{ metaInformation: { numberVehicles: 2 }, formationVehicles: [{ position: 1 }, { position: 2 }] }]
      })
    ).toEqual({
      formationStrings: ["@A,[1,2]", "@B,[1,2]"],
      rawFormationStrings: ["@A,[1,2]", "@B,[1,2]"],
      parsedFormationStrings: [
        parseSwissFormationShortString("@A,[1,2]"),
        parseSwissFormationShortString("@B,[1,2]")
      ],
      meta: {
        vehicleCount: 2
      },
      stops: [
        {
          sequence: 1,
          name: "Bern",
          uic: "8507000",
          track: "5",
          formationString: "@A,[1,2]",
          parsedFormation: parseSwissFormationShortString("@A,[1,2]"),
          vehicleGoals: []
        },
        {
          sequence: 2,
          name: "Olten",
          uic: "8500218",
          track: "7",
          formationString: "@B,[1,2]",
          parsedFormation: parseSwissFormationShortString("@B,[1,2]"),
          vehicleGoals: []
        }
      ],
      vehicles: [
        { position: 1, sectorsByStop: [] },
        { position: 2, sectorsByStop: [] }
      ],
      vehicleTypeLegend: expect.any(Object),
      serviceLegend: expect.any(Object),
      stopCount: 2,
      vehicleCount: 2
    });
  });

  it("parses Train Formation short strings into sectors, vehicles, services, and access markers", () => {
    const parsed = parseSwissFormationShortString("@A,F,F@B,[(LK,2:18,2#BHP;KW;NF,W2:14,1:13,LK)]@C,X,>2,%WR,-K,=12#VR");

    expect(parsed.sectors.map((sector) => sector.name)).toEqual(["A", "B", "C"]);
    expect(parsed.vehicles[2]).toMatchObject({
      typeCode: "LK",
      typeLabel: "Traction unit",
      inTrainGroup: true,
      groupStart: true,
      accessToPrevious: false
    });
    expect(parsed.vehicles[3]).toMatchObject({
      typeCode: "2",
      displayNumber: "18",
      typeLabel: "2nd class coach"
    });
    expect(parsed.vehicles[4].services).toEqual([
      { code: "BHP", label: "Wheelchair spaces", quantity: undefined },
      { code: "KW", label: "Pram platform", quantity: undefined },
      { code: "NF", label: "Low-floor access", quantity: undefined }
    ]);
    expect(parsed.vehicles[5]).toMatchObject({
      typeCode: "W2",
      displayNumber: "14",
      typeLabel: "Restaurant and 2nd class coach"
    });
    expect(parsed.vehicles[7]).toMatchObject({ groupEnd: true, accessToNext: false });
    expect(parsed.vehicles[9].statuses).toEqual([{ code: ">", label: "Vehicle with groups starting here" }]);
    expect(parsed.vehicles[10].statuses).toEqual([{ code: "%", label: "Open but restaurant not served" }]);
    expect(parsed.vehicles[11].statuses).toEqual([{ code: "-", label: "Closed" }]);
    expect(parsed.vehicles[12].statuses).toEqual([{ code: "=", label: "Reserved for through groups" }]);
  });

  it("normalizes Train Formation full payload stop and vehicle perspectives", () => {
    const normalized = normalizeSwissTrainFormationPayload(sampleSwissFormationFullPayload);

    expect(normalized.rawFormationStrings).toEqual(["@A,[(LK,2:18,2#BHP;KW;NF,W2:14,1:13,LK)]"]);
    expect(normalized.meta).toEqual({ lengthMeters: 201.5, vehicleCount: 5, seatCount: 320 });
    expect(normalized.stops?.[0]).toMatchObject({
      name: "Zürich HB",
      uic: "8503000",
      track: "8",
      formationString: "@A,[(LK,2:18,2#BHP;KW;NF,W2:14,1:13,LK)]"
    });
    expect(normalized.vehicles?.[0]).toMatchObject({
      position: 2,
      displayNumber: "18",
      evn: "93850000018-0",
      typeCodeName: "Apm",
      fromStopName: "Zürich HB",
      toStopName: "Basel SBB",
      firstClassSeats: 60,
      lowFloor: true,
      wheelchairAccessible: true,
      sectorsByStop: [{ stopName: "Zürich HB", sectors: "B" }]
    });
  });

  it("includes Train Formation error response snippets", async () => {
    const summary = await fetchSwissTrainFormation(
      {
        evu: "SBBP",
        operationDate: "2026-04-28",
        trainNumber: "577"
      },
      {
        apiKey: "token",
        fetchImpl: async () => new Response('{"error":"Requested endpoint is forbidden"}', { status: 403 })
      }
    );

    expect(summary.status).toBe("failed");
    expect(summary.endpoint).toBe(
      "https://api.opentransportdata.swiss/formation/v2/formations_full?evu=SBBP&operationDate=2026-04-28&trainNumber=577"
    );
    expect(summary.message).toContain("Response: {\"error\":\"Requested endpoint is forbidden\"}");
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

const sampleSwissFormationFullPayload = {
  trainMetaInformation: { trainNumber: 9226 },
  formationsAtScheduledStops: [
    {
      scheduledStop: {
        stopPoint: { uic: 8503000, name: "Zürich HB" },
        stopTime: { arrivalTime: "2026-04-28T10:00:00Z", departureTime: "2026-04-28T10:04:00Z" },
        track: "8"
      },
      formationShort: {
        formationShortString: "@A,[(LK,2:18,2#BHP;KW;NF,W2:14,1:13,LK)]",
        vehicleGoals: [
          {
            fromVehicleAtPosition: 1,
            toVehicleAtPosition: 5,
            destinationStopPoint: { uic: 8500010, name: "Basel SBB" }
          }
        ]
      }
    }
  ],
  formations: [
    {
      metaInformation: { length: 201.5, numberSeats: 320, numberVehicles: 5 },
      formationVehicles: [
        {
          position: 2,
          number: 18,
          vehicleIdentifier: { evn: "93850000018-0", parentEvn: "", typeCode: 6000, typeCodeName: "Apm" },
          formationVehicleAtScheduledStops: [
            {
              stopPoint: { uic: 8503000, name: "Zürich HB" },
              stopTime: { departureTime: "2026-04-28T10:04:00Z" },
              track: "8",
              sectors: "B",
              accessToPreviousVehicle: true
            }
          ],
          vehicleProperties: {
            length: 26.4,
            fromStop: { uic: 8503000, name: "Zürich HB" },
            toStop: { uic: 8500010, name: "Basel SBB" },
            number1class: 60,
            number2class: 0,
            numberBikeHooks: 0,
            lowFloorTrolley: true,
            closed: false,
            trolleyStatus: "Normal",
            accessibilityProperties: { numberWheelchairSpaces: 2 },
            pictoProperties: { wheelchairPicto: true, bikePicto: false, strollerPicto: true, familyZonePicto: false, businessZonePicto: true }
          }
        }
      ]
    }
  ]
};

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
              <LegProjection>
                <Point><siri:Longitude>7.4391</siri:Longitude><siri:Latitude>46.9488</siri:Latitude></Point>
                <Point><siri:Longitude>7.9079</siri:Longitude><siri:Latitude>47.3519</siri:Latitude></Point>
              </LegProjection>
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
              <LegProjection>
                <Point><siri:Longitude>7.9078</siri:Longitude><siri:Latitude>47.3518</siri:Latitude></Point>
                <Point><siri:Longitude>8.9462</siri:Longitude><siri:Latitude>46.0049</siri:Latitude></Point>
                <Point><siri:Longitude>9.2042</siri:Longitude><siri:Latitude>45.4864</siri:Latitude></Point>
              </LegProjection>
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
