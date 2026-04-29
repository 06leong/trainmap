import type {
  CreateImportInput,
  CreateImportRowInput,
  CreateExportInput,
  CommitImportInput,
  CreateTripGeometryInput,
  CreateTripInput,
  ExportJob,
  ImportCommitResult,
  ImportRow,
  ImportRun,
  Journey,
  Operator,
  RepairTripGeometryInput,
  SavedView,
  Station,
  StationAlias,
  Tag,
  Trip,
  TripFilters,
  TripGeometryVersion,
  TripStopInput,
  UpdateExportInput,
  UpdateTripInput
} from "./types";

export interface TrainmapRepository {
  listOperators(): Promise<Operator[]>;
  listJourneys(): Promise<Journey[]>;
  listTags(): Promise<Tag[]>;
  listTrips(filters?: TripFilters): Promise<Trip[]>;
  getTrip(id: string): Promise<Trip | null>;
  createTrip(input: CreateTripInput): Promise<Trip>;
  updateTrip(id: string, input: UpdateTripInput): Promise<Trip>;
  updateTripRawImportRow(id: string, rawImportRow: Record<string, unknown>): Promise<Trip>;
  deleteTrip(id: string): Promise<void>;
  listStations(query?: string): Promise<Station[]>;
  listStationAliases(stationId: string): Promise<StationAlias[]>;
  replaceTripStops(tripId: string, stops: TripStopInput[]): Promise<Trip>;
  createTripGeometry(input: CreateTripGeometryInput): Promise<TripGeometryVersion>;
  repairTripGeometry(input: RepairTripGeometryInput): Promise<Trip>;
  createImport(input: CreateImportInput): Promise<ImportRun>;
  createImportRow(input: CreateImportRowInput): Promise<ImportRow>;
  listImportRows(importId: string): Promise<ImportRow[]>;
  findTripByImportRowHash(rowHash: string): Promise<Trip | null>;
  commitImport(input: CommitImportInput): Promise<ImportCommitResult>;
  createSavedView(input: SavedView): Promise<SavedView>;
  getExport(id: string): Promise<ExportJob | null>;
  createExport(input: CreateExportInput): Promise<ExportJob>;
  updateExport(input: UpdateExportInput): Promise<ExportJob>;
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
