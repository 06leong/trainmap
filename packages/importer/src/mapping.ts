import type { Station } from "@trainmap/domain";
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

function previewRow(
  rowNumber: number,
  raw: Record<string, string>,
  mapping: ColumnMapping,
  stations: Station[]
): ImportPreviewRow {
  const normalized = Object.fromEntries(
    (Object.keys(headerHints) as ImportField[]).map((field) => [field, valueFor(raw, mapping[field])])
  ) as Record<ImportField, string>;
  const messages: string[] = [];
  const fromStation = matchStation(normalized.from_station_name, stations);
  const toStation = matchStation(normalized.to_station_name, stations);

  if (!normalized.departure_date) {
    messages.push("Missing departure date.");
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
  if (messages.some((message) => message.startsWith("Missing"))) {
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
  return header ? row[header] ?? "" : "";
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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
