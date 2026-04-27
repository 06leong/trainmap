import type { QueryResultRow } from "pg";
import type {
  CommitImportInput,
  Coordinate,
  CreateExportInput,
  CreateImportInput,
  CreateImportRowInput,
  CreateTripGeometryInput,
  CreateTripInput,
  ExportJob,
  ImportCommitResult,
  GeometrySource,
  ImportRow,
  ImportRun,
  Journey,
  LineStringGeometry,
  Operator,
  RepairTripGeometryInput,
  RouteConfidence,
  SavedView,
  Station,
  StationAlias,
  Tag,
  TrainmapRepository,
  Trip,
  TripFilters,
  TripGeometry,
  TripGeometryVersion,
  TripSegment,
  TripStatus,
  TripStop,
  TripStopInput,
  UpdateExportInput,
  UpdateTripInput
} from "@trainmap/domain";
import { filterTrips } from "@trainmap/domain";
import { getRoute } from "@trainmap/geo";
import { getPool, type SqlExecutor, withTransaction } from "./client";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class PostgresTrainmapRepository implements TrainmapRepository {
  constructor(private readonly executor: SqlExecutor = getPool()) {}

  async listOperators(): Promise<Operator[]> {
    const result = await this.executor.query<OperatorRow>("select id, name, country_code, color from operators order by name");
    return result.rows.map(mapOperator);
  }

  async listJourneys(): Promise<Journey[]> {
    const result = await this.executor.query<JourneyRow>(
      "select id, name, description, cover_color from journeys order by created_at desc, name"
    );
    return result.rows.map(mapJourney);
  }

  async listTags(): Promise<Tag[]> {
    const result = await this.executor.query<TagRow>("select id, label, color from tags order by label");
    return result.rows.map(mapTag);
  }

  async listTrips(filters: TripFilters = {}): Promise<Trip[]> {
    const baseResult = await this.executor.query<TripBaseRow>(`
      select
        t.id,
        t.title,
        t.mode,
        t.status,
        t.service_class,
        t.departure_date,
        t.arrival_date,
        t.operator_id,
        coalesce(o.name, 'Unknown operator') as operator_name,
        t.train_code,
        t.journey_id,
        t.distance_km,
        t.raw_import_row,
        t.created_at,
        t.updated_at
      from trips t
      left join operators o on o.id = t.operator_id
      order by t.departure_date desc, t.created_at desc
    `);

    const trips = await this.hydrateTrips(baseResult.rows);
    return filterTrips(trips, filters);
  }

  async getTrip(id: string): Promise<Trip | null> {
    const result = await this.executor.query<TripBaseRow>(
      `
        select
          t.id,
          t.title,
          t.mode,
          t.status,
          t.service_class,
          t.departure_date,
          t.arrival_date,
          t.operator_id,
          coalesce(o.name, 'Unknown operator') as operator_name,
          t.train_code,
          t.journey_id,
          t.distance_km,
          t.raw_import_row,
          t.created_at,
          t.updated_at
        from trips t
        left join operators o on o.id = t.operator_id
        where t.id = $1
      `,
      [id]
    );

    const [trip] = await this.hydrateTrips(result.rows);
    return trip ?? null;
  }

  async createTrip(input: CreateTripInput): Promise<Trip> {
    return withTransaction((client) => this.createTripInExecutor(client, input));
  }

  async updateTrip(id: string, input: UpdateTripInput): Promise<Trip> {
    return withTransaction(async (client) => {
      const current = await this.getTripWithExecutor(client, id);
      if (!current) {
        throw new Error(`Trip ${id} does not exist.`);
      }

      const operatorId =
        input.operatorId ??
        (input.operatorName ? await this.ensureOperator(client, input.operatorName, input.operatorCountryCode) : current.operatorId);

      await client.query(
        `
          update trips
          set
            title = $2,
            status = $3,
            service_class = $4,
            departure_date = $5,
            arrival_date = $6,
            operator_id = $7,
            train_code = $8,
            journey_id = $9,
            distance_km = $10,
            updated_at = now()
          where id = $1
        `,
        [
          id,
          input.title ?? current.title,
          input.status ?? current.status,
          input.serviceClass ?? current.serviceClass,
          input.date ?? current.date,
          input.arrivalDate ?? current.arrivalDate ?? null,
          operatorId,
          input.trainCode ?? current.trainCode ?? null,
          input.journeyId ?? current.journeyId ?? null,
          input.distanceKm ?? current.distanceKm
        ]
      );

      if (input.tagIds) {
        await this.replaceTripTagsInExecutor(client, id, input.tagIds);
      }

      const updated = await this.getTripWithExecutor(client, id);
      if (!updated) {
        throw new Error(`Updated trip ${id} could not be loaded.`);
      }
      return updated;
    });
  }

  async deleteTrip(id: string): Promise<void> {
    await this.executor.query("delete from trips where id = $1", [id]);
  }

  async listStations(query?: string): Promise<Station[]> {
    const params = query ? [`%${query}%`] : [];
    const result = await this.executor.query<StationRow>(
      `
        select id, name, country_code, timezone, source, st_x(geom) as longitude, st_y(geom) as latitude
        from stations
        ${query ? "where name ilike $1" : ""}
        order by name
        limit ${query ? 200 : 5000}
      `,
      params
    );
    return result.rows.map(mapStation);
  }

  async listStationAliases(stationId: string): Promise<StationAlias[]> {
    const result = await this.executor.query<StationAliasRow>(
      "select id, station_id, alias, locale, source from station_aliases where station_id = $1 order by alias",
      [stationId]
    );
    return result.rows.map(mapStationAlias);
  }

  async replaceTripStops(tripId: string, stops: TripStopInput[]): Promise<Trip> {
    return withTransaction(async (client) => {
      await this.replaceTripStopsInExecutor(client, tripId, stops, 0);
      const trip = await this.getTripWithExecutor(client, tripId);
      if (!trip) {
        throw new Error(`Trip ${tripId} does not exist.`);
      }
      return trip;
    });
  }

  async createTripGeometry(input: CreateTripGeometryInput): Promise<TripGeometryVersion> {
    return withTransaction((client) => this.insertGeometryInExecutor(client, input));
  }

  async repairTripGeometry(input: RepairTripGeometryInput): Promise<Trip> {
    return withTransaction(async (client) => {
      const existing = await this.getTripWithExecutor(client, input.tripId);
      if (!existing) {
        throw new Error(`Trip ${input.tripId} does not exist.`);
      }

      const stops = await this.replaceTripStopsInExecutor(client, input.tripId, input.stops, existing.distanceKm);
      const route = getRoute({
        tripId: input.tripId,
        stops,
        manualViaPoints: input.manualViaPoints
      });

      await this.insertGeometryInExecutor(client, {
        tripId: input.tripId,
        source: route.source,
        confidence: route.confidence,
        geometry: route.geometry,
        manualViaPoints: input.manualViaPoints,
        createdBy: input.createdBy ?? "user",
        changeSummary: input.changeSummary,
        parentGeometryId: existing.geometry?.id,
        notes: route.warnings.join(" ")
      });

      const repaired = await this.getTripWithExecutor(client, input.tripId);
      if (!repaired) {
        throw new Error(`Repaired trip ${input.tripId} could not be loaded.`);
      }
      return repaired;
    });
  }

  async createImport(input: CreateImportInput): Promise<ImportRun> {
    const result = await this.executor.query<ImportRunRow>(
      `
        insert into imports (source_name, format, status, row_count)
        values ($1, $2, $3, $4)
        returning id, source_name, format, status, row_count, created_at
      `,
      [input.sourceName, input.format, input.status ?? "draft", input.rowCount]
    );
    return mapImportRun(result.rows[0]);
  }

  async createImportRow(input: CreateImportRowInput): Promise<ImportRow> {
    const result = await this.executor.query<ImportRowRow>(
      `
        insert into import_rows (import_id, row_number, raw, normalized, status, messages)
        values ($1, $2, $3, $4, $5, $6)
        returning id, import_id, row_number, raw, normalized, status, messages
      `,
      [input.importId, input.rowNumber, input.raw, input.normalized, input.status, input.messages]
    );
    return mapImportRow(result.rows[0]);
  }

  async listImportRows(importId: string): Promise<ImportRow[]> {
    const result = await this.executor.query<ImportRowRow>(
      "select id, import_id, row_number, raw, normalized, status, messages from import_rows where import_id = $1 order by row_number",
      [importId]
    );
    return result.rows.map(mapImportRow);
  }

  async createSavedView(input: SavedView): Promise<SavedView> {
    const result = await this.executor.query<SavedViewRow>(
      `
        insert into saved_views (id, name, filters, is_public)
        values ($1, $2, $3, $4)
        returning id, name, filters, is_public, created_at
      `,
      [input.id, input.name, input.filters, input.isPublic]
    );
    return mapSavedView(result.rows[0]);
  }

  async getExport(id: string): Promise<ExportJob | null> {
    const result = await this.executor.query<ExportJobRow>(
      `
        select
          id, type, preset, theme, title, subtitle, include_legend,
          include_attribution, render_url, output_path, status,
          error_message, created_at, completed_at
        from exports
        where id = $1
      `,
      [id]
    );
    return result.rows[0] ? mapExportJob(result.rows[0]) : null;
  }

  async createExport(input: CreateExportInput): Promise<ExportJob> {
    const result = await this.executor.query<ExportJobRow>(
      `
        insert into exports (
          type, preset, theme, title, subtitle, include_legend,
          include_attribution, render_url, status
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, 'queued')
        returning
          id, type, preset, theme, title, subtitle, include_legend,
          include_attribution, render_url, output_path, status,
          error_message, created_at, completed_at
      `,
      [
        input.type,
        input.preset,
        input.theme,
        input.title ?? null,
        input.subtitle ?? null,
        input.includeLegend,
        input.includeAttribution,
        input.renderUrl
      ]
    );
    return mapExportJob(result.rows[0]);
  }

  async updateExport(input: UpdateExportInput): Promise<ExportJob> {
    const result = await this.executor.query<ExportJobRow>(
      `
        update exports
        set
          status = $2::export_status,
          output_path = coalesce($3, output_path),
          error_message = $4,
          completed_at = case
            when $2::export_status in ('complete', 'failed') then coalesce($5::timestamptz, now())
            else completed_at
          end
        where id = $1
        returning
          id, type, preset, theme, title, subtitle, include_legend,
          include_attribution, render_url, output_path, status,
          error_message, created_at, completed_at
      `,
      [input.id, input.status, input.outputPath ?? null, input.errorMessage ?? null, input.completedAt ?? null]
    );
    if (!result.rows[0]) {
      throw new Error(`Export ${input.id} does not exist.`);
    }
    return mapExportJob(result.rows[0]);
  }

  async findTripByImportRowHash(rowHash: string): Promise<Trip | null> {
    return this.findTripByImportRowHashInExecutor(this.executor, rowHash);
  }

  async commitImport(input: CommitImportInput): Promise<ImportCommitResult> {
    return withTransaction(async (client) => {
      const importRun = await this.createImportInExecutor(client, {
        sourceName: input.sourceName,
        format: input.format,
        status: "committed",
        rowCount: input.rows.length
      });
      const committedTripIds: string[] = [];
      let skippedDuplicateTrips = 0;
      let reviewRows = 0;

      for (const row of input.rows) {
        await this.createImportRowInExecutor(client, {
          importId: importRun.id,
          rowNumber: row.rowNumber,
          raw: row.raw,
          normalized: row.normalized,
          status: row.status,
          messages: row.messages
        });

        if (!row.tripInput) {
          reviewRows += 1;
          continue;
        }

        const existing = await this.findTripByImportRowHashInExecutor(client, row.rowHash);
        if (existing) {
          skippedDuplicateTrips += 1;
          continue;
        }

        const trip = await this.createTripInExecutor(client, {
          ...row.tripInput,
          rawImportRow: {
            ...(row.tripInput.rawImportRow ?? {}),
            trainmap_import_id: importRun.id,
            trainmap_import_row_hash: row.rowHash,
            trainmap_import_row_status: row.status
          }
        });
        committedTripIds.push(trip.id);
      }

      return {
        importRun,
        totalRows: input.rows.length,
        persistedRows: input.rows.length,
        committedTrips: committedTripIds.length,
        skippedDuplicateTrips,
        reviewRows,
        committedTripIds
      };
    });
  }

  private async createTripInExecutor(executor: SqlExecutor, input: CreateTripInput): Promise<Trip> {
    const operatorId = input.operatorId ?? (await this.ensureOperator(executor, input.operatorName, input.operatorCountryCode));
    const tripResult = await executor.query<{ id: string }>(
      `
        insert into trips (
          title, mode, status, service_class, departure_date, arrival_date,
          operator_id, train_code, journey_id, distance_km, raw_import_row
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        returning id
      `,
      [
        input.title,
        input.mode ?? "rail",
        input.status ?? "completed",
        input.serviceClass ?? "second",
        input.date,
        input.arrivalDate ?? null,
        operatorId,
        input.trainCode ?? null,
        input.journeyId ?? null,
        input.distanceKm ?? 0,
        input.rawImportRow ?? null
      ]
    );
    const tripId = tripResult.rows[0].id;

    const stops = await this.replaceTripStopsInExecutor(executor, tripId, input.stops, input.distanceKm ?? 0);
    await this.replaceTripTagsInExecutor(executor, tripId, input.tagIds ?? []);

    if (input.initialGeometry) {
      await this.insertGeometryInExecutor(executor, {
        tripId,
        source: input.initialGeometry.source,
        confidence: input.initialGeometry.confidence,
        geometry: input.initialGeometry.geometry,
        manualViaPoints: input.initialGeometry.manualViaPoints ?? [],
        notes: input.initialGeometry.notes,
        createdBy: input.initialGeometry.createdBy ?? "user",
        changeSummary: "Initial geometry"
      });
    } else if (stops.length >= 2) {
      const route = getRoute({ tripId, stops });
      await this.insertGeometryInExecutor(executor, {
        tripId,
        source: route.source,
        confidence: route.confidence,
        geometry: route.geometry,
        manualViaPoints: [],
        createdBy: "user",
        changeSummary: "Initial inferred geometry",
        notes: route.warnings.join(" ")
      });
    }

    const created = await this.getTripWithExecutor(executor, tripId);
    if (!created) {
      throw new Error(`Created trip ${tripId} could not be loaded.`);
    }
    return created;
  }

  private async createImportInExecutor(executor: SqlExecutor, input: CreateImportInput): Promise<ImportRun> {
    const result = await executor.query<ImportRunRow>(
      `
        insert into imports (source_name, format, status, row_count)
        values ($1, $2, $3, $4)
        returning id, source_name, format, status, row_count, created_at
      `,
      [input.sourceName, input.format, input.status ?? "draft", input.rowCount]
    );
    return mapImportRun(result.rows[0]);
  }

  private async createImportRowInExecutor(executor: SqlExecutor, input: CreateImportRowInput): Promise<ImportRow> {
    const result = await executor.query<ImportRowRow>(
      `
        insert into import_rows (import_id, row_number, raw, normalized, status, messages)
        values ($1, $2, $3, $4, $5, $6)
        returning id, import_id, row_number, raw, normalized, status, messages
      `,
      [input.importId, input.rowNumber, input.raw, input.normalized, input.status, input.messages]
    );
    return mapImportRow(result.rows[0]);
  }

  private async findTripByImportRowHashInExecutor(executor: SqlExecutor, rowHash: string): Promise<Trip | null> {
    const result = await executor.query<TripBaseRow>(
      `
        select
          t.id,
          t.title,
          t.mode,
          t.status,
          t.service_class,
          t.departure_date,
          t.arrival_date,
          t.operator_id,
          coalesce(o.name, 'Unknown operator') as operator_name,
          t.train_code,
          t.journey_id,
          t.distance_km,
          t.raw_import_row,
          t.created_at,
          t.updated_at
        from trips t
        left join operators o on o.id = t.operator_id
        where t.raw_import_row ->> 'trainmap_import_row_hash' = $1
        limit 1
      `,
      [rowHash]
    );
    const [trip] = await this.hydrateTrips(result.rows, executor);
    return trip ?? null;
  }

  private async getTripWithExecutor(executor: SqlExecutor, id: string): Promise<Trip | null> {
    const result = await executor.query<TripBaseRow>(
      `
        select
          t.id,
          t.title,
          t.mode,
          t.status,
          t.service_class,
          t.departure_date,
          t.arrival_date,
          t.operator_id,
          coalesce(o.name, 'Unknown operator') as operator_name,
          t.train_code,
          t.journey_id,
          t.distance_km,
          t.raw_import_row,
          t.created_at,
          t.updated_at
        from trips t
        left join operators o on o.id = t.operator_id
        where t.id = $1
      `,
      [id]
    );
    const [trip] = await this.hydrateTrips(result.rows, executor);
    return trip ?? null;
  }

  private async hydrateTrips(rows: TripBaseRow[], executor: SqlExecutor = this.executor): Promise<Trip[]> {
    if (rows.length === 0) {
      return [];
    }

    const tripIds = rows.map((row) => row.id);
    const [stopsResult, segmentsResult, geometryResult, versionsResult, tagsResult] = await Promise.all([
      executor.query<TripStopRow>(
        `
          select
            id, trip_id, station_id, station_name, country_code, stop_sequence,
            arrival_at, departure_at, source, match_confidence,
            st_x(geom) as longitude,
            st_y(geom) as latitude
          from trip_stops
          where trip_id = any($1::uuid[])
          order by trip_id, stop_sequence
        `,
        [tripIds]
      ),
      executor.query<TripSegmentRow>(
        `
          select
            id, trip_id, from_stop_id, to_stop_id, distance_km,
            case when geom is null then null else st_asgeojson(geom)::json end as geometry
          from trip_segments
          where trip_id = any($1::uuid[])
          order by created_at
        `,
        [tripIds]
      ),
      executor.query<TripGeometryRow>(
        `
          select distinct on (trip_id)
            id, trip_id, version, source, confidence,
            st_asgeojson(geom)::json as geometry,
            manual_via_points, notes, created_by, created_at
          from trip_geometries
          where trip_id = any($1::uuid[])
          order by trip_id, version desc
        `,
        [tripIds]
      ),
      executor.query<TripGeometryVersionRow>(
        `
          select
            id, trip_id, geometry_id, parent_geometry_id, version, source, confidence,
            st_asgeojson(geom)::json as geometry,
            manual_via_points, change_summary, created_by, created_at
          from trip_geometry_versions
          where trip_id = any($1::uuid[])
          order by trip_id, version desc
        `,
        [tripIds]
      ),
      executor.query<{ trip_id: string; tag_id: string }>(
        "select trip_id, tag_id from trip_tags where trip_id = any($1::uuid[])",
        [tripIds]
      )
    ]);

    const stopsByTrip = groupBy(stopsResult.rows.map(mapTripStop), (stop) => stop.tripId);
    const segmentsByTrip = groupBy(segmentsResult.rows.map(mapTripSegment), (segment) => segment.tripId);
    const geometryByTrip = new Map(geometryResult.rows.map((row) => [row.trip_id, mapTripGeometry(row)]));
    const versionsByTrip = groupBy(versionsResult.rows.map(mapTripGeometryVersion), (version) => version.tripId);
    const tagIdsByTrip = groupBy(tagsResult.rows, (row) => row.trip_id);

    return rows.map((row) => {
      const stops = stopsByTrip.get(row.id) ?? [];
      return {
        id: row.id,
        title: row.title,
        mode: row.mode,
        status: row.status,
        serviceClass: row.service_class,
        date: dateString(row.departure_date),
        arrivalDate: row.arrival_date ? dateString(row.arrival_date) : undefined,
        operatorId: row.operator_id ?? "",
        operatorName: row.operator_name,
        trainCode: row.train_code ?? undefined,
        journeyId: row.journey_id ?? undefined,
        tagIds: (tagIdsByTrip.get(row.id) ?? []).map((tag) => tag.tag_id),
        countryCodes: [...new Set(stops.map((stop) => stop.countryCode).filter(Boolean))],
        distanceKm: Number(row.distance_km),
        stops,
        segments: segmentsByTrip.get(row.id) ?? [],
        geometry: geometryByTrip.get(row.id),
        geometryVersions: versionsByTrip.get(row.id) ?? [],
        rawImportRow: row.raw_import_row ?? undefined,
        createdAt: isoString(row.created_at),
        updatedAt: isoString(row.updated_at)
      };
    });
  }

  private async ensureOperator(executor: SqlExecutor, name: string, countryCode?: string): Promise<string> {
    const existing = await executor.query<{ id: string }>(
      `
        select id from operators
        where lower(name) = lower($1)
          and (($2::char(2) is null and country_code is null) or country_code = $2::char(2))
        limit 1
      `,
      [name, countryCode ?? null]
    );
    if (existing.rows[0]) {
      return existing.rows[0].id;
    }

    const inserted = await executor.query<{ id: string }>(
      "insert into operators (name, country_code) values ($1, $2) returning id",
      [name, countryCode ?? null]
    );
    return inserted.rows[0].id;
  }

  private async ensureStation(executor: SqlExecutor, input: TripStopInput): Promise<string> {
    if (input.stationId && uuidPattern.test(input.stationId)) {
      const existingById = await executor.query<{ id: string }>("select id from stations where id = $1", [input.stationId]);
      if (existingById.rows[0]) {
        return existingById.rows[0].id;
      }
    }

    const existing = await executor.query<{ id: string }>(
      "select id from stations where lower(name) = lower($1) and country_code = $2 limit 1",
      [input.stationName, input.countryCode]
    );
    if (existing.rows[0]) {
      return existing.rows[0].id;
    }

    const inserted = await executor.query<{ id: string }>(
      `
        insert into stations (name, country_code, geom)
        values ($1, $2, st_setsrid(st_makepoint($3, $4), 4326))
        returning id
      `,
      [input.stationName, input.countryCode, input.coordinates[0], input.coordinates[1]]
    );
    return inserted.rows[0].id;
  }

  private async replaceTripStopsInExecutor(
    executor: SqlExecutor,
    tripId: string,
    stops: TripStopInput[],
    tripDistanceKm: number
  ): Promise<Array<TripStop & { tripId: string }>> {
    await executor.query("delete from trip_segments where trip_id = $1", [tripId]);
    await executor.query("delete from trip_stops where trip_id = $1", [tripId]);

    const sortedStops = [...stops].sort((a, b) => a.sequence - b.sequence);
    const createdStops: Array<TripStop & { tripId: string }> = [];

    for (const [index, stop] of sortedStops.entries()) {
      const stationId = await this.ensureStation(executor, stop);
      const stopId = stop.id && uuidPattern.test(stop.id) ? stop.id : crypto.randomUUID();
      const result = await executor.query<TripStopRow>(
        `
          insert into trip_stops (
            id, trip_id, station_id, station_name, country_code, stop_sequence,
            arrival_at, departure_at, source, match_confidence, geom
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, st_setsrid(st_makepoint($11, $12), 4326))
          returning
            id, trip_id, station_id, station_name, country_code, stop_sequence,
            arrival_at, departure_at, source, match_confidence,
            st_x(geom) as longitude,
            st_y(geom) as latitude
        `,
        [
          stopId,
          tripId,
          stationId,
          stop.stationName,
          stop.countryCode,
          index + 1,
          stop.arrivalAt ?? null,
          stop.departureAt ?? null,
          stop.source ?? "manual",
          stop.confidence ?? "matched",
          stop.coordinates[0],
          stop.coordinates[1]
        ]
      );
      createdStops.push(mapTripStop(result.rows[0]));
    }

    const segmentDistance = createdStops.length > 1 ? tripDistanceKm / (createdStops.length - 1) : 0;
    for (let index = 0; index < createdStops.length - 1; index += 1) {
      const from = createdStops[index];
      const to = createdStops[index + 1];
      await executor.query(
        `
          insert into trip_segments (trip_id, from_stop_id, to_stop_id, distance_km, geom)
          values (
            $1, $2, $3, $4,
            st_makeline(
              st_setsrid(st_makepoint($5, $6), 4326),
              st_setsrid(st_makepoint($7, $8), 4326)
            )
          )
        `,
        [tripId, from.id, to.id, segmentDistance, from.coordinates[0], from.coordinates[1], to.coordinates[0], to.coordinates[1]]
      );
    }

    return createdStops;
  }

  private async replaceTripTagsInExecutor(executor: SqlExecutor, tripId: string, tagIds: string[]): Promise<void> {
    await executor.query("delete from trip_tags where trip_id = $1", [tripId]);
    for (const tagId of tagIds.filter((id) => uuidPattern.test(id))) {
      await executor.query("insert into trip_tags (trip_id, tag_id) values ($1, $2) on conflict do nothing", [tripId, tagId]);
    }
  }

  private async insertGeometryInExecutor(
    executor: SqlExecutor,
    input: CreateTripGeometryInput
  ): Promise<TripGeometryVersion> {
    const versionResult = await executor.query<{ version: number }>(
      "select coalesce(max(version), 0) + 1 as version from trip_geometries where trip_id = $1",
      [input.tripId]
    );
    const version = Number(versionResult.rows[0].version);
    const createdBy = input.createdBy ?? "user";

    const geometryResult = await executor.query<TripGeometryRow>(
      `
        insert into trip_geometries (
          trip_id, version, source, confidence, geom, manual_via_points, notes, created_by
        )
        values ($1, $2, $3, $4, st_setsrid(st_geomfromgeojson($5), 4326), $6, $7, $8)
        returning
          id, trip_id, version, source, confidence,
          st_asgeojson(geom)::json as geometry,
          manual_via_points, notes, created_by, created_at
      `,
      [
        input.tripId,
        version,
        input.source,
        input.confidence,
        JSON.stringify(input.geometry),
        JSON.stringify(input.manualViaPoints ?? []),
        input.notes ?? null,
        createdBy
      ]
    );

    const geometry = geometryResult.rows[0];
    const versionInsert = await executor.query<TripGeometryVersionRow>(
      `
        insert into trip_geometry_versions (
          trip_id, geometry_id, parent_geometry_id, version, source, confidence,
          geom, manual_via_points, change_summary, created_by
        )
        values ($1, $2, $3, $4, $5, $6, st_setsrid(st_geomfromgeojson($7), 4326), $8, $9, $10)
        returning
          id, trip_id, geometry_id, parent_geometry_id, version, source, confidence,
          st_asgeojson(geom)::json as geometry,
          manual_via_points, change_summary, created_by, created_at
      `,
      [
        input.tripId,
        geometry.id,
        input.parentGeometryId ?? null,
        version,
        input.source,
        input.confidence,
        JSON.stringify(input.geometry),
        JSON.stringify(input.manualViaPoints ?? []),
        input.changeSummary,
        createdBy
      ]
    );

    return mapTripGeometryVersion(versionInsert.rows[0]);
  }
}

interface OperatorRow extends QueryResultRow {
  id: string;
  name: string;
  country_code: string | null;
  color: string | null;
}

interface JourneyRow extends QueryResultRow {
  id: string;
  name: string;
  description: string | null;
  cover_color: string | null;
}

interface TagRow extends QueryResultRow {
  id: string;
  label: string;
  color: string;
}

interface StationRow extends QueryResultRow {
  id: string;
  name: string;
  country_code: string;
  timezone: string | null;
  source: string | null;
  longitude: number | string;
  latitude: number | string;
}

interface StationAliasRow extends QueryResultRow {
  id: string;
  station_id: string;
  alias: string;
  locale: string | null;
  source: string | null;
}

interface TripBaseRow extends QueryResultRow {
  id: string;
  title: string;
  mode: Trip["mode"];
  status: TripStatus;
  service_class: Trip["serviceClass"];
  departure_date: string | Date;
  arrival_date: string | Date | null;
  operator_id: string | null;
  operator_name: string;
  train_code: string | null;
  journey_id: string | null;
  distance_km: string | number;
  raw_import_row: Record<string, unknown> | null;
  created_at: string | Date;
  updated_at: string | Date;
}

interface TripStopRow extends QueryResultRow {
  id: string;
  trip_id: string;
  station_id: string;
  station_name: string;
  country_code: string;
  stop_sequence: number;
  arrival_at: string | Date | null;
  departure_at: string | Date | null;
  source: TripStop["source"];
  match_confidence: TripStop["confidence"];
  longitude: number | string;
  latitude: number | string;
}

interface TripSegmentRow extends QueryResultRow {
  id: string;
  trip_id: string;
  from_stop_id: string;
  to_stop_id: string;
  distance_km: number | string;
  geometry: LineStringGeometry | null;
}

interface TripGeometryRow extends QueryResultRow {
  id: string;
  trip_id: string;
  version: number;
  source: GeometrySource;
  confidence: RouteConfidence;
  geometry: LineStringGeometry;
  manual_via_points: TripGeometry["manualViaPoints"] | string | null;
  notes: string | null;
  created_by: string;
  created_at: string | Date;
}

interface TripGeometryVersionRow extends QueryResultRow {
  id: string;
  trip_id: string;
  geometry_id: string;
  parent_geometry_id: string | null;
  version: number;
  source: GeometrySource;
  confidence: RouteConfidence;
  geometry: LineStringGeometry;
  manual_via_points: TripGeometry["manualViaPoints"] | string | null;
  change_summary: string;
  created_by: string;
  created_at: string | Date;
}

interface ImportRunRow extends QueryResultRow {
  id: string;
  source_name: string;
  format: ImportRun["format"];
  status: ImportRun["status"];
  row_count: number;
  created_at: string | Date;
}

interface ImportRowRow extends QueryResultRow {
  id: string;
  import_id: string;
  row_number: number;
  raw: Record<string, string>;
  normalized: Record<string, unknown>;
  status: ImportRow["status"];
  messages: string[];
}

interface SavedViewRow extends QueryResultRow {
  id: string;
  name: string;
  filters: SavedView["filters"];
  is_public: boolean;
  created_at: string | Date;
}

interface ExportJobRow extends QueryResultRow {
  id: string;
  type: ExportJob["type"];
  preset: ExportJob["preset"];
  theme: ExportJob["theme"];
  title: string | null;
  subtitle: string | null;
  include_legend: boolean;
  include_attribution: boolean;
  render_url: string | null;
  output_path: string | null;
  status: ExportJob["status"];
  error_message: string | null;
  created_at: string | Date;
  completed_at: string | Date | null;
}

function mapOperator(row: OperatorRow): Operator {
  return {
    id: row.id,
    name: row.name,
    countryCode: row.country_code ?? undefined,
    color: row.color ?? undefined
  };
}

function mapJourney(row: JourneyRow): Journey {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    coverColor: row.cover_color ?? undefined
  };
}

function mapTag(row: TagRow): Tag {
  return {
    id: row.id,
    label: row.label,
    color: row.color
  };
}

function mapStation(row: StationRow): Station {
  return {
    id: row.id,
    name: row.name,
    countryCode: row.country_code,
    coordinates: [Number(row.longitude), Number(row.latitude)],
    source: row.source ?? undefined,
    timezone: row.timezone ?? undefined
  };
}

function mapStationAlias(row: StationAliasRow): StationAlias {
  return {
    id: row.id,
    stationId: row.station_id,
    alias: row.alias,
    locale: row.locale ?? undefined,
    source: row.source ?? undefined
  };
}

function mapTripStop(row: TripStopRow): TripStop & { tripId: string } {
  return {
    id: row.id,
    tripId: row.trip_id,
    stationId: row.station_id,
    stationName: row.station_name,
    countryCode: row.country_code,
    coordinates: [Number(row.longitude), Number(row.latitude)] as Coordinate,
    sequence: row.stop_sequence,
    arrivalAt: row.arrival_at ? isoString(row.arrival_at) : undefined,
    departureAt: row.departure_at ? isoString(row.departure_at) : undefined,
    source: row.source,
    confidence: row.match_confidence
  };
}

function mapTripSegment(row: TripSegmentRow): TripSegment & { tripId: string } {
  return {
    id: row.id,
    tripId: row.trip_id,
    fromStopId: row.from_stop_id,
    toStopId: row.to_stop_id,
    distanceKm: Number(row.distance_km),
    geometry: row.geometry ?? undefined
  };
}

function mapTripGeometry(row: TripGeometryRow): TripGeometry {
  return {
    id: row.id,
    tripId: row.trip_id,
    version: row.version,
    source: row.source,
    confidence: row.confidence,
    geometry: row.geometry,
    manualViaPoints: parseJsonArray(row.manual_via_points),
    createdAt: isoString(row.created_at),
    createdBy: row.created_by,
    notes: row.notes ?? undefined
  };
}

function mapTripGeometryVersion(row: TripGeometryVersionRow): TripGeometryVersion {
  return {
    id: row.id,
    tripId: row.trip_id,
    version: row.version,
    source: row.source,
    confidence: row.confidence,
    geometry: row.geometry,
    manualViaPoints: parseJsonArray(row.manual_via_points),
    parentGeometryId: row.parent_geometry_id ?? undefined,
    createdAt: isoString(row.created_at),
    createdBy: row.created_by,
    changeSummary: row.change_summary
  };
}

function mapImportRun(row: ImportRunRow): ImportRun {
  return {
    id: row.id,
    sourceName: row.source_name,
    format: row.format,
    status: row.status,
    rowCount: row.row_count,
    createdAt: isoString(row.created_at)
  };
}

function mapImportRow(row: ImportRowRow): ImportRow {
  return {
    id: row.id,
    importId: row.import_id,
    rowNumber: row.row_number,
    raw: row.raw,
    normalized: row.normalized,
    status: row.status,
    messages: row.messages
  };
}

function mapSavedView(row: SavedViewRow): SavedView {
  return {
    id: row.id,
    name: row.name,
    filters: row.filters,
    isPublic: row.is_public,
    createdAt: isoString(row.created_at)
  };
}

function mapExportJob(row: ExportJobRow): ExportJob {
  return {
    id: row.id,
    type: row.type,
    preset: row.preset,
    theme: row.theme,
    title: row.title ?? undefined,
    subtitle: row.subtitle ?? undefined,
    includeLegend: row.include_legend,
    includeAttribution: row.include_attribution,
    renderUrl: row.render_url ?? undefined,
    outputPath: row.output_path ?? undefined,
    status: row.status,
    errorMessage: row.error_message ?? undefined,
    createdAt: isoString(row.created_at),
    completedAt: row.completed_at ? isoString(row.completed_at) : undefined
  };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const itemKey = key(item);
    map.set(itemKey, [...(map.get(itemKey) ?? []), item]);
  }
  return map;
}

function parseJsonArray<T>(value: T[] | string | null): T[] {
  if (!value) {
    return [];
  }
  return typeof value === "string" ? JSON.parse(value) : value;
}

function isoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function dateString(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}
