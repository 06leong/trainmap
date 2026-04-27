import type { Coordinate, LineStringGeometry, TripStop } from "@trainmap/domain";
import type { StationSearchResult, TimetableAdapter, TimetableProviderMetadata, TimetableTripOption } from "./adapters";

export interface SwissOpenDataConfig {
  apiKey: string;
  endpoint?: string;
  requestorRef?: string;
  userAgent?: string;
  fetchImpl?: typeof fetch;
}

export interface SwissOpenDataRouteOption extends TimetableTripOption {
  geometry?: LineStringGeometry;
  stops: TripStop[];
  rawResultId: string;
}

export interface SwissOpenDataPlace {
  id?: string;
  name: string;
  coordinates: Coordinate;
}

export interface SwissOpenDataSearchInput {
  origin: SwissOpenDataPlace;
  destination: SwissOpenDataPlace;
  departureAt: string;
  numberOfResults?: number;
}

const defaultEndpoint = "https://api.opentransportdata.swiss/ojp20";
const defaultRequestorRef = "trainmap_test";
const defaultUserAgent = "trainmap/0.1";

export class SwissOpenDataAdapter implements TimetableAdapter {
  private readonly endpoint: string;
  private readonly requestorRef: string;
  private readonly userAgent: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly metadata: TimetableProviderMetadata,
    private readonly config: SwissOpenDataConfig
  ) {
    this.endpoint = config.endpoint ?? defaultEndpoint;
    this.requestorRef = config.requestorRef ?? defaultRequestorRef;
    this.userAgent = config.userAgent ?? defaultUserAgent;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  getProviderMetadata(): TimetableProviderMetadata {
    return this.metadata;
  }

  async searchStations(query: string): Promise<StationSearchResult[]> {
    const requestXml = buildSwissOjpLocationInformationRequest({
      query,
      requestorRef: this.requestorRef
    });

    const response = await this.postXml(requestXml);
    return parseSwissOjpLocationInformationResponse(await response.text());
  }

  async searchTrips(input: {
    origin: string;
    destination: string;
    departureDate: string;
    departureTime?: string;
  }): Promise<TimetableTripOption[]> {
    throw new Error(
      `Swiss Open Data live trip search requires coordinates. Received "${input.origin}" to "${input.destination}" for ${input.departureDate}.`
    );
  }

  async getTripStopSequence(): Promise<TripStop[]> {
    throw new Error("Swiss Open Data stop sequences are returned together with a TripRequest search result.");
  }

  async searchRoute(input: SwissOpenDataSearchInput): Promise<SwissOpenDataRouteOption[]> {
    const requestXml = buildSwissOjpTripRequest({
      ...input,
      requestorRef: this.requestorRef
    });

    const response = await this.postXml(requestXml);
    return parseSwissOjpTripResponse(await response.text());
  }

  private async postXml(requestXml: string): Promise<Response> {
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/xml",
        "User-Agent": this.userAgent
      },
      body: requestXml
    });

    if (!response.ok) {
      throw new Error(`Swiss Open Data OJP request failed with HTTP ${response.status}.`);
    }

    return response;
  }
}

export function createSwissOpenDataAdapter(
  metadata: TimetableProviderMetadata,
  config: SwissOpenDataConfig
): SwissOpenDataAdapter {
  return new SwissOpenDataAdapter(metadata, config);
}

export function buildSwissOjpTripRequest(input: SwissOpenDataSearchInput & { requestorRef?: string }): string {
  const timestamp = new Date().toISOString();
  const requestorRef = escapeXml(input.requestorRef ?? defaultRequestorRef);
  const departureAt = escapeXml(input.departureAt);
  const resultCount = Math.max(1, Math.min(input.numberOfResults ?? 3, 10));

  return `<?xml version="1.0" encoding="UTF-8"?>
<OJP xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://www.siri.org.uk/siri" version="2.0" xmlns:ojp="http://www.vdv.de/ojp">
  <OJPRequest>
    <ServiceRequest>
      <RequestTimestamp>${timestamp}</RequestTimestamp>
      <RequestorRef>${requestorRef}</RequestorRef>
      <ojp:OJPTripRequest>
        <RequestTimestamp>${timestamp}</RequestTimestamp>
        <ojp:Origin>
          ${placeRefXml(input.origin)}
          <ojp:DepArrTime>${departureAt}</ojp:DepArrTime>
        </ojp:Origin>
        <ojp:Destination>
          ${placeRefXml(input.destination)}
        </ojp:Destination>
        <ojp:Params>
          <ojp:NumberOfResults>${resultCount}</ojp:NumberOfResults>
          <ojp:IgnoreRealtimeData>false</ojp:IgnoreRealtimeData>
          <ojp:PtModeFilter>
            <ojp:Exclude>false</ojp:Exclude>
            <ojp:PtMode>rail</ojp:PtMode>
          </ojp:PtModeFilter>
          <ojp:IncludeTrackSections>true</ojp:IncludeTrackSections>
          <ojp:IncludeLegProjection>true</ojp:IncludeLegProjection>
          <ojp:IncludeIntermediateStops>true</ojp:IncludeIntermediateStops>
        </ojp:Params>
      </ojp:OJPTripRequest>
    </ServiceRequest>
  </OJPRequest>
</OJP>`;
}

export function buildSwissOjpLocationInformationRequest(input: {
  query: string;
  requestorRef?: string;
  maxResults?: number;
}): string {
  const timestamp = new Date().toISOString();
  const requestorRef = escapeXml(input.requestorRef ?? defaultRequestorRef);
  const maxResults = Math.max(1, Math.min(input.maxResults ?? 8, 20));

  return `<?xml version="1.0" encoding="UTF-8"?>
<OJP xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://www.siri.org.uk/siri" version="2.0" xmlns:ojp="http://www.vdv.de/ojp">
  <OJPRequest>
    <ServiceRequest>
      <RequestTimestamp>${timestamp}</RequestTimestamp>
      <RequestorRef>${requestorRef}</RequestorRef>
      <ojp:OJPLocationInformationRequest>
        <RequestTimestamp>${timestamp}</RequestTimestamp>
        <MessageIdentifier>${crypto.randomUUID()}</MessageIdentifier>
        <ojp:InitialInput>
          <ojp:LocationName>${escapeXml(input.query)}</ojp:LocationName>
        </ojp:InitialInput>
        <ojp:Restrictions>
          <ojp:Type>stop</ojp:Type>
          <ojp:NumberOfResults>${maxResults}</ojp:NumberOfResults>
          <ojp:IncludePtModes>true</ojp:IncludePtModes>
        </ojp:Restrictions>
      </ojp:OJPLocationInformationRequest>
    </ServiceRequest>
  </OJPRequest>
</OJP>`;
}

export function parseSwissOjpLocationInformationResponse(xml: string): StationSearchResult[] {
  const results: StationSearchResult[] = [];
  const stopPlaces = blocks(xml, "StopPlace");

  for (const stopPlace of stopPlaces) {
    const id = textContent(stopPlace, "StopPlaceRef") ?? textContent(stopPlace, "StopPointRef");
    const stopPlaceName = textContent(stopPlace, "StopPlaceName");
    if (!id) {
      continue;
    }

    const nearbyXml = xml.slice(Math.max(0, xml.indexOf(id) - 500), xml.indexOf(id) + 1500);
    const coordinates = coordinatesFromBlock(nearbyXml);

    if (!coordinates) {
      continue;
    }

    results.push({
      id,
      name: textContent(nearbyXml, "LocationName") ?? stopPlaceName ?? id,
      countryCode: countryCodeFromRef(id),
      coordinates
    });
  }

  return dedupeStations(results).slice(0, 12);
}

export function parseSwissOjpTripResponse(xml: string): SwissOpenDataRouteOption[] {
  const locationsByRef = parseLocationContext(xml);
  const tripResults = blocks(xml, "TripResult");

  return tripResults
    .map((tripResult, index) => routeOptionFromTripResult(tripResult, locationsByRef, index))
    .filter((option): option is SwissOpenDataRouteOption => option !== null);
}

function routeOptionFromTripResult(
  tripResult: string,
  locationsByRef: Map<string, ParsedLocation>,
  index: number
): SwissOpenDataRouteOption | null {
  const rawResultId = textContent(tripResult, "ResultId") ?? textContent(tripResult, "TripId") ?? `ojp-result-${index + 1}`;
  const timedLegs = blocks(tripResult, "TimedLeg");
  const stops = timedLegs.flatMap((timedLeg) => parseTimedLegStops(timedLeg, locationsByRef));
  const geometry = geometryFromTripResult(tripResult, stops);

  if (stops.length < 2 && !geometry) {
    return null;
  }

  const firstStop = stops[0];
  const lastStop = stops[stops.length - 1];

  return {
    id: rawResultId,
    rawResultId,
    providerId: "swiss_open_data",
    trainCode: trainCodeFromTripResult(tripResult),
    operatorName: textContent(tripResult, "OperatorName") ?? "Swiss Open Data",
    departureAt: textContent(tripResult, "StartTime") ?? firstStop?.departureAt ?? "",
    arrivalAt: textContent(tripResult, "EndTime") ?? lastStop?.arrivalAt ?? "",
    origin: firstStop?.stationName ?? "Origin",
    destination: lastStop?.stationName ?? "Destination",
    stopCount: stops.length,
    stops,
    geometry
  };
}

function parseTimedLegStops(timedLeg: string, locationsByRef: Map<string, ParsedLocation>): TripStop[] {
  const stopBlocks = [
    ...blocks(timedLeg, "LegBoard"),
    ...blocks(timedLeg, "LegIntermediates"),
    ...blocks(timedLeg, "LegAlight")
  ];
  const deduped = new Map<string, TripStop>();

  for (const block of stopBlocks) {
    const ref = textContent(block, "StopPointRef") ?? textContent(block, "StopPlaceRef");
    const location = ref ? locationsByRef.get(ref) : undefined;
    const coordinates = location?.coordinates ?? coordinatesFromBlock(block);

    if (!coordinates) {
      continue;
    }

    const sequence = Number(textContent(block, "Order")) || deduped.size + 1;
    const name = textContent(block, "StopPointName") ?? textContent(block, "LocationName") ?? location?.name ?? ref ?? "Unknown stop";
    const stationId = ref ?? `swiss-open-data-stop-${sequence}`;
    const key = `${stationId}-${sequence}`;

    deduped.set(key, {
      id: `swiss-open-data-${stableIdPart(stationId)}-${sequence}`,
      stationId,
      stationName: name,
      countryCode: countryCodeFromRef(stationId),
      coordinates,
      sequence,
      arrivalAt: textContent(block, "ServiceArrival") ?? undefined,
      departureAt: textContent(block, "ServiceDeparture") ?? undefined,
      source: "provider",
      confidence: "matched"
    });
  }

  return [...deduped.values()].sort((a, b) => a.sequence - b.sequence).map((stop, index) => ({ ...stop, sequence: index + 1 }));
}

function geometryFromTripResult(tripResult: string, stops: TripStop[]): LineStringGeometry | undefined {
  const projectedBlocks = [...blocks(tripResult, "LegProjection"), ...blocks(tripResult, "TrackSection")];
  const coordinates = projectedBlocks.flatMap((block) => coordinatesFromRepeatedPositions(block));
  const uniqueCoordinates = dedupeCoordinates(coordinates);

  if (uniqueCoordinates.length >= 2) {
    return { type: "LineString", coordinates: uniqueCoordinates };
  }

  if (stops.length >= 2) {
    return { type: "LineString", coordinates: stops.map((stop) => stop.coordinates) };
  }

  return undefined;
}

function parseLocationContext(xml: string): Map<string, ParsedLocation> {
  const locations = new Map<string, ParsedLocation>();

  for (const locationBlock of blocks(xml, "Location")) {
    const ref = textContent(locationBlock, "StopPointRef") ?? textContent(locationBlock, "StopPlaceRef");
    const coordinates = coordinatesFromBlock(locationBlock);
    if (!ref || !coordinates) {
      continue;
    }

    locations.set(ref, {
      ref,
      name: textContent(locationBlock, "LocationName") ?? textContent(locationBlock, "StopPlaceName") ?? ref,
      coordinates
    });
  }

  return locations;
}

function coordinatesFromRepeatedPositions(xml: string): Coordinate[] {
  const pointBlocks = [...blocks(xml, "Point"), ...blocks(xml, "GeoPosition")];
  if (pointBlocks.length > 0) {
    return pointBlocks.map(coordinatesFromBlock).filter((coordinate): coordinate is Coordinate => coordinate !== null);
  }

  const longitudes = values(xml, "Longitude").map(Number);
  const latitudes = values(xml, "Latitude").map(Number);
  const coordinates: Coordinate[] = [];

  for (let index = 0; index < Math.min(longitudes.length, latitudes.length); index += 1) {
    if (Number.isFinite(longitudes[index]) && Number.isFinite(latitudes[index])) {
      coordinates.push([longitudes[index], latitudes[index]]);
    }
  }

  return coordinates;
}

function coordinatesFromBlock(xml: string): Coordinate | null {
  const longitude = Number(textContent(xml, "Longitude"));
  const latitude = Number(textContent(xml, "Latitude"));

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }

  return [longitude, latitude];
}

function blocks(xml: string, localName: string): string[] {
  const expression = new RegExp(`<(?:[A-Za-z0-9_-]+:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${localName}>`, "gi");
  return [...xml.matchAll(expression)].map((match) => match[1]);
}

function values(xml: string, localName: string): string[] {
  const expression = new RegExp(`<(?:[A-Za-z0-9_-]+:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${localName}>`, "gi");
  return [...xml.matchAll(expression)].map((match) => decodeXml(match[1].replace(/<[^>]+>/g, "").trim()));
}

function textContent(xml: string, localName: string): string | null {
  return values(xml, localName)[0] ?? null;
}

function placeRefXml(place: SwissOpenDataPlace): string {
  if (place.id) {
    return `<ojp:PlaceRef>
            <ojp:StopPlaceRef>${escapeXml(place.id)}</ojp:StopPlaceRef>
            <ojp:GeoPosition>
              <Longitude>${place.coordinates[0]}</Longitude>
              <Latitude>${place.coordinates[1]}</Latitude>
            </ojp:GeoPosition>
            <ojp:LocationName>
              <ojp:Text>${escapeXml(place.name)}</ojp:Text>
            </ojp:LocationName>
          </ojp:PlaceRef>`;
  }

  return `<ojp:PlaceRef>
            <ojp:GeoPosition>
              <Longitude>${place.coordinates[0]}</Longitude>
              <Latitude>${place.coordinates[1]}</Latitude>
            </ojp:GeoPosition>
            <ojp:LocationName>
              <ojp:Text>${escapeXml(place.name)}</ojp:Text>
            </ojp:LocationName>
          </ojp:PlaceRef>`;
}

function trainCodeFromTripResult(tripResult: string): string {
  const lineName = textContent(tripResult, "PublishedLineName");
  const journeyNumber = textContent(tripResult, "PublishedJourneyNumber");

  return [lineName, journeyNumber].filter(Boolean).join(" ") || "OJP";
}

function countryCodeFromRef(ref: string): string {
  const uicCountryCodes: Record<string, string> = {
    "80": "DE",
    "81": "AT",
    "82": "LU",
    "83": "IT",
    "84": "NL",
    "85": "CH",
    "87": "FR",
    "88": "BE"
  };

  if (ref.startsWith("ch:")) {
    return "CH";
  }
  if (/^\d{7}$/.test(ref)) {
    return uicCountryCodes[ref.slice(0, 2)] ?? "XX";
  }
  if (/^[a-z]{2}:/i.test(ref)) {
    return ref.slice(0, 2).toUpperCase();
  }
  return "XX";
}

function dedupeStations(stations: StationSearchResult[]): StationSearchResult[] {
  return [...new Map(stations.map((station) => [station.id, station])).values()];
}

function dedupeCoordinates(coordinates: Coordinate[]): Coordinate[] {
  const deduped: Coordinate[] = [];
  for (const coordinate of coordinates) {
    const previous = deduped[deduped.length - 1];
    if (!previous || previous[0] !== coordinate[0] || previous[1] !== coordinate[1]) {
      deduped.push(coordinate);
    }
  }
  return deduped;
}

function stableIdPart(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "stop";
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXml(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

interface ParsedLocation {
  ref: string;
  name: string;
  coordinates: Coordinate;
}
