import type { CommitImportInput, CreateTripInput, ImportRow, Station, TripStopInput } from "@trainmap/domain";
import { parseCsv } from "./csv";

export type ImportField =
  | "from_station_name"
  | "to_station_name"
  | "departure_date"
  | "departure_time"
  | "arrival_date"
  | "arrival_time"
  | "operator"
  | "train_code"
  | "distance"
  | "tags"
  | "notes";

export type ColumnMapping = Partial<Record<ImportField, string>>;

export const importFields: ImportField[] = [
  "from_station_name",
  "to_station_name",
  "departure_date",
  "departure_time",
  "arrival_date",
  "arrival_time",
  "operator",
  "train_code",
  "distance",
  "tags",
  "notes"
];

export interface StationMatch {
  input: string;
  station?: Station;
  score: number;
  status: "matched" | "fuzzy" | "unmatched";
}

export interface ImportPreviewRow {
  rowNumber: number;
  raw: Record<string, string>;
  normalized: Record<ImportField, string>;
  fromStation: StationMatch;
  toStation: StationMatch;
  status: "matched" | "fuzzy_matched" | "unmatched" | "invalid";
  messages: string[];
}

export interface ImportPreview {
  headers: string[];
  mapping: ColumnMapping;
  rows: ImportPreviewRow[];
  counts: Record<ImportPreviewRow["status"], number>;
}

const headerHints: Record<ImportField, string[]> = {
  from_station_name: ["from_station_name", "from", "origin", "departure_station", "start"],
  to_station_name: ["to_station_name", "to", "destination", "arrival_station", "end"],
  departure_date: ["departure_date", "date", "start_date"],
  departure_time: ["departure_time", "time", "start_time"],
  arrival_date: ["arrival_date", "end_date"],
  arrival_time: ["arrival_time", "end_time"],
  operator: ["operator", "company", "carrier"],
  train_code: ["train_code", "train", "service", "service_number"],
  distance: ["distance", "distance_km", "km"],
  tags: ["tags", "tag"],
  notes: ["notes", "note", "comment"]
};

export function inferColumnMapping(headers: string[]): ColumnMapping {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeText(header)
  }));
  const mapping: ColumnMapping = {};

  for (const [field, hints] of Object.entries(headerHints) as Array<[ImportField, string[]]>) {
    const match = normalizedHeaders.find((header) => hints.includes(header.normalized));
    if (match) {
      mapping[field] = match.original;
    }
  }

  return mapping;
}

export function buildImportPreview(
  csvText: string,
  stations: Station[],
  suppliedMapping?: ColumnMapping
): ImportPreview {
  const parsed = parseCsv(csvText);
  const mapping = suppliedMapping ?? inferColumnMapping(parsed.headers);
  const rows = parsed.rows.map((row, index) => previewRow(index + 2, row, mapping, stations));
  const rowsByNumber = new Map(rows.map((row) => [row.rowNumber, row]));
  for (const error of parsed.errors) {
    const row = rowsByNumber.get(error.rowNumber);
    if (row) {
      row.messages.push(error.message);
      row.status = "invalid";
    }
  }
  const counts: ImportPreview["counts"] = {
    matched: 0,
    fuzzy_matched: 0,
    unmatched: 0,
    invalid: 0
  };

  rows.forEach((row) => {
    counts[row.status] += 1;
  });

  return {
    headers: parsed.headers,
    mapping,
    rows,
    counts
  };
}

export function matchStation(input: string, stations: Station[]): StationMatch {
  const normalizedInput = normalizeText(input);
  if (!normalizedInput) {
    return { input, score: 0, status: "unmatched" };
  }

  const exact = stations.find((station) => normalizeText(station.name) === normalizedInput);
  if (exact) {
    return { input, station: exact, score: 1, status: "matched" };
  }

  const scored = stations
    .map((station) => {
      const stationName = normalizeText(station.name);
      const score =
        stationName.includes(normalizedInput) || normalizedInput.includes(stationName)
          ? 0.86
          : similarity(normalizedInput, stationName);
      return { station, score };
    })
    .sort((a, b) => b.score - a.score)[0];

  if (scored && scored.score >= 0.72) {
    return { input, station: scored.station, score: scored.score, status: "fuzzy" };
  }

  return { input, score: scored?.score ?? 0, status: "unmatched" };
}

export function importRowFingerprint(row: ImportPreviewRow): string {
  return stableHash(JSON.stringify(sortRecord(row.raw)));
}

export function isCommittableImportRow(row: ImportPreviewRow): boolean {
  return row.status === "matched" || row.status === "fuzzy_matched";
}

export function previewRowToTripInput(row: ImportPreviewRow, rowHash = importRowFingerprint(row)): CreateTripInput | null {
  if (!isCommittableImportRow(row) || !row.fromStation.station || !row.toStation.station) {
    return null;
  }

  const fromStop = stationToStop(row.fromStation.station, 1, row.fromStation.status, combineDateTime(row.normalized.departure_date, row.normalized.departure_time));
  const toStop = stationToStop(
    row.toStation.station,
    2,
    row.toStation.status,
    combineDateTime(row.normalized.arrival_date || row.normalized.departure_date, row.normalized.arrival_time)
  );

  return {
    title: `${row.fromStation.station.name} to ${row.toStation.station.name}`,
    date: row.normalized.departure_date,
    arrivalDate: row.normalized.arrival_date || undefined,
    operatorName: row.normalized.operator || "Unknown operator",
    trainCode: row.normalized.train_code || undefined,
    distanceKm: parseDistance(row.normalized.distance),
    stops: [fromStop, toStop],
    rawImportRow: {
      ...row.raw,
      trainmap_import_row_hash: rowHash,
      trainmap_import_status: row.status,
      trainmap_import_row_number: row.rowNumber
    }
  };
}

export function buildImportCommitInput(
  preview: ImportPreview,
  sourceName: string,
  existingRowHashes = new Set<string>()
): CommitImportInput {
  return {
    sourceName,
    format: "viaduct_csv",
    rows: preview.rows.map((row) => {
      const rowHash = importRowFingerprint(row);
      const tripInput = existingRowHashes.has(rowHash) ? null : previewRowToTripInput(row, rowHash);

      return {
        rowNumber: row.rowNumber,
        raw: row.raw,
        normalized: {
          ...row.normalized,
          from_station_id: row.fromStation.station?.id,
          from_station_match_status: row.fromStation.status,
          from_station_match_score: row.fromStation.score,
          to_station_id: row.toStation.station?.id,
          to_station_match_status: row.toStation.status,
          to_station_match_score: row.toStation.score,
          trainmap_import_row_hash: rowHash,
          trainmap_duplicate: existingRowHashes.has(rowHash)
        },
        status: row.status as ImportRow["status"],
        messages: row.messages,
        rowHash,
        tripInput: tripInput ?? undefined
      };
    })
  };
}

function previewRow(
  rowNumber: number,
  raw: Record<string, string>,
  mapping: ColumnMapping,
  stations: Station[]
): ImportPreviewRow {
  const normalized = Object.fromEntries(
    importFields.map((field) => [field, valueFor(raw, mapping[field])])
  ) as Record<ImportField, string>;
  const messages: string[] = [];
  const fromStation = matchStation(normalized.from_station_name, stations);
  const toStation = matchStation(normalized.to_station_name, stations);

  if (!normalized.departure_date) {
    messages.push("Missing departure date.");
  } else if (!isIsoDate(normalized.departure_date)) {
    messages.push(`Invalid departure date: ${normalized.departure_date}.`);
  }
  if (normalized.arrival_date && !isIsoDate(normalized.arrival_date)) {
    messages.push(`Invalid arrival date: ${normalized.arrival_date}.`);
  }
  if (normalized.departure_time && !isTime(normalized.departure_time)) {
    messages.push(`Invalid departure time: ${normalized.departure_time}.`);
  }
  if (normalized.arrival_time && !isTime(normalized.arrival_time)) {
    messages.push(`Invalid arrival time: ${normalized.arrival_time}.`);
  }
  if (fromStation.status === "unmatched") {
    messages.push(`Origin station not matched: ${normalized.from_station_name || "empty"}.`);
  }
  if (toStation.status === "unmatched") {
    messages.push(`Destination station not matched: ${normalized.to_station_name || "empty"}.`);
  }

  const status = resolveStatus(messages, fromStation.status, toStation.status);

  return {
    rowNumber,
    raw,
    normalized,
    fromStation,
    toStation,
    status,
    messages
  };
}

function resolveStatus(
  messages: string[],
  fromStatus: StationMatch["status"],
  toStatus: StationMatch["status"]
): ImportPreviewRow["status"] {
  if (messages.some((message) => message.startsWith("Missing") || message.startsWith("Invalid") || message.startsWith("Malformed") || message.includes("columns"))) {
    return "invalid";
  }
  if (fromStatus === "unmatched" || toStatus === "unmatched") {
    return "unmatched";
  }
  if (fromStatus === "fuzzy" || toStatus === "fuzzy") {
    return "fuzzy_matched";
  }
  return "matched";
}

function valueFor(row: Record<string, string>, header?: string): string {
  return header ? cleanCell(row[header] ?? "") : "";
}

function stationToStop(
  station: Station,
  sequence: number,
  matchStatus: StationMatch["status"],
  timestamp?: string
): TripStopInput {
  return {
    stationId: station.id,
    stationName: station.name,
    countryCode: station.countryCode,
    coordinates: station.coordinates,
    sequence,
    departureAt: sequence === 1 ? timestamp : undefined,
    arrivalAt: sequence === 2 ? timestamp : undefined,
    source: "import",
    confidence: matchStatus === "fuzzy" ? "fuzzy" : "matched"
  };
}

function cleanCell(value: string): string {
  return value.replace(/\uFFFD/g, "").replace(/\u00A0/g, " ").trim();
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
}

function combineDateTime(date: string, time: string): string | undefined {
  if (!date || !time || !isIsoDate(date) || !isTime(time)) {
    return undefined;
  }
  return `${date}T${time.length === 5 ? `${time}:00` : time}`;
}

function parseDistance(value: string): number {
  if (!value) {
    return 0;
  }
  const parsed = Number(value.replace(",", ".").replace(/[^0-9.]+/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function similarity(left: string, right: string): number {
  const distance = levenshtein(left, right);
  const longest = Math.max(left.length, right.length, 1);
  return 1 - distance / longest;
}

function levenshtein(left: string, right: string): number {
  const matrix = Array.from({ length: left.length + 1 }, (_, row) =>
    Array.from({ length: right.length + 1 }, (_, column) => (row === 0 ? column : column === 0 ? row : 0))
  );

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}
