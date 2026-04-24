import type { Coordinate, Station, TripStop } from "@trainmap/domain";

export type TimetableProviderId = "swiss_open_data" | "db_api" | "ns_api" | "generic_gtfs";

export interface TimetableProviderMetadata {
  id: TimetableProviderId;
  label: string;
  region: string;
  capabilities: {
    stationSearch: boolean;
    tripSearch: boolean;
    stopSequence: boolean;
    realtime: boolean;
  };
}

export interface StationSearchResult {
  id: string;
  name: string;
  countryCode: string;
  coordinates?: Coordinate;
}

export interface TimetableTripOption {
  id: string;
  providerId: TimetableProviderId;
  trainCode: string;
  operatorName: string;
  departureAt: string;
  arrivalAt: string;
  origin: string;
  destination: string;
  stopCount: number;
}

export interface TimetableAdapter {
  getProviderMetadata(): TimetableProviderMetadata;
  searchStations(query: string): Promise<StationSearchResult[]>;
  searchTrips(input: {
    origin: string;
    destination: string;
    departureDate: string;
    departureTime?: string;
  }): Promise<TimetableTripOption[]>;
  getTripStopSequence(optionId: string): Promise<TripStop[]>;
}

const providerMetadata: Record<TimetableProviderId, TimetableProviderMetadata> = {
  swiss_open_data: {
    id: "swiss_open_data",
    label: "Swiss Open Data",
    region: "Switzerland and cross-border Alps",
    capabilities: { stationSearch: true, tripSearch: true, stopSequence: true, realtime: false }
  },
  db_api: {
    id: "db_api",
    label: "DB API",
    region: "Germany and central Europe",
    capabilities: { stationSearch: true, tripSearch: true, stopSequence: true, realtime: false }
  },
  ns_api: {
    id: "ns_api",
    label: "NS API",
    region: "Netherlands",
    capabilities: { stationSearch: true, tripSearch: true, stopSequence: true, realtime: false }
  },
  generic_gtfs: {
    id: "generic_gtfs",
    label: "Generic GTFS",
    region: "World-ready static feeds",
    capabilities: { stationSearch: true, tripSearch: false, stopSequence: true, realtime: false }
  }
};

const stations: StationSearchResult[] = [
  { id: "station-zurich-hb", name: "Zurich HB", countryCode: "CH", coordinates: [8.5402, 47.3782] },
  { id: "station-basel-sbb", name: "Basel SBB", countryCode: "CH", coordinates: [7.5896, 47.5476] },
  { id: "station-milano-centrale", name: "Milano Centrale", countryCode: "IT", coordinates: [9.2042, 45.4864] },
  { id: "station-berlin-hbf", name: "Berlin Hbf", countryCode: "DE", coordinates: [13.3695, 52.5251] },
  { id: "station-amsterdam-centraal", name: "Amsterdam Centraal", countryCode: "NL", coordinates: [4.9003, 52.3789] }
];

export function listTimetableProviders(): TimetableProviderMetadata[] {
  return Object.values(providerMetadata);
}

export function getTimetableAdapter(id: TimetableProviderId): TimetableAdapter {
  return new StaticTimetableAdapter(providerMetadata[id]);
}

class StaticTimetableAdapter implements TimetableAdapter {
  constructor(private readonly metadata: TimetableProviderMetadata) {}

  getProviderMetadata(): TimetableProviderMetadata {
    return this.metadata;
  }

  async searchStations(query: string): Promise<StationSearchResult[]> {
    const normalizedQuery = query.toLowerCase();
    return stations.filter((station) => station.name.toLowerCase().includes(normalizedQuery)).slice(0, 8);
  }

  async searchTrips(input: {
    origin: string;
    destination: string;
    departureDate: string;
    departureTime?: string;
  }): Promise<TimetableTripOption[]> {
    if (!this.metadata.capabilities.tripSearch) {
      return [];
    }

    const departureTime = input.departureTime ?? "09:04";
    return [
      {
        id: `${this.metadata.id}-${input.origin}-${input.destination}-${input.departureDate}`,
        providerId: this.metadata.id,
        trainCode: this.metadata.id === "db_api" ? "ICE 279" : "EC 317",
        operatorName: this.metadata.id === "ns_api" ? "NS International" : this.metadata.label,
        departureAt: `${input.departureDate}T${departureTime}:00`,
        arrivalAt: `${input.departureDate}T13:42:00`,
        origin: input.origin,
        destination: input.destination,
        stopCount: 4
      }
    ];
  }

  async getTripStopSequence(optionId: string): Promise<TripStop[]> {
    const provider = this.metadata.id;
    const base: Array<Pick<Station, "id" | "name" | "countryCode" | "coordinates">> =
      provider === "ns_api"
        ? [
            { id: "station-amsterdam-centraal", name: "Amsterdam Centraal", countryCode: "NL", coordinates: [4.9003, 52.3789] },
            { id: "station-berlin-hbf", name: "Berlin Hbf", countryCode: "DE", coordinates: [13.3695, 52.5251] }
          ]
        : [
            { id: "station-zurich-hb", name: "Zurich HB", countryCode: "CH", coordinates: [8.5402, 47.3782] },
            { id: "station-basel-sbb", name: "Basel SBB", countryCode: "CH", coordinates: [7.5896, 47.5476] },
            { id: "station-milano-centrale", name: "Milano Centrale", countryCode: "IT", coordinates: [9.2042, 45.4864] }
          ];

    return base.map((station, index) => ({
      id: `${optionId}-stop-${index + 1}`,
      stationId: station.id,
      stationName: station.name,
      countryCode: station.countryCode,
      coordinates: station.coordinates,
      sequence: index + 1,
      source: "provider",
      confidence: "matched"
    }));
  }
}
