"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { FeatureCollection, LineString, Point } from "geojson";
import type { Coordinate, LineStringGeometry, Trip } from "@trainmap/domain";
import { fitBoundsFromCoordinates, getGeometryForTripDetail } from "@trainmap/geo";
import { cn } from "@trainmap/ui";

const baseStyles = {
  light: process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT ?? "https://tiles.openfreemap.org/styles/bright",
  dark: process.env.NEXT_PUBLIC_MAP_STYLE_DARK ?? "https://tiles.openfreemap.org/styles/liberty",
  satellite: "https://api.maptiler.com/maps/hybrid/style.json?key=missing"
} as const;

const emptyRouteData: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: []
};

const emptyStationData: FeatureCollection<Point> = {
  type: "FeatureCollection",
  features: []
};

export function TransportMap({
  trips,
  selectedTripId,
  heightClass = "h-[520px]",
  showControls = true,
  showCaption = true,
  initialBaseStyle = "light",
  frame = "app"
}: {
  trips: Trip[];
  selectedTripId?: string;
  heightClass?: string;
  showControls?: boolean;
  showCaption?: boolean;
  initialBaseStyle?: keyof typeof baseStyles;
  frame?: "app" | "export";
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [baseStyle, setBaseStyle] = useState<keyof typeof baseStyles>(initialBaseStyle);
  const [loaded, setLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const visibleTrips = useMemo(
    () => (selectedTripId ? trips.filter((trip) => trip.id === selectedTripId) : trips),
    [selectedTripId, trips]
  );

  const routeData = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: "FeatureCollection",
      features: visibleTrips.flatMap(routeFeaturesForTrip)
    }),
    [visibleTrips]
  );

  const stationData = useMemo<FeatureCollection<Point>>(
    () => ({
      type: "FeatureCollection",
      features: visibleTrips.flatMap((trip) => {
        const stops = [...trip.stops].sort((a, b) => a.sequence - b.sequence);
        return stops.map((stop, index) => ({
          type: "Feature" as const,
          properties: {
            id: stop.id,
            tripId: trip.id,
            name: stop.stationName,
            sequence: stop.sequence,
            role: index === 0 ? "origin" : index === stops.length - 1 ? "destination" : "intermediate"
          },
          geometry: {
            type: "Point" as const,
            coordinates: stop.coordinates
          }
        }));
      })
    }),
    [visibleTrips]
  );

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    setLoaded(false);
    setMapReady(false);
    wrapperRef.current?.setAttribute("data-map-ready", "false");
    let readyTimer: number | undefined;
    const markMapReady = () => {
      setMapReady(true);
      wrapperRef.current?.setAttribute("data-map-ready", "true");
    };

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyles[baseStyle],
      center: [8.5, 47.3],
      zoom: 4,
      attributionControl: frame === "export" ? false : { compact: true }
    });

    mapRef.current = map;
    if (showControls) {
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    }

    if (frame === "export") {
      readyTimer = window.setTimeout(markMapReady, 12_000);
    }

    map.on("load", () => {
      setLoaded(true);
      addBusinessLayers(map, emptyRouteData, emptyStationData);
      map.triggerRepaint();
    });

    return () => {
      if (readyTimer) {
        window.clearTimeout(readyTimer);
      }
      map.remove();
      mapRef.current = null;
    };
  }, [baseStyle, frame, showControls]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) {
      return;
    }

    setMapReady(false);
    wrapperRef.current?.setAttribute("data-map-ready", "false");
    const routeSource = map.getSource("trainmap-routes") as maplibregl.GeoJSONSource | undefined;
    const stationSource = map.getSource("trainmap-stations") as maplibregl.GeoJSONSource | undefined;
    routeSource?.setData(routeData);
    stationSource?.setData(stationData);
    fitToTrips(map, routeData);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setMapReady(true);
        wrapperRef.current?.setAttribute("data-map-ready", "true");
      });
    });
  }, [loaded, routeData, stationData]);

  return (
    <div
      ref={wrapperRef}
      data-map-ready={mapReady ? "true" : "false"}
      className={cn(
        "relative overflow-hidden bg-ink",
        frame === "app" ? "rounded-md border border-black/10" : "rounded-none border-0",
        heightClass
      )}
    >
      <div ref={containerRef} className="h-full w-full" />
      {showControls ? (
        <div className="absolute left-3 top-3 flex rounded-md border border-black/10 bg-[#f8f5ef]/90 p-1 shadow-panel backdrop-blur">
          {(["light", "dark", "satellite"] as Array<keyof typeof baseStyles>).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => setBaseStyle(style)}
              className={cn(
                "rounded px-3 py-1.5 text-xs capitalize transition",
                baseStyle === style ? "bg-ink text-white" : "text-black/64 hover:bg-white"
              )}
            >
              {style}
            </button>
          ))}
        </div>
      ) : null}
      {showCaption ? (
        <div className="absolute bottom-3 left-3 rounded-md border border-black/10 bg-[#f8f5ef]/90 px-3 py-2 text-xs text-black/62 shadow-panel backdrop-blur">
      Business route, station, label, and coverage layers are independent from the basemap.
        </div>
      ) : null}
    </div>
  );
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

function routeColorExpression(): maplibregl.ExpressionSpecification {
  return [
    "case",
    [">", ["get", "segmentCount"], 1],
    [
      "match",
      ["get", "segmentIndex"],
      0,
      "#0f766e",
      1,
      "#7c3aed",
      2,
      "#ea580c",
      3,
      "#2563eb",
      4,
      "#be123c",
      "#475569"
    ],
    [
      "match",
      ["get", "confidence"],
      "exact",
      "#0f766e",
      "manual",
      "#9f1239",
      "#2563eb"
    ]
  ] as maplibregl.ExpressionSpecification;
}

function addBusinessLayers(
  map: maplibregl.Map,
  routeData: FeatureCollection<LineString>,
  stationData: FeatureCollection<Point>
) {
  map.addSource("trainmap-routes", {
    type: "geojson",
    data: routeData
  });
  map.addSource("trainmap-stations", {
    type: "geojson",
    data: stationData
  });

  map.addLayer({
    id: "trainmap-route-halo",
    type: "line",
    source: "trainmap-routes",
    paint: {
      "line-color": "#f8f5ef",
      "line-width": 8,
      "line-opacity": 0.72
    }
  });
  map.addLayer({
    id: "trainmap-route",
    type: "line",
    source: "trainmap-routes",
    paint: {
      "line-color": routeColorExpression(),
      "line-width": 4,
      "line-opacity": 0.95
    }
  });
  map.addLayer({
    id: "trainmap-stations-intermediate",
    type: "circle",
    source: "trainmap-stations",
    filter: ["==", ["get", "role"], "intermediate"],
    paint: {
      "circle-color": "#f8f5ef",
      "circle-stroke-color": "#111827",
      "circle-stroke-width": 1.25,
      "circle-radius": 3.5
    }
  });
  map.addLayer({
    id: "trainmap-stations-endpoints",
    type: "circle",
    source: "trainmap-stations",
    filter: ["in", ["get", "role"], ["literal", ["origin", "destination"]]],
    paint: {
      "circle-color": ["match", ["get", "role"], "origin", "#9f1239", "destination", "#0f766e", "#111827"],
      "circle-stroke-color": "#f8f5ef",
      "circle-stroke-width": 2.5,
      "circle-radius": 8
    }
  });
  map.addLayer({
    id: "trainmap-labels",
    type: "symbol",
    source: "trainmap-stations",
    filter: ["in", ["get", "role"], ["literal", ["origin", "destination"]]],
    layout: {
      "text-field": ["get", "name"],
      "text-size": 12,
      "text-offset": [0, 1.15],
      "text-anchor": "top"
    },
    paint: {
      "text-color": "#111827",
      "text-halo-color": "#f8f5ef",
      "text-halo-width": 1.5
    }
  });
}

function fitToTrips(map: maplibregl.Map, routeData: FeatureCollection<LineString>) {
  const coordinates = routeData.features.flatMap((feature) =>
    feature.geometry.coordinates.map((coordinate) => [coordinate[0], coordinate[1]] as Coordinate)
  );
  const bounds = fitBoundsFromCoordinates(coordinates);

  if (!bounds) {
    return;
  }

  map.fitBounds(
    [
      [bounds.west, bounds.south],
      [bounds.east, bounds.north]
    ],
    { padding: 70, duration: 0, maxZoom: 7 }
  );
}
