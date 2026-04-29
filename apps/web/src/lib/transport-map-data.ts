import type { FeatureCollection, LineString, Point } from "geojson";
import type { Coordinate, LineStringGeometry, Trip, TripStop } from "@trainmap/domain";
import { getGeometryForTripDetail } from "@trainmap/geo";

export interface TransportMapData {
  routes: FeatureCollection<LineString>;
  endpointStations: FeatureCollection<Point>;
  intermediateStations: FeatureCollection<Point>;
  labelStations: FeatureCollection<Point>;
  boundsCoordinates: Coordinate[];
  hasUsableGeometry: boolean;
}

export const emptyTransportMapData: TransportMapData = {
  routes: { type: "FeatureCollection", features: [] },
  endpointStations: { type: "FeatureCollection", features: [] },
  intermediateStations: { type: "FeatureCollection", features: [] },
  labelStations: { type: "FeatureCollection", features: [] },
  boundsCoordinates: [],
  hasUsableGeometry: false
};

export function buildTransportMapData(trips: Trip[]): TransportMapData {
  const endpointStationFeatures: TransportMapData["endpointStations"]["features"] = [];
  const intermediateStationFeatures: TransportMapData["intermediateStations"]["features"] = [];
  const labelStationFeatures: TransportMapData["labelStations"]["features"] = [];

  for (const trip of trips) {
    const stops = stationStopsForTrip(trip);
    stops.forEach((stop, index) => {
      const role = index === 0 ? "origin" : index === stops.length - 1 ? "destination" : "intermediate";
      const feature = {
        type: "Feature" as const,
        properties: {
          id: stop.id,
          tripId: trip.id,
          name: stop.stationName,
          sequence: stop.sequence,
          role
        },
        geometry: {
          type: "Point" as const,
          coordinates: stop.coordinates
        }
      };

      if (role === "intermediate") {
        intermediateStationFeatures.push(feature);
      } else {
        endpointStationFeatures.push(feature);
      }
      if (role !== "intermediate" || shouldLabelIntermediateStop(index, stops.length)) {
        labelStationFeatures.push({
          ...feature,
          properties: {
            ...feature.properties,
            labelPriority: role === "intermediate" ? 1 : 0
          }
        });
      }
    });
  }

  const routes = trips.flatMap(routeFeaturesForTrip);
  const routeCoordinates = routes.flatMap((feature) => feature.geometry.coordinates);
  const stationCoordinates = [...endpointStationFeatures, ...intermediateStationFeatures].map(
    (feature) => feature.geometry.coordinates as Coordinate
  );
  const boundsCoordinates = dedupeCoordinates([...routeCoordinates, ...stationCoordinates].filter(isCoordinate));

  return {
    routes: {
      type: "FeatureCollection",
      features: routes
    },
    endpointStations: {
      type: "FeatureCollection",
      features: endpointStationFeatures
    },
    intermediateStations: {
      type: "FeatureCollection",
      features: intermediateStationFeatures
    },
    labelStations: {
      type: "FeatureCollection",
      features: labelStationFeatures
    },
    boundsCoordinates,
    hasUsableGeometry: boundsCoordinates.length > 0
  };
}

function stationStopsForTrip(trip: Trip): TripStop[] {
  const persistedStops = [...trip.stops].filter((stop) => isCoordinate(stop.coordinates)).sort((a, b) => a.sequence - b.sequence);
  if (persistedStops.length > 0) {
    return dedupeStops(persistedStops);
  }

  const routeSegmentStops = routeStopsFromRawSegments(trip);
  if (routeSegmentStops.length > 0) {
    return dedupeStops(routeSegmentStops);
  }

  const geometry = getGeometryForTripDetail(trip);
  if (geometry.coordinates.length < 2) {
    return [];
  }

  const first = geometry.coordinates[0];
  const last = geometry.coordinates[geometry.coordinates.length - 1];
  return [
    fallbackStop(trip, "origin", first, 1),
    fallbackStop(trip, "destination", last, 2)
  ];
}

function routeFeaturesForTrip(trip: Trip) {
  const routeSegments = routeSegmentsFromTrip(trip);
  if (routeSegments.length > 0) {
    return routeSegments.map((segment, index) => routeFeature(trip, segment.coordinates, index, routeSegments.length));
  }

  const geometry = getGeometryForTripDetail(trip);
  const coordinates = geometry.coordinates.filter(isCoordinate);
  if (coordinates.length < 2) {
    return [];
  }

  return [routeFeature(trip, coordinates, 0, 1)];
}

function routeFeature(trip: Trip, coordinates: Coordinate[], segmentIndex: number, segmentCount: number) {
  const validCoordinates = coordinates.filter(isCoordinate);
  return {
    type: "Feature" as const,
    properties: {
      id: `${trip.id}-${segmentIndex}`,
      title: trip.title,
      confidence: trip.geometry?.confidence ?? "inferred",
      operator: trip.operatorName,
      segmentIndex,
      segmentCount
    },
    geometry: {
      type: "LineString" as const,
      coordinates: validCoordinates
    }
  };
}

function routeSegmentsFromTrip(trip: Trip): Array<{ sequence: number; coordinates: Coordinate[] }> {
  const routeSegments = trip.rawImportRow?.routeSegments;
  if (!Array.isArray(routeSegments)) {
    return [];
  }

  const parsedSegments: Array<{ sequence: number; coordinates: Coordinate[] }> = [];

  for (const routeSegment of routeSegments) {
    if (!routeSegment || typeof routeSegment !== "object") {
      continue;
    }
    const record = routeSegment as Record<string, unknown>;
    const coordinates = coordinatesFromRawRouteSegment(record);
    if (coordinates.length < 2) {
      continue;
    }
    parsedSegments.push({
      sequence: typeof record.sequence === "number" ? record.sequence : parsedSegments.length + 1,
      coordinates
    });
  }

  return parsedSegments.sort((left, right) => left.sequence - right.sequence);
}

function routeStopsFromRawSegments(trip: Trip): TripStop[] {
  const routeSegments = trip.rawImportRow?.routeSegments;
  if (!Array.isArray(routeSegments)) {
    return [];
  }

  const stops: TripStop[] = [];
  for (const routeSegment of routeSegments) {
    if (!routeSegment || typeof routeSegment !== "object") {
      continue;
    }
    const rawStops = (routeSegment as Record<string, unknown>).stops;
    if (!Array.isArray(rawStops)) {
      continue;
    }
    for (const rawStop of rawStops) {
      const stop = stopFromRawSegmentStop(rawStop, trip.id, stops.length + 1);
      if (stop) {
        stops.push(stop);
      }
    }
  }

  return stops.map((stop, index) => ({ ...stop, sequence: index + 1 }));
}

function stopFromRawSegmentStop(value: unknown, tripId: string, sequence: number): TripStop | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const coordinates = record.coordinates;
  if (!isCoordinate(coordinates)) {
    return null;
  }
  const stationId = stringValue(record.stationId) ?? stringValue(record.id) ?? `${tripId}-segment-stop-${sequence}`;
  return {
    id: stringValue(record.id) ?? `${tripId}-segment-stop-${sequence}`,
    stationId,
    stationName: stringValue(record.stationName) ?? stringValue(record.name) ?? `Stop ${sequence}`,
    countryCode: stringValue(record.countryCode) ?? "XX",
    coordinates,
    sequence,
    arrivalAt: stringValue(record.arrivalAt),
    departureAt: stringValue(record.departureAt),
    source: "provider",
    confidence: "matched"
  };
}

function fallbackStop(trip: Trip, role: "origin" | "destination", coordinates: Coordinate, sequence: number): TripStop {
  return {
    id: `${trip.id}-${role}`,
    stationId: `${trip.id}-${role}`,
    stationName: role === "origin" ? "Origin" : "Destination",
    countryCode: "XX",
    coordinates,
    sequence,
    source: "provider",
    confidence: "unmatched"
  };
}

function dedupeStops(stops: TripStop[]): TripStop[] {
  const deduped: TripStop[] = [];
  for (const stop of stops) {
    const previous = deduped[deduped.length - 1];
    if (previous && sameStop(previous, stop)) {
      deduped[deduped.length - 1] = {
        ...previous,
        arrivalAt: previous.arrivalAt ?? stop.arrivalAt,
        departureAt: stop.departureAt ?? previous.departureAt
      };
      continue;
    }
    deduped.push(stop);
  }
  return deduped.map((stop, index) => ({ ...stop, sequence: index + 1 }));
}

function sameStop(left: TripStop, right: TripStop): boolean {
  if (left.stationId && right.stationId && left.stationId === right.stationId) {
    return true;
  }
  return left.stationName === right.stationName && left.coordinates[0] === right.coordinates[0] && left.coordinates[1] === right.coordinates[1];
}

function coordinatesFromRawRouteSegment(record: Record<string, unknown>): Coordinate[] {
  const geometry = record.geometry;
  if (isLineStringGeometry(geometry)) {
    return geometry.coordinates;
  }

  const stops = record.stops;
  if (!Array.isArray(stops)) {
    return [];
  }

  return stops
    .map((stop) => {
      if (!stop || typeof stop !== "object") {
        return null;
      }
      const coordinates = (stop as Record<string, unknown>).coordinates;
      return isCoordinate(coordinates) ? coordinates : null;
    })
    .filter((coordinate): coordinate is Coordinate => coordinate !== null);
}

function shouldLabelIntermediateStop(index: number, stopCount: number): boolean {
  if (stopCount <= 4) {
    return true;
  }
  if (stopCount <= 8) {
    return index % 2 === 0;
  }
  const interval = Math.ceil((stopCount - 2) / 4);
  return index % interval === 0;
}

function dedupeCoordinates(coordinates: Coordinate[]): Coordinate[] {
  const seen = new Set<string>();
  const deduped: Coordinate[] = [];
  for (const coordinate of coordinates) {
    const key = `${coordinate[0].toFixed(6)},${coordinate[1].toFixed(6)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(coordinate);
  }
  return deduped;
}

function isLineStringGeometry(value: unknown): value is LineStringGeometry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.type === "LineString" && Array.isArray(candidate.coordinates) && candidate.coordinates.every(isCoordinate);
}

function isCoordinate(value: unknown): value is Coordinate {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
