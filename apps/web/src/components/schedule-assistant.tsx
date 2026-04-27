"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Check, MapPinned, Search, TrainFront } from "lucide-react";
import type { StationSearchResult, SwissOpenDataRouteOption } from "@trainmap/timetable-adapters";
import type { Trip } from "@trainmap/domain";
import {
  createTripFromScheduleAction,
  searchScheduleConnectionsAction,
  searchScheduleStationsAction
} from "@/lib/actions/schedule";
import { TransportMap } from "@/components/transport-map";

type StationOption = StationSearchResult & { coordinates: [number, number] };

const defaultOrigin: StationOption = {
  id: "8503000",
  name: "Zürich HB",
  countryCode: "CH",
  coordinates: [8.5402, 47.3782]
};

const defaultDestination: StationOption = {
  id: "8300207",
  name: "Milano Centrale",
  countryCode: "IT",
  coordinates: [9.2042, 45.4864]
};

export function ScheduleAssistant() {
  const [originQuery, setOriginQuery] = useState(defaultOrigin.name);
  const [destinationQuery, setDestinationQuery] = useState(defaultDestination.name);
  const [origin, setOrigin] = useState<StationOption>(defaultOrigin);
  const [destination, setDestination] = useState<StationOption>(defaultDestination);
  const [originResults, setOriginResults] = useState<StationSearchResult[]>([]);
  const [destinationResults, setDestinationResults] = useState<StationSearchResult[]>([]);
  const [departureDate, setDepartureDate] = useState("2026-05-01");
  const [departureTime, setDepartureTime] = useState("09:00");
  const [options, setOptions] = useState<SwissOpenDataRouteOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [previewTrip, setPreviewTrip] = useState<Trip>(() => buildPreviewTrip(undefined, defaultOrigin, defaultDestination));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedOption = options.find((option) => option.id === selectedOptionId) ?? options[0];

  function searchStations(kind: "origin" | "destination") {
    const query = kind === "origin" ? originQuery : destinationQuery;
    startTransition(async () => {
      const result = await searchScheduleStationsAction(query);
      setMessage(result.error ?? null);
      if (kind === "origin") {
        setOriginResults(result.stations);
      } else {
        setDestinationResults(result.stations);
      }
    });
  }

  function findConnections() {
    startTransition(async () => {
      const result = await searchScheduleConnectionsAction({
        origin: stationToPlace(origin),
        destination: stationToPlace(destination),
        departureDate,
        departureTime
      });
      setMessage(result.error ?? null);
      setOptions(result.options);
      setSelectedOptionId(result.options[0]?.id ?? null);
      setPreviewTrip(buildPreviewTrip(result.options[0], origin, destination));
    });
  }

  function resetConnections() {
    setOptions([]);
    setSelectedOptionId(null);
    setMessage(null);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(520px,0.95fr)_minmax(560px,1.05fr)]">
      <section className="overflow-hidden rounded-md border border-black/10 bg-white/72 shadow-sm">
        <TransportMap trips={[previewTrip]} showCaption={false} heightClass="h-[720px]" />
        <div className="border-t border-black/10 bg-[#f8f5ef] p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-display text-2xl text-ink">{selectedOption ? selectedOption.trainCode : "Route preview"}</div>
              <div className="mt-1 text-sm text-black/58">
                {origin.name} to {destination.name}
              </div>
            </div>
            <div className="text-right font-display text-2xl text-ink">
              {selectedOption ? `${selectedOption.stopCount} stops` : "2 stops"}
            </div>
          </div>
          <StopTimeline option={selectedOption} />
        </div>
      </section>

      <section className="rounded-md border border-black/10 bg-white/72 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-moss p-2 text-white">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-3xl text-ink">Schedule-assisted trip</h2>
            <p className="text-sm text-black/58">Search OJP stations, choose a train, preview stops and geometry, then create the trip.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_1fr]">
          <StationPicker
            label="From"
            query={originQuery}
            selected={origin}
            results={originResults}
            onQueryChange={setOriginQuery}
            onSearch={() => searchStations("origin")}
            onSelect={(station) => {
              setOrigin(station);
              setOriginQuery(station.name);
              setOriginResults([]);
              resetConnections();
            }}
          />
          <div className="hidden items-center justify-center pt-8 text-black/35 md:flex">-&gt;</div>
          <StationPicker
            label="To"
            query={destinationQuery}
            selected={destination}
            results={destinationResults}
            onQueryChange={setDestinationQuery}
            onSearch={() => searchStations("destination")}
            onSelect={(station) => {
              setDestination(station);
              setDestinationQuery(station.name);
              setDestinationResults([]);
              resetConnections();
            }}
          />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="text-sm">
            <span className="text-black/54">Departure date</span>
            <input
              type="date"
              value={departureDate}
              onChange={(event) => {
                setDepartureDate(event.target.value);
                resetConnections();
              }}
              className="mt-1 h-11 w-full rounded-md border border-black/10 bg-[#f8f5ef] px-3 outline-none focus:border-ink"
            />
          </label>
          <label className="text-sm">
            <span className="text-black/54">Approx. departure time</span>
            <input
              type="time"
              value={departureTime}
              onChange={(event) => {
                setDepartureTime(event.target.value);
                resetConnections();
              }}
              className="mt-1 h-11 w-full rounded-md border border-black/10 bg-[#f8f5ef] px-3 outline-none focus:border-ink"
            />
          </label>
          <button
            type="button"
            onClick={findConnections}
            disabled={pending}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-5 text-sm text-white disabled:opacity-45"
          >
            <Search className="h-4 w-4" />
            {pending ? "Searching" : "Find connections"}
          </button>
        </div>

        {message ? <div className="mt-4 rounded-md border border-rail/20 bg-rail/5 p-3 text-sm text-rail">{message}</div> : null}

        <div className="mt-6 rounded-md border border-black/10 bg-[#f8f5ef]">
          <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
            <div className="font-medium text-ink">Connection from timetable</div>
            <div className="text-xs uppercase text-black/45">Swiss Open Data OJP 2.0</div>
          </div>
          <div className="max-h-[330px] space-y-2 overflow-auto p-3">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setSelectedOptionId(option.id);
                  setPreviewTrip(buildPreviewTrip(option, origin, destination));
                }}
                className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border border-black/10 bg-white px-4 py-3 text-left transition hover:border-ink"
              >
                <div>
                  <div className="font-medium text-ink">
                    {localTime(option.departureAt)} - {localTime(option.arrivalAt)}
                  </div>
                  <div className="mt-1 text-sm text-black/55">
                    {localDate(option.departureAt)} | {duration(option.departureAt, option.arrivalAt)} |{" "}
                    {option.transferCount === 0 ? "direct" : `${option.transferCount ?? 0} transfer${option.transferCount === 1 ? "" : "s"}`} |{" "}
                    {option.stopCount} stops
                  </div>
                  <div className="mt-1 text-xs text-black/45">{option.operatorName}</div>
                </div>
                <div className="rounded-md border border-black/10 bg-[#f8f5ef] px-2 py-1 text-xs font-medium text-black/62">
                  {option.trainCode}
                </div>
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-black/15">
                  {selectedOption?.id === option.id ? <Check className="h-4 w-4 text-moss" /> : null}
                </div>
              </button>
            ))}
            {options.length === 0 ? (
              <div className="rounded-md border border-dashed border-black/20 bg-white p-4 text-sm text-black/58">
                Select origin and destination stations, then query OJP for available trains.
              </div>
            ) : null}
          </div>
        </div>

        <RouteDetails option={selectedOption} />

        <form action={createTripFromScheduleAction} className="mt-5 rounded-md border border-black/10 bg-[#f8f5ef] p-4">
          <input type="hidden" name="scheduleOptionJson" value={selectedOption ? JSON.stringify(selectedOption) : ""} />
          <label className="text-sm">
            <span className="text-black/54">Trip title</span>
            <input
              key={`${origin.id}-${destination.id}-${selectedOption?.id ?? "manual"}`}
              name="title"
              defaultValue={`${origin.name} to ${destination.name}`}
              className="mt-1 h-10 w-full rounded-md border border-black/10 bg-white px-3 outline-none focus:border-ink"
            />
          </label>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="text-sm">
              <span className="text-black/54">Travel class</span>
              <select name="serviceClass" defaultValue="second" className="mt-1 h-10 w-full rounded-md border border-black/10 bg-white px-3 outline-none focus:border-ink">
                <option value="second">Economy (2nd)</option>
                <option value="first">First</option>
                <option value="mixed">Mixed</option>
                <option value="sleeper">Sleeper</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={!selectedOption}
              className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-rail px-5 text-sm text-white disabled:opacity-45"
            >
              <TrainFront className="h-4 w-4" />
              Create trip
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function StationPicker({
  label,
  query,
  selected,
  results,
  onQueryChange,
  onSearch,
  onSelect
}: {
  label: string;
  query: string;
  selected: StationOption;
  results: StationSearchResult[];
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onSelect: (station: StationOption) => void;
}) {
  return (
    <div>
      <label className="text-sm">
        <span className="text-black/54">{label}</span>
        <div className="mt-1 flex gap-2">
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="h-11 min-w-0 flex-1 rounded-md border border-black/10 bg-[#f8f5ef] px-3 text-lg outline-none focus:border-ink"
          />
          <button type="button" onClick={onSearch} className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-ink text-white">
            <Search className="h-4 w-4" />
          </button>
        </div>
      </label>
      <div className="mt-2 text-xs text-black/45">
        {selected.countryCode} | {selected.id} | {selected.coordinates.join(", ")}
      </div>
      {results.length > 0 ? (
        <div className="mt-2 space-y-1 rounded-md border border-black/10 bg-white p-1 shadow-sm">
          {results.filter(hasCoordinates).map((station) => (
            <button
              key={station.id}
              type="button"
              onClick={() => onSelect(station)}
              className="w-full rounded px-3 py-2 text-left text-sm hover:bg-[#f8f5ef]"
            >
              <div className="font-medium text-ink">{station.name}</div>
              <div className="text-xs text-black/45">
                {station.countryCode} | {station.id}
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RouteDetails({ option }: { option?: SwissOpenDataRouteOption }) {
  if (!option) {
    return (
      <div className="mt-4 rounded-md border border-black/10 bg-[#f8f5ef] p-4 text-sm text-black/58">
        Route, waypoints, and timetable details appear after a connection is selected.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-black/10 bg-[#f8f5ef] p-4">
      <div className="flex items-center gap-2 font-medium text-ink">
        <MapPinned className="h-4 w-4" />
        Route & waypoints
      </div>
      <div className="mt-4 space-y-2">
        {option.stops.map((stop, index) => (
          <div key={`${stop.stationId}-${index}`} className="grid grid-cols-[36px_1fr_auto] items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black/15 bg-white text-xs text-black/55">
              {index + 1}
            </div>
            <div>
              <div className="font-medium text-ink">{stop.stationName}</div>
              <div className="text-xs text-black/45">
                {stop.countryCode} | {stop.stationId}
              </div>
            </div>
            <div className="text-right text-sm text-black/62">
              <div>{stop.departureAt ? localTime(stop.departureAt) : ""}</div>
              <div>{stop.arrivalAt ? localTime(stop.arrivalAt) : ""}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 border-t border-black/10 pt-4 text-sm md:grid-cols-4">
        <Metric label="Operator" value={option.operatorName} />
        <Metric label="Line / train code" value={option.trainCode} />
        <Metric label="Transfers" value={option.transferCount === 0 ? "Direct" : String(option.transferCount ?? 0)} />
        <Metric label="Geometry points" value={String(option.geometry?.coordinates.length ?? option.stops.length)} />
      </div>
    </div>
  );
}

function StopTimeline({ option }: { option?: SwissOpenDataRouteOption }) {
  const stops = option?.stops.slice(0, 6) ?? [];
  if (stops.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2 text-sm">
      {stops.map((stop, index) => (
        <div key={`${stop.stationId}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1">
          <span className="h-2 w-2 rounded-full bg-rail" />
          <span>{stop.stationName}</span>
        </div>
      ))}
      {option && option.stops.length > stops.length ? (
        <div className="inline-flex items-center rounded-full border border-black/10 bg-white px-3 py-1">
          +{option.stops.length - stops.length} stops
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-black/45">{label}</div>
      <div className="mt-1 font-medium text-ink">{value}</div>
    </div>
  );
}

function buildPreviewTrip(
  option: SwissOpenDataRouteOption | undefined,
  origin: StationOption,
  destination: StationOption
): Trip {
  const stops = option?.stops ?? [
    {
      id: "preview-origin",
      stationId: origin.id,
      stationName: origin.name,
      countryCode: origin.countryCode,
      coordinates: origin.coordinates,
      sequence: 1,
      source: "provider" as const,
      confidence: "matched" as const
    },
    {
      id: "preview-destination",
      stationId: destination.id,
      stationName: destination.name,
      countryCode: destination.countryCode,
      coordinates: destination.coordinates,
      sequence: 2,
      source: "provider" as const,
      confidence: "matched" as const
    }
  ];

  return {
    id: "schedule-preview",
    title: option ? `${option.origin} to ${option.destination}` : `${origin.name} to ${destination.name}`,
    mode: "rail",
    status: "planned",
    serviceClass: "second",
    date: option?.departureAt ?? new Date().toISOString(),
    arrivalDate: option?.arrivalAt,
    operatorId: "swiss-open-data",
    operatorName: option?.operatorName ?? "Swiss Open Data",
    trainCode: option?.trainCode,
    tagIds: [],
    countryCodes: [...new Set(stops.map((stop) => stop.countryCode))],
    distanceKm: 0,
    stops,
    segments: [],
    geometry: {
      id: "schedule-preview-geometry",
      tripId: "schedule-preview",
      version: 1,
      source: option?.geometry ? "provider" : "generated",
      confidence: option?.geometry ? "exact" : "inferred",
      geometry: option?.geometry ?? { type: "LineString", coordinates: stops.map((stop) => stop.coordinates) },
      manualViaPoints: [],
      createdAt: new Date().toISOString(),
      createdBy: "swiss_open_data"
    },
    geometryVersions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function stationToPlace(station: StationOption) {
  return {
    id: station.id,
    name: station.name,
    coordinates: station.coordinates
  };
}

function hasCoordinates(station: StationSearchResult): station is StationOption {
  return Boolean(station.coordinates);
}

const ojpDisplayTimeZone = "Europe/Zurich";

function localTime(value: string): string {
  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) {
    return value.slice(11, 16) || value;
  }
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: ojpDisplayTimeZone
  }).format(dateValue);
}

function localDate(value: string): string {
  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) {
    return value.slice(0, 10) || value;
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: ojpDisplayTimeZone
  }).format(dateValue);
}

function duration(from: string, to: string): string {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return "duration unknown";
  }
  const minutes = Math.round((end - start) / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} h ${remainder} min`;
}
