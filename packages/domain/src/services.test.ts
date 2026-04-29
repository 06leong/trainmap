import { describe, expect, it } from "vitest";
import type {
  CommitImportInput,
  CreateExportInput,
  CreateImportInput,
  CreateImportRowInput,
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
  TrainmapRepository,
  Trip,
  TripFilters,
  TripGeometryVersion,
  TripStopInput,
  UpdateExportInput,
  UpdateTripInput
} from "./index";
import { createTripWithInitialGeometry, repairTripWithManualGeometry } from "./services";

describe("trip persistence services", () => {
  it("creates trips with persisted stop sequence and initial geometry version", async () => {
    const repository = new MemoryRepository();
    const trip = await createTripWithInitialGeometry(repository, baseTripInput());

    expect(trip.title).toBe("Zurich to Milano");
    expect(trip.stops.map((stop) => stop.stationName)).toEqual(["Zurich HB", "Milano Centrale"]);
    expect(trip.geometry?.version).toBe(1);
    expect(trip.geometryVersions).toHaveLength(1);
  });

  it("persists manual route repair as a new geometry version", async () => {
    const repository = new MemoryRepository();
    const trip = await createTripWithInitialGeometry(repository, baseTripInput());
    const repaired = await repairTripWithManualGeometry(repository, {
      tripId: trip.id,
      stops: trip.stops.map((stop) => ({ ...stop })),
      manualViaPoints: [
        {
          id: "via-gotthard",
          label: "Gotthard",
          coordinates: [8.58, 46.55],
          sequence: 2
        }
      ],
      changeSummary: "Add Gotthard via",
      createdBy: "test"
    });

    expect(repaired.geometry?.confidence).toBe("manual");
    expect(repaired.geometry?.version).toBe(2);
    expect(repaired.geometry?.manualViaPoints).toHaveLength(1);
    expect(repaired.geometryVersions.map((version) => version.version)).toEqual([2, 1]);
  });
});

function baseTripInput(): CreateTripInput {
  return {
    title: "Zurich to Milano",
    date: "2026-05-01",
    operatorName: "SBB",
    distanceKm: 280,
    stops: [
      {
        stationName: "Zurich HB",
        countryCode: "CH",
        coordinates: [8.5402, 47.3782],
        sequence: 1
      },
      {
        stationName: "Milano Centrale",
        countryCode: "IT",
        coordinates: [9.2042, 45.4864],
        sequence: 2
      }
    ]
  };
}

class MemoryRepository implements TrainmapRepository {
  private trips = new Map<string, Trip>();

  async listOperators(): Promise<Operator[]> {
    return [];
  }

  async listJourneys(): Promise<Journey[]> {
    return [];
  }

  async listTags(): Promise<Tag[]> {
    return [];
  }

  async listTrips(_filters?: TripFilters): Promise<Trip[]> {
    return [...this.trips.values()];
  }

  async getTrip(id: string): Promise<Trip | null> {
    return this.trips.get(id) ?? null;
  }

  async createTrip(input: CreateTripInput): Promise<Trip> {
    const tripId = crypto.randomUUID();
    const stops = inputStopsToTripStops(tripId, input.stops);
    const geometry = {
      id: crypto.randomUUID(),
      tripId,
      version: 1,
      source: input.initialGeometry?.source ?? "generated",
      confidence: input.initialGeometry?.confidence ?? "inferred",
      geometry: input.initialGeometry?.geometry ?? {
        type: "LineString" as const,
        coordinates: stops.map((stop) => stop.coordinates)
      },
      manualViaPoints: input.initialGeometry?.manualViaPoints ?? [],
      createdAt: new Date().toISOString(),
      createdBy: input.initialGeometry?.createdBy ?? "test"
    };
    const version = {
      ...geometry,
      changeSummary: "Initial geometry"
    };
    const trip: Trip = {
      id: tripId,
      title: input.title,
      mode: input.mode ?? "rail",
      status: input.status ?? "completed",
      serviceClass: input.serviceClass ?? "second",
      date: input.date,
      arrivalDate: input.arrivalDate,
      operatorId: input.operatorId ?? "operator-test",
      operatorName: input.operatorName,
      trainCode: input.trainCode,
      journeyId: input.journeyId,
      tagIds: input.tagIds ?? [],
      countryCodes: [...new Set(stops.map((stop) => stop.countryCode))],
      distanceKm: input.distanceKm ?? 0,
      stops,
      segments: [],
      geometry,
      geometryVersions: [version],
      rawImportRow: input.rawImportRow,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.trips.set(trip.id, trip);
    return trip;
  }

  async updateTrip(id: string, input: UpdateTripInput): Promise<Trip> {
    const current = required(this.trips.get(id));
    const updated = { ...current, ...input, updatedAt: new Date().toISOString() };
    this.trips.set(id, updated);
    return updated;
  }

  async updateTripRawImportRow(id: string, rawImportRow: Record<string, unknown>): Promise<Trip> {
    const current = required(this.trips.get(id));
    const updated = { ...current, rawImportRow, updatedAt: new Date().toISOString() };
    this.trips.set(id, updated);
    return updated;
  }

  async deleteTrip(id: string): Promise<void> {
    this.trips.delete(id);
  }

  async listStations(_query?: string): Promise<Station[]> {
    return [];
  }

  async listStationAliases(_stationId: string): Promise<StationAlias[]> {
    return [];
  }

  async replaceTripStops(tripId: string, stops: TripStopInput[]): Promise<Trip> {
    const current = required(this.trips.get(tripId));
    const updated = { ...current, stops: inputStopsToTripStops(tripId, stops), updatedAt: new Date().toISOString() };
    this.trips.set(tripId, updated);
    return updated;
  }

  async createTripGeometry(input: CreateTripGeometryInput): Promise<TripGeometryVersion> {
    const current = required(this.trips.get(input.tripId));
    const versionNumber = (current.geometry?.version ?? 0) + 1;
    const geometry = {
      id: crypto.randomUUID(),
      tripId: input.tripId,
      version: versionNumber,
      source: input.source,
      confidence: input.confidence,
      geometry: input.geometry,
      manualViaPoints: input.manualViaPoints ?? [],
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy ?? "test",
      notes: input.notes
    };
    const version = {
      ...geometry,
      parentGeometryId: input.parentGeometryId,
      changeSummary: input.changeSummary
    };
    this.trips.set(input.tripId, {
      ...current,
      geometry,
      geometryVersions: [version, ...current.geometryVersions],
      updatedAt: new Date().toISOString()
    });
    return version;
  }

  async repairTripGeometry(input: RepairTripGeometryInput): Promise<Trip> {
    const current = await this.replaceTripStops(input.tripId, input.stops);
    await this.createTripGeometry({
      tripId: input.tripId,
      source: "manual",
      confidence: "manual",
      geometry: {
        type: "LineString",
        coordinates: [
          ...current.stops.map((stop) => stop.coordinates),
          ...input.manualViaPoints.map((via) => via.coordinates)
        ]
      },
      manualViaPoints: input.manualViaPoints,
      createdBy: input.createdBy,
      changeSummary: input.changeSummary,
      parentGeometryId: current.geometry?.id
    });
    return required(this.trips.get(input.tripId));
  }

  async createImport(_input: CreateImportInput): Promise<ImportRun> {
    throw new Error("Not implemented in test repository.");
  }

  async createImportRow(_input: CreateImportRowInput): Promise<ImportRow> {
    throw new Error("Not implemented in test repository.");
  }

  async listImportRows(_importId: string): Promise<ImportRow[]> {
    return [];
  }

  async findTripByImportRowHash(rowHash: string): Promise<Trip | null> {
    return [...this.trips.values()].find((trip) => trip.rawImportRow?.trainmap_import_row_hash === rowHash) ?? null;
  }

  async commitImport(input: CommitImportInput): Promise<ImportCommitResult> {
    const committedTripIds: string[] = [];
    let skippedDuplicateTrips = 0;
    let reviewRows = 0;

    for (const row of input.rows) {
      if (!row.tripInput) {
        reviewRows += 1;
        continue;
      }
      const existing = await this.findTripByImportRowHash(row.rowHash);
      if (existing) {
        skippedDuplicateTrips += 1;
        continue;
      }
      const trip = await this.createTrip(row.tripInput);
      committedTripIds.push(trip.id);
    }

    return {
      importRun: {
        id: crypto.randomUUID(),
        sourceName: input.sourceName,
        format: input.format,
        status: "committed",
        rowCount: input.rows.length,
        createdAt: new Date().toISOString()
      },
      totalRows: input.rows.length,
      persistedRows: input.rows.length,
      committedTrips: committedTripIds.length,
      skippedDuplicateTrips,
      reviewRows,
      committedTripIds
    };
  }

  async createSavedView(input: SavedView): Promise<SavedView> {
    return input;
  }

  async getExport(_id: string): Promise<ExportJob | null> {
    return null;
  }

  async createExport(input: CreateExportInput): Promise<ExportJob> {
    return {
      id: crypto.randomUUID(),
      ...input,
      status: "queued",
      createdAt: new Date().toISOString()
    };
  }

  async updateExport(input: UpdateExportInput): Promise<ExportJob> {
    return {
      id: input.id,
      type: "poster",
      preset: "1080p",
      theme: "dark",
      includeLegend: true,
      includeAttribution: true,
      status: input.status,
      outputPath: input.outputPath,
      errorMessage: input.errorMessage,
      completedAt: input.completedAt,
      createdAt: new Date().toISOString()
    };
  }
}

function inputStopsToTripStops(tripId: string, stops: TripStopInput[]) {
  return [...stops]
    .sort((a, b) => a.sequence - b.sequence)
    .map((stop, index) => ({
      id: stop.id ?? crypto.randomUUID(),
      tripId,
      stationId: stop.stationId ?? crypto.randomUUID(),
      stationName: stop.stationName,
      countryCode: stop.countryCode,
      coordinates: stop.coordinates,
      sequence: index + 1,
      arrivalAt: stop.arrivalAt,
      departureAt: stop.departureAt,
      source: stop.source ?? "manual",
      confidence: stop.confidence ?? "matched"
    }));
}

function required<T>(value: T | undefined): T {
  if (!value) {
    throw new Error("Expected value to exist.");
  }
  return value;
}
