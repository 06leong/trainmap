import type {
  Coordinate,
  LineStringGeometry,
  ManualViaPoint,
  RouteConfidence,
  Trip,
  TripGeometry,
  TripGeometryVersion,
  TripStop
} from "@trainmap/domain";

export interface RouteRequest {
  tripId: string;
  stops: TripStop[];
  manualViaPoints?: ManualViaPoint[];
  exactGeometry?: LineStringGeometry;
  createdBy?: string;
}

export interface RouteResult {
  geometry: LineStringGeometry;
  confidence: RouteConfidence;
  source: "generated" | "manual" | "provider";
  warnings: string[];
}

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function getRoute(request: RouteRequest): RouteResult {
  const sortedStops = [...request.stops].sort((a, b) => a.sequence - b.sequence);
  const manualViaPoints = [...(request.manualViaPoints ?? [])].sort((a, b) => a.sequence - b.sequence);
  const warnings: string[] = [];

  if (request.exactGeometry && request.exactGeometry.coordinates.length >= 2) {
    return {
      geometry: request.exactGeometry,
      confidence: "exact",
      source: "provider",
      warnings
    };
  }

  if (sortedStops.length < 2) {
    warnings.push("At least two stops are required to generate route geometry.");
    return {
      geometry: { type: "LineString", coordinates: sortedStops.map((stop) => stop.coordinates) },
      confidence: "inferred",
      source: "generated",
      warnings
    };
  }

  const coordinates = interleaveStopsAndVias(sortedStops, manualViaPoints);

  return {
    geometry: densifyLine({ type: "LineString", coordinates }, manualViaPoints.length > 0 ? 0 : 1),
    confidence: manualViaPoints.length > 0 ? "manual" : "inferred",
    source: manualViaPoints.length > 0 ? "manual" : "generated",
    warnings
  };
}

export function loadConnectionsOrSetManualVias(request: RouteRequest): RouteResult {
  return getRoute(request);
}

export function regenerateRouteGeometry(trip: Trip, manualViaPoints: ManualViaPoint[]): TripGeometry {
  const route = getRoute({
    tripId: trip.id,
    stops: trip.stops,
    manualViaPoints,
    createdBy: "user"
  });
  const previousVersion = trip.geometry?.version ?? 0;

  return {
    id: `${trip.id}-geometry-v${previousVersion + 1}`,
    tripId: trip.id,
    version: previousVersion + 1,
    source: route.source,
    confidence: route.confidence,
    geometry: route.geometry,
    manualViaPoints,
    createdAt: new Date().toISOString(),
    createdBy: "user",
    notes: route.warnings.join(" ")
  };
}

export function createGeometryVersion(
  current: TripGeometry,
  changeSummary: string,
  parentGeometryId?: string
): TripGeometryVersion {
  return {
    ...current,
    parentGeometryId,
    changeSummary
  };
}

export function getGeometryForTripDetail(trip: Trip): LineStringGeometry {
  if (trip.geometry?.geometry.coordinates.length) {
    return trip.geometry.geometry;
  }

  return {
    type: "LineString",
    coordinates: [...trip.stops]
      .sort((a, b) => a.sequence - b.sequence)
      .map((stop) => stop.coordinates)
  };
}

export function fitBoundsFromCoordinates(coordinates: Coordinate[]): Bounds | null {
  if (coordinates.length === 0) {
    return null;
  }

  const [first] = coordinates;
  const bounds: Bounds = {
    west: first[0],
    south: first[1],
    east: first[0],
    north: first[1]
  };

  for (const [longitude, latitude] of coordinates) {
    bounds.west = Math.min(bounds.west, longitude);
    bounds.south = Math.min(bounds.south, latitude);
    bounds.east = Math.max(bounds.east, longitude);
    bounds.north = Math.max(bounds.north, latitude);
  }

  return bounds;
}

function interleaveStopsAndVias(stops: TripStop[], vias: ManualViaPoint[]): Coordinate[] {
  const coordinates: Coordinate[] = [];

  for (const stop of stops) {
    coordinates.push(stop.coordinates);
    for (const via of vias.filter((candidate) => candidate.sequence === stop.sequence + 1)) {
      coordinates.push(via.coordinates);
    }
  }

  const maxStopSequence = Math.max(...stops.map((stop) => stop.sequence));
  for (const via of vias.filter((candidate) => candidate.sequence > maxStopSequence)) {
    coordinates.push(via.coordinates);
  }

  return coordinates;
}

function densifyLine(geometry: LineStringGeometry, midpointCount: number): LineStringGeometry {
  if (midpointCount <= 0 || geometry.coordinates.length < 2) {
    return geometry;
  }

  const coordinates: Coordinate[] = [];
  for (let index = 0; index < geometry.coordinates.length - 1; index += 1) {
    const start = geometry.coordinates[index];
    const end = geometry.coordinates[index + 1];
    coordinates.push(start);
    coordinates.push([(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]);
  }
  coordinates.push(geometry.coordinates[geometry.coordinates.length - 1]);

  return { type: "LineString", coordinates };
}
