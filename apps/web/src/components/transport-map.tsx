"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { Coordinate, Trip } from "@trainmap/domain";
import { fitBoundsFromCoordinates } from "@trainmap/geo";
import { cn } from "@trainmap/ui";
import { buildTransportMapData, emptyTransportMapData, type TransportMapData } from "@/lib/transport-map-data";

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

  const mapData = useMemo(() => buildTransportMapData(visibleTrips), [visibleTrips]);

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
      addBusinessLayers(map, emptyTransportMapData);
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
    setBusinessLayerData(map, mapData);
    fitToTrips(map, mapData);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setMapReady(true);
        wrapperRef.current?.setAttribute("data-map-ready", "true");
      });
    });
  }, [loaded, mapData]);

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

function addBusinessLayers(map: maplibregl.Map, mapData: TransportMapData) {
  map.addSource("trainmap-routes", {
    type: "geojson",
    data: mapData.routes
  });
  map.addSource("trainmap-stations-endpoints", {
    type: "geojson",
    data: mapData.endpointStations
  });
  map.addSource("trainmap-stations-intermediate", {
    type: "geojson",
    data: mapData.intermediateStations
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
    source: "trainmap-stations-intermediate",
    paint: {
      "circle-color": "#f8f5ef",
      "circle-stroke-color": "#111827",
      "circle-stroke-width": 1.25,
      "circle-opacity": 0.86,
      "circle-radius": 3.5
    }
  });
  map.addLayer({
    id: "trainmap-stations-endpoint-halo",
    type: "circle",
    source: "trainmap-stations-endpoints",
    paint: {
      "circle-color": "#f8f5ef",
      "circle-radius": 12,
      "circle-opacity": 0.92
    }
  });
  map.addLayer({
    id: "trainmap-stations-endpoints",
    type: "circle",
    source: "trainmap-stations-endpoints",
    paint: {
      "circle-color": ["match", ["get", "role"], "origin", "#9f1239", "destination", "#0f766e", "#111827"],
      "circle-stroke-color": "#111827",
      "circle-stroke-width": 1.5,
      "circle-radius": 7.5
    }
  });
  map.addLayer({
    id: "trainmap-labels",
    type: "symbol",
    source: "trainmap-stations-endpoints",
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

function setBusinessLayerData(map: maplibregl.Map, mapData: TransportMapData) {
  const routeSource = map.getSource("trainmap-routes") as maplibregl.GeoJSONSource | undefined;
  const endpointSource = map.getSource("trainmap-stations-endpoints") as maplibregl.GeoJSONSource | undefined;
  const intermediateSource = map.getSource("trainmap-stations-intermediate") as maplibregl.GeoJSONSource | undefined;
  routeSource?.setData(mapData.routes);
  endpointSource?.setData(mapData.endpointStations);
  intermediateSource?.setData(mapData.intermediateStations);
}

function fitToTrips(map: maplibregl.Map, mapData: TransportMapData) {
  const routeCoordinates = mapData.routes.features.flatMap((feature) =>
    feature.geometry.coordinates.map((coordinate) => [coordinate[0], coordinate[1]] as Coordinate)
  );
  const stationCoordinates = [...mapData.endpointStations.features, ...mapData.intermediateStations.features].map(
    (feature) => [feature.geometry.coordinates[0], feature.geometry.coordinates[1]] as Coordinate
  );
  const coordinates = [...routeCoordinates, ...stationCoordinates];
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
