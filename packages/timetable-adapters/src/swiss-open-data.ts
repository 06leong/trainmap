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
  services: SwissOpenDataServiceSummary[];
}

export interface SwissOpenDataServiceSummary {
  trainCode: string;
  operatorName?: string;
  journeyRef?: string;
  lineRef?: string;
  originText?: string;
  destinationText?: string;
  departureAt?: string;
  arrivalAt?: string;
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

type SwissOjpRequestKind = "station_search" | "trip_search";

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

    const response = await this.postXml(requestXml, "station_search");
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

    const response = await this.postXml(requestXml, "trip_search");
    return parseSwissOjpTripResponse(await response.text());
  }

  private async postXml(requestXml: string, kind: SwissOjpRequestKind): Promise<Response> {
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
      const responseBody = await response.text().catch(() => "");
      const snippet = sanitizeResponseSnippet(responseBody);
      const message = [
        `Swiss Open Data OJP ${kind} request failed with HTTP ${response.status} at ${this.endpoint}.`,
        snippet ? `Response: ${snippet}` : ""
      ]
        .filter(Boolean)
        .join(" ");
      console.error(message);
      throw new Error(message);
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
  const messageIdentifier = escapeXml(crypto.randomUUID());

  return `<?xml version="1.0" encoding="UTF-8"?>
<OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" version="2.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <OJPRequest>
    <siri:ServiceRequest>
      <siri:RequestTimestamp>${timestamp}</siri:RequestTimestamp>
      <siri:RequestorRef>${requestorRef}</siri:RequestorRef>
      <OJPTripRequest>
        <siri:RequestTimestamp>${timestamp}</siri:RequestTimestamp>
        <siri:MessageIdentifier>${messageIdentifier}</siri:MessageIdentifier>
        <Origin>
          ${placeRefXml(input.origin)}
          <DepArrTime>${departureAt}</DepArrTime>
        </Origin>
        <Destination>
          ${placeRefXml(input.destination)}
        </Destination>
        <Params>
          <NumberOfResults>${resultCount}</NumberOfResults>
          <IgnoreRealtimeData>false</IgnoreRealtimeData>
          <IncludeTrackSections>true</IncludeTrackSections>
          <IncludeLegProjection>true</IncludeLegProjection>
          <IncludeIntermediateStops>true</IncludeIntermediateStops>
        </Params>
      </OJPTripRequest>
    </siri:ServiceRequest>
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
  const messageIdentifier = escapeXml(crypto.randomUUID());

  return `<?xml version="1.0" encoding="UTF-8"?>
<OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" version="2.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <OJPRequest>
    <siri:ServiceRequest>
      <siri:RequestTimestamp>${timestamp}</siri:RequestTimestamp>
      <siri:RequestorRef>${requestorRef}</siri:RequestorRef>
      <OJPLocationInformationRequest>
        <siri:RequestTimestamp>${timestamp}</siri:RequestTimestamp>
        <siri:MessageIdentifier>${messageIdentifier}</siri:MessageIdentifier>
        <InitialInput>
          <Name>${escapeXml(input.query)}</Name>
        </InitialInput>
        <Restrictions>
          <Type>stop</Type>
          <NumberOfResults>${maxResults}</NumberOfResults>
          <IncludePtModes>true</IncludePtModes>
        </Restrictions>
      </OJPLocationInformationRequest>
    </siri:ServiceRequest>
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
      name: textContent(nearbyXml, "LocationName") ?? textContent(nearbyXml, "Name") ?? stopPlaceName ?? id,
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
  const services = timedLegs.map(parseTimedLegService).filter((service): service is SwissOpenDataServiceSummary => service !== null);
  const stops = mergeTransferStops(timedLegs.flatMap((timedLeg) => parseTimedLegStops(timedLeg, locationsByRef)));
  const geometry = geometryFromTripResult(tripResult, stops);
  const transferCount = transferCountFromTripResult(tripResult, timedLegs.length);
  const trainCode = trainCodeFromServices(services) ?? trainCodeFromTripResult(tripResult);
  const operatorName = operatorNameFromServices(services) ?? textContent(tripResult, "OperatorName") ?? "Unknown operator";

  if (stops.length < 2 && !geometry) {
    return null;
  }

  const firstStop = stops[0];
  const lastStop = stops[stops.length - 1];

  return {
    id: rawResultId,
    rawResultId,
    providerId: "swiss_open_data",
    trainCode,
    operatorName,
    departureAt: textContent(tripResult, "StartTime") ?? firstStop?.departureAt ?? "",
    arrivalAt: textContent(tripResult, "EndTime") ?? lastStop?.arrivalAt ?? "",
    origin: firstStop?.stationName ?? "Origin",
    destination: lastStop?.stationName ?? "Destination",
    stopCount: stops.length,
    transferCount,
    legCount: timedLegs.length,
    serviceSummary: serviceSummary(services, transferCount),
    services,
    stops,
    geometry
  };
}

function parseTimedLegStops(timedLeg: string, locationsByRef: Map<string, ParsedLocation>): TripStop[] {
  const stopBlocks = [
    ...blocks(timedLeg, "LegBoard"),
    ...blocks(timedLeg, "LegIntermediate"),
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
    const name =
      textContent(block, "StopPointName") ?? textContent(block, "LocationName") ?? textContent(block, "Name") ?? location?.name ?? ref ?? "Unknown stop";
    const stationId = ref ?? `swiss-open-data-stop-${sequence}`;
    const key = `${stationId}-${sequence}`;

    deduped.set(key, {
      id: `swiss-open-data-${stableIdPart(stationId)}-${sequence}`,
      stationId,
      stationName: name,
      countryCode: countryCodeFromRef(stationId),
      coordinates,
      sequence,
      arrivalAt: serviceTime(block, "ServiceArrival"),
      departureAt: serviceTime(block, "ServiceDeparture"),
      source: "provider",
      confidence: "matched"
    });
  }

  return [...deduped.values()].sort((a, b) => a.sequence - b.sequence).map((stop, index) => ({ ...stop, sequence: index + 1 }));
}

function parseTimedLegService(timedLeg: string): SwissOpenDataServiceSummary | null {
  const service = blocks(timedLeg, "Service")[0];
  if (!service) {
    return null;
  }

  const trainCode = serviceTrainCode(service);
  const operatorName = textContent(service, "OperatorName") ?? operatorRefLabel(textContent(service, "OperatorRef"));
  const firstStop = blocks(timedLeg, "LegBoard")[0];
  const lastStop = blocks(timedLeg, "LegAlight")[0];

  if (!trainCode && !operatorName) {
    return null;
  }

  return {
    trainCode: trainCode ?? "Unknown service",
    operatorName: operatorName ?? undefined,
    journeyRef: textContent(service, "JourneyRef") ?? undefined,
    lineRef: textContent(service, "LineRef") ?? undefined,
    originText: textContent(service, "OriginText") ?? undefined,
    destinationText: textContent(service, "DestinationText") ?? undefined,
    departureAt: firstStop ? serviceTime(firstStop, "ServiceDeparture") : undefined,
    arrivalAt: lastStop ? serviceTime(lastStop, "ServiceArrival") : undefined
  };
}

function mergeTransferStops(stops: TripStop[]): TripStop[] {
  const sortedStops = [...stops].sort((a, b) => a.sequence - b.sequence);
  const merged: TripStop[] = [];

  for (const stop of sortedStops) {
    const previous = merged[merged.length - 1];
    if (previous && samePhysicalStation(previous, stop)) {
      merged[merged.length - 1] = {
        ...previous,
        stationId: stableStationId(previous.stationId, stop.stationId),
        arrivalAt: previous.arrivalAt ?? stop.arrivalAt,
        departureAt: stop.departureAt ?? previous.departureAt,
        coordinates: previous.coordinates ?? stop.coordinates
      };
      continue;
    }

    merged.push({ ...stop });
  }

  return merged.map((stop, index) => ({
    ...stop,
    id: `${stop.id.replace(/-\d+$/g, "")}-${index + 1}`,
    sequence: index + 1
  }));
}

function samePhysicalStation(left: TripStop, right: TripStop): boolean {
  const leftKey = stopPlaceKey(left.stationId);
  const rightKey = stopPlaceKey(right.stationId);
  if (leftKey && rightKey && leftKey === rightKey) {
    return true;
  }

  return normalizeName(left.stationName) === normalizeName(right.stationName) && coordinatesClose(left.coordinates, right.coordinates);
}

function stopPlaceKey(stationId: string): string | null {
  const swissSloid = stationId.match(/^(ch:\d+:sloid:\d+)/i);
  if (swissSloid) {
    return swissSloid[1].toLowerCase();
  }
  if (/^\d{7}$/.test(stationId)) {
    return stationId;
  }
  return null;
}

function stableStationId(left: string, right: string): string {
  const leftKey = stopPlaceKey(left);
  const rightKey = stopPlaceKey(right);
  if (leftKey && leftKey === rightKey) {
    return leftKey;
  }
  return left || right;
}

function coordinatesClose(left: Coordinate, right: Coordinate): boolean {
  return Math.abs(left[0] - right[0]) < 0.002 && Math.abs(left[1] - right[1]) < 0.002;
}

function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function serviceTime(block: string, serviceElement: "ServiceArrival" | "ServiceDeparture"): string | undefined {
  const serviceBlock = blocks(block, serviceElement)[0];
  if (!serviceBlock) {
    return undefined;
  }

  return textContent(serviceBlock, "TimetabledTime") ?? textContent(serviceBlock, "EstimatedTime") ?? undefined;
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
      name: textContent(locationBlock, "LocationName") ?? textContent(locationBlock, "StopPlaceName") ?? textContent(locationBlock, "Name") ?? ref,
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
    return `<PlaceRef>
            <StopPlaceRef>${escapeXml(place.id)}</StopPlaceRef>
            <Name>
              <Text>${escapeXml(place.name)}</Text>
            </Name>
          </PlaceRef>`;
  }

  return `<PlaceRef>
            <GeoPosition>
              <siri:Longitude>${place.coordinates[0]}</siri:Longitude>
              <siri:Latitude>${place.coordinates[1]}</siri:Latitude>
            </GeoPosition>
            <Name>
              <Text>${escapeXml(place.name)}</Text>
            </Name>
          </PlaceRef>`;
}

function trainCodeFromTripResult(tripResult: string): string {
  const lineName = textContent(tripResult, "PublishedServiceName") ?? textContent(tripResult, "PublishedLineName");
  const journeyNumber =
    textContent(tripResult, "PublishedJourneyNumber") ?? textContent(tripResult, "TrainNumber") ?? textContent(tripResult, "PublicCode");

  return combineServiceCode(lineName, journeyNumber) ?? "Unknown service";
}

function trainCodeFromServices(services: SwissOpenDataServiceSummary[]): string | null {
  const codes = uniqueValues(services.map((service) => service.trainCode).filter((code) => code !== "Unknown service"));
  if (codes.length === 0) {
    return null;
  }
  return codes.join(" + ");
}

function operatorNameFromServices(services: SwissOpenDataServiceSummary[]): string | null {
  const operators = uniqueValues(services.map((service) => service.operatorName).filter((value): value is string => Boolean(value)));
  if (operators.length === 0) {
    return null;
  }
  return operators.join(" + ");
}

function serviceSummary(services: SwissOpenDataServiceSummary[], transferCount: number): string {
  const directness = transferCount === 0 ? "Direct" : `${transferCount} transfer${transferCount === 1 ? "" : "s"}`;
  const codes = trainCodeFromServices(services);
  return codes ? `${directness} | ${codes}` : directness;
}

function serviceTrainCode(service: string): string | null {
  const lineName =
    textContent(service, "PublishedServiceName") ??
    textContent(service, "PublishedLineName") ??
    textContent(service, "PublicCode") ??
    textContent(blocks(service, "ProductCategory")[0] ?? "", "ShortName") ??
    textContent(blocks(service, "Mode")[0] ?? "", "ShortName");
  const journeyNumber = textContent(service, "PublishedJourneyNumber") ?? textContent(service, "TrainNumber");

  return combineServiceCode(lineName, journeyNumber);
}

function combineServiceCode(lineName: string | null, journeyNumber: string | null): string | null {
  const normalizedLineName = lineName?.trim();
  const normalizedJourneyNumber = journeyNumber?.trim();

  if (normalizedLineName && normalizedJourneyNumber && !normalizedLineName.includes(normalizedJourneyNumber)) {
    return `${normalizedLineName} ${normalizedJourneyNumber}`;
  }
  return normalizedLineName || normalizedJourneyNumber || null;
}

function operatorRefLabel(operatorRef: string | null): string | null {
  return operatorRef ? `Operator ${operatorRef}` : null;
}

function transferCountFromTripResult(tripResult: string, timedLegCount: number): number {
  const transfers = Number(textContent(tripResult, "Transfers"));
  if (Number.isFinite(transfers)) {
    return Math.max(0, transfers);
  }
  return Math.max(0, timedLegCount - 1);
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
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

function sanitizeResponseSnippet(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .trim()
    .slice(0, 600);
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
