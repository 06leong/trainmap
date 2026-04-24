import type {
  ExportJob,
  ImportRun,
  SavedView,
  Station,
  StationAlias,
  Tag,
  Trip,
  TripFilters
} from "./types";

export interface TrainmapRepository {
  listTrips(filters?: TripFilters): Promise<Trip[]>;
  getTrip(id: string): Promise<Trip | null>;
  createTrip(input: Trip): Promise<Trip>;
  updateTrip(id: string, input: Partial<Trip>): Promise<Trip>;
  deleteTrip(id: string): Promise<void>;
  listStations(query?: string): Promise<Station[]>;
  listStationAliases(stationId: string): Promise<StationAlias[]>;
  listTags(): Promise<Tag[]>;
  createImport(input: ImportRun): Promise<ImportRun>;
  createSavedView(input: SavedView): Promise<SavedView>;
  createExport(input: ExportJob): Promise<ExportJob>;
}

export const tripTableNames = [
  "stations",
  "station_aliases",
  "operators",
  "journeys",
  "tags",
  "trips",
  "trip_segments",
  "trip_stops",
  "trip_geometries",
  "trip_geometry_versions",
  "imports",
  "import_rows",
  "saved_views",
  "exports"
] as const;
