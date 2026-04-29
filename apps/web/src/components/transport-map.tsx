"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { Coordinate, Trip } from "@trainmap/domain";
import { fitBoundsFromCoordinates } from "@trainmap/geo";
import { cn } from "@trainmap/ui";
import { buildTransportMapData, emptyTransportMapData, type TransportMapData } from "@/lib/transport-map-data";

export type TransportMapMode = "overview" | "detail" | "preview" | "export";

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
  frame = "app",
  mapMode
}: {
  trips: Trip[];
  selectedTripId?: string;
  heightClass?: string;
  showControls?: boolean;
  showCaption?: boolean;
  initialBaseStyle?: keyof typeof baseStyles;
  frame?: "app" | "export";
  mapMode?: TransportMapMode;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [baseStyle, setBaseStyle] = useState<keyof typeof baseStyles>(initialBaseStyle);
  const [loaded, setLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const resolvedMapMode: TransportMapMode = mapMode ?? (frame === "export" ? "export" : "overview");
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
      addBusinessLayers(map, emptyTransportMapData, resolvedMapMode);
      map.triggerRepaint();
    });

    return () => {
      if (readyTimer) {
        window.clearTimeout(readyTimer);
      }
      map.remove();
      mapRef.current = null;
    };
  }, [baseStyle, frame, resolvedMapMode, showControls]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) {
      return;
    }

    setMapReady(false);
    wrapperRef.current?.setAttribute("data-map-ready", "false");
    updateMapDataAndFit(map, mapData, resolvedMapMode);
    const readyFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setMapReady(true);
        wrapperRef.current?.setAttribute("data-map-ready", "true");
      });
    });
    return () => window.cancelAnimationFrame(readyFrame);
  }, [loaded, mapData, resolvedMapMode]);

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

function routeColorExpression(mapMode: TransportMapMode): maplibregl.ExpressionSpecification | string {
  if (mapMode === "detail" || mapMode === "preview") {
    return "#111827";
  }
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

function addBusinessLayers(map: maplibregl.Map, mapData: TransportMapData, mapMode: TransportMapMode) {
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
  map.addSource("trainmap-station-labels", {
    type: "geojson",
    data: labelsForMode(mapData, mapMode)
  });

  map.addLayer({
    id: "trainmap-route-halo",
    type: "line",
    source: "trainmap-routes",
    paint: {
      "line-color": "#f8f5ef",
      "line-width": mapMode === "detail" || mapMode === "preview" ? 12 : 9,
      "line-opacity": 0.88
    }
  });
  map.addLayer({
    id: "trainmap-route-casing",
    type: "line",
    source: "trainmap-routes",
    paint: {
      "line-color": "#111827",
      "line-width": mapMode === "detail" || mapMode === "preview" ? 7 : 5.5,
      "line-opacity": 0.94
    }
  });
  map.addLayer({
    id: "trainmap-route",
    type: "line",
    source: "trainmap-routes",
    paint: {
      "line-color": routeColorExpression(mapMode),
      "line-width": mapMode === "detail" || mapMode === "preview" ? 5 : 3.5,
      "line-opacity": 0.98
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
      "circle-opacity": mapMode === "overview" || mapMode === "export" ? 0.72 : 0.92,
      "circle-radius": mapMode === "overview" || mapMode === "export" ? 3.2 : 4.6
    }
  });
  map.addLayer({
    id: "trainmap-stations-endpoint-halo",
    type: "circle",
    source: "trainmap-stations-endpoints",
    paint: {
      "circle-color": "#f8f5ef",
      "circle-radius": mapMode === "overview" || mapMode === "export" ? 11 : 14,
      "circle-opacity": 0.92
    }
  });
  map.addLayer({
    id: "trainmap-stations-endpoints",
    type: "circle",
    source: "trainmap-stations-endpoints",
    paint: {
      "circle-color": "#111827",
      "circle-stroke-color": "#f8f5ef",
      "circle-stroke-width": 2,
      "circle-radius": mapMode === "overview" || mapMode === "export" ? 7 : 8.5
    }
  });
  map.addLayer({
    id: "trainmap-labels",
    type: "symbol",
    source: "trainmap-station-labels",
    layout: {
      "text-field": ["get", "name"],
      "text-size": mapMode === "detail" || mapMode === "preview" ? 13 : 11,
      "text-offset": [0, 1.2],
      "text-anchor": "top",
      "text-allow-overlap": false,
      "text-ignore-placement": false
    },
    paint: {
      "text-color": "#111827",
      "text-halo-color": "#f8f5ef",
      "text-halo-width": 1.5
    }
  });
}

function updateMapDataAndFit(map: maplibregl.Map, mapData: TransportMapData, mapMode: TransportMapMode) {
  const apply = () => {
    setBusinessLayerData(map, mapData, mapMode);
    window.requestAnimationFrame(() => {
      map.resize();
      fitToTrips(map, mapData, mapMode);
    });
  };

  if (map.isStyleLoaded()) {
    apply();
    return;
  }

  map.once("idle", apply);
}

function setBusinessLayerData(map: maplibregl.Map, mapData: TransportMapData, mapMode: TransportMapMode) {
  const routeSource = map.getSource("trainmap-routes") as maplibregl.GeoJSONSource | undefined;
  const endpointSource = map.getSource("trainmap-stations-endpoints") as maplibregl.GeoJSONSource | undefined;
  const intermediateSource = map.getSource("trainmap-stations-intermediate") as maplibregl.GeoJSONSource | undefined;
  const labelSource = map.getSource("trainmap-station-labels") as maplibregl.GeoJSONSource | undefined;
  routeSource?.setData(mapData.routes);
  endpointSource?.setData(mapData.endpointStations);
  intermediateSource?.setData(mapData.intermediateStations);
  labelSource?.setData(labelsForMode(mapData, mapMode));
}

function fitToTrips(map: maplibregl.Map, mapData: TransportMapData, mapMode: TransportMapMode) {
  const coordinates = mapData.boundsCoordinates;

  if (coordinates.length === 0) {
    map.jumpTo({
      center: [8.5, 47.3],
      zoom: mapMode === "export" ? 3.8 : 4.1
    });
    return;
  }

  if (coordinates.length === 1) {
    map.jumpTo({
      center: coordinates[0],
      zoom: mapMode === "overview" || mapMode === "export" ? 6 : 9
    });
    return;
  }

  const bounds = fitBoundsFromCoordinates(coordinates);

  if (!bounds) {
    return;
  }

  const compactRoute = Math.abs(bounds.east - bounds.west) < 0.02 && Math.abs(bounds.north - bounds.south) < 0.02;
  if (compactRoute) {
    map.jumpTo({
      center: [(bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2],
      zoom: mapMode === "overview" || mapMode === "export" ? 8 : 10.5
    });
    return;
  }

  const focused = mapMode === "detail" || mapMode === "preview";

  map.fitBounds(
    [
      [bounds.west, bounds.south],
      [bounds.east, bounds.north]
    ],
    {
      padding: focused ? 56 : 78,
      duration: 0,
      maxZoom: focused ? 11 : 7.5
    }
  );
}

function labelsForMode(mapData: TransportMapData, mapMode: TransportMapMode): TransportMapData["labelStations"] {
  if (mapMode === "overview" || mapMode === "export") {
    return {
      type: "FeatureCollection",
      features: mapData.labelStations.features.filter((feature) => feature.properties?.role !== "intermediate")
    };
  }
  return mapData.labelStations;
}
