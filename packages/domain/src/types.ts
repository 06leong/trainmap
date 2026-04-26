export type TransportMode = "rail" | "tram" | "metro" | "bus" | "ferry" | "flight";

export type RouteConfidence = "exact" | "inferred" | "manual";

export type TripStatus = "planned" | "completed" | "needs_review";

export type ServiceClass = "first" | "second" | "sleeper" | "mixed";

export type GeometrySource = "imported" | "generated" | "provider" | "manual";

export type Coordinate = [longitude: number, latitude: number];

export interface LineStringGeometry {
  type: "LineString";
  coordinates: Coordinate[];
}

export interface Station {
  id: string;
  name: string;
  countryCode: string;
  coordinates: Coordinate;
  source?: string;
  timezone?: string;
}

export interface StationAlias {
  id: string;
  stationId: string;
  alias: string;
  locale?: string;
  source?: string;
}

export interface Operator {
  id: string;
  name: string;
  countryCode?: string;
  color?: string;
}

export interface Journey {
  id: string;
  name: string;
  description?: string;
  coverColor?: string;
}

export interface Tag {
  id: string;
  label: string;
  color: string;
}

export interface ManualViaPoint {
  id: string;
  label: string;
  coordinates: Coordinate;
  sequence: number;
}

export interface TripStop {
  id: string;
  stationId: string;
  stationName: string;
  countryCode: string;
  coordinates: Coordinate;
  sequence: number;
  arrivalAt?: string;
  departureAt?: string;
  source: "manual" | "import" | "provider";
  confidence: "matched" | "fuzzy" | "unmatched";
}

export interface TripStopInput {
  id?: string;
  stationId?: string;
  stationName: string;
  countryCode: string;
  coordinates: Coordinate;
  sequence: number;
  arrivalAt?: string;
  departureAt?: string;
  source?: "manual" | "import" | "provider";
  confidence?: "matched" | "fuzzy" | "unmatched";
}

export interface TripSegment {
  id: string;
  tripId: string;
  fromStopId: string;
  toStopId: string;
  distanceKm: number;
  geometry?: LineStringGeometry;
}

export interface TripGeometry {
  id: string;
  tripId: string;
  version: number;
  source: GeometrySource;
  confidence: RouteConfidence;
  geometry: LineStringGeometry;
  manualViaPoints: ManualViaPoint[];
  createdAt: string;
  createdBy: string;
  notes?: string;
}

export interface TripGeometryVersion extends TripGeometry {
  parentGeometryId?: string;
  changeSummary: string;
}

export interface CreateTripInput {
  title: string;
  mode?: TransportMode;
  status?: TripStatus;
  serviceClass?: ServiceClass;
  date: string;
  arrivalDate?: string;
  operatorId?: string;
  operatorName: string;
  operatorCountryCode?: string;
  trainCode?: string;
  journeyId?: string;
  tagIds?: string[];
  distanceKm?: number;
  stops: TripStopInput[];
  initialGeometry?: {
    source: GeometrySource;
    confidence: RouteConfidence;
    geometry: LineStringGeometry;
    manualViaPoints?: ManualViaPoint[];
    notes?: string;
    createdBy?: string;
  };
  rawImportRow?: Record<string, unknown>;
}

export interface UpdateTripInput {
  title?: string;
  status?: TripStatus;
  serviceClass?: ServiceClass;
  date?: string;
  arrivalDate?: string;
  operatorId?: string;
  operatorName?: string;
  operatorCountryCode?: string;
  trainCode?: string;
  journeyId?: string;
  tagIds?: string[];
  distanceKm?: number;
}

export interface CreateTripGeometryInput {
  tripId: string;
  source: GeometrySource;
  confidence: RouteConfidence;
  geometry: LineStringGeometry;
  manualViaPoints?: ManualViaPoint[];
  notes?: string;
  createdBy?: string;
  changeSummary: string;
  parentGeometryId?: string;
}

export interface RepairTripGeometryInput {
  tripId: string;
  stops: TripStopInput[];
  manualViaPoints: ManualViaPoint[];
  createdBy?: string;
  changeSummary: string;
}

export interface Trip {
  id: string;
  title: string;
  mode: TransportMode;
  status: TripStatus;
  serviceClass: ServiceClass;
  date: string;
  arrivalDate?: string;
  operatorId: string;
  operatorName: string;
  trainCode?: string;
  journeyId?: string;
  tagIds: string[];
  countryCodes: string[];
  distanceKm: number;
  stops: TripStop[];
  segments: TripSegment[];
  geometry?: TripGeometry;
  geometryVersions: TripGeometryVersion[];
  rawImportRow?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ImportRun {
  id: string;
  sourceName: string;
  format: "viaduct_csv" | "generic_csv";
  status: "draft" | "previewed" | "committed" | "failed";
  rowCount: number;
  createdAt: string;
}

export interface CreateImportInput {
  sourceName: string;
  format: "viaduct_csv" | "generic_csv";
  status?: "draft" | "previewed" | "committed" | "failed";
  rowCount: number;
}

export interface ImportRow {
  id: string;
  importId: string;
  rowNumber: number;
  raw: Record<string, string>;
  normalized: Record<string, unknown>;
  status: "matched" | "fuzzy_matched" | "unmatched" | "invalid";
  messages: string[];
}

export interface CreateImportRowInput {
  importId: string;
  rowNumber: number;
  raw: Record<string, string>;
  normalized: Record<string, unknown>;
  status: "matched" | "fuzzy_matched" | "unmatched" | "invalid";
  messages: string[];
}

export interface CommitImportRowInput {
  rowNumber: number;
  raw: Record<string, string>;
  normalized: Record<string, unknown>;
  status: ImportRow["status"];
  messages: string[];
  rowHash: string;
  tripInput?: CreateTripInput;
}

export interface CommitImportInput {
  sourceName: string;
  format: ImportRun["format"];
  rows: CommitImportRowInput[];
}

export interface ImportCommitResult {
  importRun: ImportRun;
  totalRows: number;
  persistedRows: number;
  committedTrips: number;
  skippedDuplicateTrips: number;
  reviewRows: number;
  committedTripIds: string[];
}

export interface SavedView {
  id: string;
  name: string;
  filters: TripFilters;
  isPublic: boolean;
  createdAt: string;
}

export interface ExportJob {
  id: string;
  type: "map" | "stats" | "poster";
  preset: "1080p" | "2k" | "4k";
  theme: "light" | "dark";
  title?: string;
  subtitle?: string;
  includeLegend: boolean;
  includeAttribution: boolean;
  renderUrl?: string;
  outputPath?: string;
  status: "queued" | "rendering" | "complete" | "failed";
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface CreateExportInput {
  type: ExportJob["type"];
  preset: ExportJob["preset"];
  theme: ExportJob["theme"];
  title?: string;
  subtitle?: string;
  includeLegend: boolean;
  includeAttribution: boolean;
  renderUrl: string;
}

export interface UpdateExportInput {
  id: string;
  status: ExportJob["status"];
  outputPath?: string;
  errorMessage?: string;
  completedAt?: string;
}

export interface TripFilters {
  query?: string;
  year?: number;
  dateFrom?: string;
  dateTo?: string;
  operatorId?: string;
  countryCode?: string;
  journeyId?: string;
  tagId?: string;
  status?: TripStatus;
  serviceClass?: ServiceClass;
  mode?: TransportMode;
}
