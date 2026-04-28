import type { FeatureCollection, LineString, Point } from "geojson";
import type { Coordinate, LineStringGeometry, Trip } from "@trainmap/domain";
import { getGeometryForTripDetail } from "@trainmap/geo";

export interface TransportMapData {
  routes: FeatureCollection<LineString>;
  endpointStations: FeatureCollection<Point>;
  intermediateStations: FeatureCollection<Point>;
}

export const emptyTransportMapData: TransportMapData = {
  routes: { type: "FeatureCollection", features: [] },
  endpointStations: { type: "FeatureCollection", features: [] },
  intermediateStations: { type: "FeatureCollection", features: [] }
};

export function buildTransportMapData(trips: Trip[]): TransportMapData {
  const endpointStationFeatures: TransportMapData["endpointStations"]["features"] = [];
  const intermediateStationFeatures: TransportMapData["intermediateStations"]["features"] = [];

  for (const trip of trips) {
    const stops = [...trip.stops].sort((a, b) => a.sequence - b.sequence);
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
    });
  }

  return {
    routes: {
      type: "FeatureCollection",
      features: trips.flatMap(routeFeaturesForTrip)
    },
    endpointStations: {
      type: "FeatureCollection",
      features: endpointStationFeatures
    },
    intermediateStations: {
      type: "FeatureCollection",
      features: intermediateStationFeatures
    }
  };
}

function routeFeaturesForTrip(trip: Trip) {
  const routeSegments = routeSegmentsFromTrip(trip);
  if (routeSegments.length > 0) {
    return routeSegments.map((segment, index) => routeFeature(trip, segment.coordinates, index, routeSegments.length));
  }

  const geometry = getGeometryForTripDetail(trip);
  if (geometry.coordinates.length < 2) {
    return [];
  }

  return [routeFeature(trip, geometry.coordinates, 0, 1)];
}

function routeFeature(trip: Trip, coordinates: Coordinate[], segmentIndex: number, segmentCount: number) {
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
      coordinates
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
    Number.isFinite(value[1])
  );
}
