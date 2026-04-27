import type { LineStringGeometry, Trip, TripStop, TripStopInput } from "@trainmap/domain";
import { createSwissOpenDataAdapter, listTimetableProviders, type SwissOpenDataRouteOption } from "@trainmap/timetable-adapters";

export interface SwissOpenDataRefinement {
  stops: TripStopInput[];
  geometry: LineStringGeometry;
  notes: string;
  distanceKm: number;
}

export function isSwissOpenDataConfigured(): boolean {
  return Boolean(process.env.SWISS_OPEN_DATA_API_KEY?.trim());
}

export async function refineTripWithSwissOpenData(trip: Trip): Promise<SwissOpenDataRefinement> {
  const apiKey = process.env.SWISS_OPEN_DATA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("SWISS_OPEN_DATA_API_KEY is not configured.");
  }

  const sortedStops = [...trip.stops].sort((a, b) => a.sequence - b.sequence);
  const origin = sortedStops[0];
  const destination = sortedStops[sortedStops.length - 1];

  if (!origin || !destination) {
    throw new Error("At least two trip stops are required before Swiss Open Data refinement.");
  }

  const metadata = listTimetableProviders().find((provider) => provider.id === "swiss_open_data");
  if (!metadata) {
    throw new Error("Swiss Open Data provider metadata is not registered.");
  }

  const adapter = createSwissOpenDataAdapter(metadata, {
    apiKey,
    endpoint: process.env.SWISS_OPEN_DATA_OJP_ENDPOINT,
    requestorRef: process.env.SWISS_OPEN_DATA_REQUESTOR_REF ?? "trainmap_prod",
    userAgent: process.env.SWISS_OPEN_DATA_USER_AGENT ?? "trainmap/0.1"
  });

  const options = await adapter.searchRoute({
    origin: {
      name: origin.stationName,
      coordinates: origin.coordinates
    },
    destination: {
      name: destination.stationName,
      coordinates: destination.coordinates
    },
    departureAt: trip.date.includes("T") ? trip.date : `${trip.date}T09:00:00Z`,
    numberOfResults: 3
  });
  const selected = selectBestRouteOption(options);

  if (!selected?.geometry || selected.geometry.coordinates.length < 2) {
    throw new Error("Swiss Open Data did not return usable leg projection or track geometry.");
  }

  return {
    stops: toTripStopInputs(selected.stops.length >= 2 ? selected.stops : sortedStops),
    geometry: selected.geometry,
    notes: `Swiss Open Data OJP 2.0 result ${selected.rawResultId}; train ${selected.trainCode}; ${selected.stopCount} stops.`,
    distanceKm: estimateDistanceKm(selected.geometry)
  };
}

function selectBestRouteOption(options: SwissOpenDataRouteOption[]): SwissOpenDataRouteOption | undefined {
  return [...options].sort((a, b) => {
    const geometryDelta = (b.geometry?.coordinates.length ?? 0) - (a.geometry?.coordinates.length ?? 0);
    if (geometryDelta !== 0) {
      return geometryDelta;
    }
    return b.stopCount - a.stopCount;
  })[0];
}

function toTripStopInputs(stops: TripStop[]): TripStopInput[] {
  return stops.map((stop, index) => ({
    stationId: stop.stationId,
    stationName: stop.stationName,
    countryCode: stop.countryCode,
    coordinates: stop.coordinates,
    sequence: index + 1,
    arrivalAt: stop.arrivalAt,
    departureAt: stop.departureAt,
    source: "provider",
    confidence: "matched"
  }));
}

function estimateDistanceKm(geometry: LineStringGeometry): number {
  let distance = 0;
  for (let index = 0; index < geometry.coordinates.length - 1; index += 1) {
    distance += distanceBetween(geometry.coordinates[index], geometry.coordinates[index + 1]);
  }
  return Math.round(distance);
}

function distanceBetween(from: [number, number], to: [number, number]): number {
  const earthRadiusKm = 6371;
  const fromLatitude = degreesToRadians(from[1]);
  const toLatitude = degreesToRadians(to[1]);
  const deltaLatitude = degreesToRadians(to[1] - from[1]);
  const deltaLongitude = degreesToRadians(to[0] - from[0]);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}
