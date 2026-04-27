"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { FeatureCollection, LineString, Point } from "geojson";
import type { Coordinate, Trip } from "@trainmap/domain";
import { fitBoundsFromCoordinates, getGeometryForTripDetail } from "@trainmap/geo";
import { cn } from "@trainmap/ui";

const baseStyles = {
  light: process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT ?? "https://tiles.openfreemap.org/styles/bright",
  dark: process.env.NEXT_PUBLIC_MAP_STYLE_DARK ?? "https://tiles.openfreemap.org/styles/liberty",
  satellite: "https://api.maptiler.com/maps/hybrid/style.json?key=missing"
} as const;

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
      features: visibleTrips.map((trip) => ({
        type: "Feature",
        properties: {
          id: trip.id,
          title: trip.title,
          confidence: trip.geometry?.confidence ?? "inferred",
          operator: trip.operatorName
        },
        geometry: getGeometryForTripDetail(trip)
      }))
    }),
    [visibleTrips]
  );

  const stationData = useMemo<FeatureCollection<Point>>(
    () => ({
      type: "FeatureCollection",
      features: visibleTrips.flatMap((trip) =>
        trip.stops.map((stop) => ({
          type: "Feature" as const,
          properties: {
            id: stop.id,
            tripId: trip.id,
            name: stop.stationName,
            sequence: stop.sequence
          },
          geometry: {
            type: "Point" as const,
            coordinates: stop.coordinates
          }
        }))
      )
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
    const markMapReadyAfterPaint = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(markMapReady);
      });
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
      addBusinessLayers(map, routeData, stationData);
      fitToTrips(map, routeData);
      map.once("render", markMapReadyAfterPaint);
      map.triggerRepaint();
    });

    return () => {
      if (readyTimer) {
        window.clearTimeout(readyTimer);
      }
      map.remove();
      mapRef.current = null;
    };
  }, [baseStyle, frame, routeData, showControls, stationData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) {
      return;
    }

    const routeSource = map.getSource("trainmap-routes") as maplibregl.GeoJSONSource | undefined;
    const stationSource = map.getSource("trainmap-stations") as maplibregl.GeoJSONSource | undefined;
    routeSource?.setData(routeData);
    stationSource?.setData(stationData);
    fitToTrips(map, routeData);
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
      "line-color": [
        "match",
        ["get", "confidence"],
        "exact",
        "#0f766e",
        "manual",
        "#9f1239",
        "#2563eb"
      ],
      "line-width": 4,
      "line-opacity": 0.95
    }
  });
  map.addLayer({
    id: "trainmap-stations",
    type: "circle",
    source: "trainmap-stations",
    paint: {
      "circle-color": "#f8f5ef",
      "circle-stroke-color": "#111827",
      "circle-stroke-width": 2,
      "circle-radius": 5
    }
  });
  map.addLayer({
    id: "trainmap-labels",
    type: "symbol",
    source: "trainmap-stations",
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
