import type { TripStop } from "@trainmap/domain";
import {
  parseSwissFormationShortString,
  swissFormationServiceLegend,
  swissFormationVehicleTypeLegend,
  type FormationStopSummary,
  type FormationVehicleSummary,
  type SwissTrainFormationSummary
} from "@trainmap/timetable-adapters";

export const trainFormationSchemaVersion = 2;
export const trainFormationOperationDatePolicy = "same-day-live" as const;
export const formationDisplayTimeZone = "Europe/Zurich";

export interface TrainFormationRecord {
  provider: "swiss_train_formation";
  schemaVersion: number;
  requestedAt: string;
  configured: boolean;
  operationDatePolicy: typeof trainFormationOperationDatePolicy;
  liveQueryAvailableOn?: string;
  archived: boolean;
  summaries: SwissTrainFormationSummary[];
  message?: string;
}

export function isFormationLiveQueryDate(
  operationDate: string,
  timeZone = formationDisplayTimeZone,
  now = new Date()
): boolean {
  return operationDate === dateInTimeZone(now, timeZone);
}

export function dateInTimeZone(value: Date | string, timeZone = formationDisplayTimeZone): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value.slice(0, 10) : "";
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function normalizeStoredTrainFormation(
  candidate: unknown,
  referenceStops: TripStop[] = []
): TrainFormationRecord | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const record = candidate as Record<string, unknown>;
  const summaries = arrayValue(record.summaries)
    .map((summary) => normalizeStoredTrainFormationSummary(summary, referenceStops))
    .filter((summary): summary is SwissTrainFormationSummary => summary !== null);

  return {
    provider: "swiss_train_formation",
    schemaVersion: numberValue(record.schemaVersion) ?? trainFormationSchemaVersion,
    requestedAt: stringValue(record.requestedAt) ?? "",
    configured: booleanValue(record.configured) ?? false,
    operationDatePolicy: trainFormationOperationDatePolicy,
    liveQueryAvailableOn: stringValue(record.liveQueryAvailableOn),
    archived: booleanValue(record.archived) ?? summaries.some((summary) => summary.status === "available"),
    summaries,
    message: stringValue(record.message)
  };
}

export function enrichSwissTrainFormationSummary(
  summary: SwissTrainFormationSummary,
  referenceStops: TripStop[]
): SwissTrainFormationSummary {
  return normalizeStoredTrainFormationSummary(summary, referenceStops) ?? summary;
}

function normalizeStoredTrainFormationSummary(candidate: unknown, referenceStops: TripStop[]): SwissTrainFormationSummary | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const record = candidate as Record<string, unknown>;
  const rawFormationStrings = stringArray(record.rawFormationStrings).length
    ? stringArray(record.rawFormationStrings)
    : stringArray(record.formationStrings);
  const stops = normalizeStops(record.stops, rawFormationStrings, referenceStops);
  const vehicles = normalizeVehicles(record.vehicles, referenceStops);
  const parsedFormationStrings = rawFormationStrings.map(parseSwissFormationShortString);
  const status = statusValue(record.status) ?? (rawFormationStrings.length || stops.length || vehicles.length ? "available" : "unavailable");

  return {
    evu: stringValue(record.evu) ?? "unknown",
    operationDate: stringValue(record.operationDate) ?? "",
    trainNumber: stringValue(record.trainNumber) ?? "",
    serviceLabel: stringValue(record.serviceLabel),
    status,
    endpoint: stringValue(record.endpoint) ?? "",
    httpStatus: numberValue(record.httpStatus),
    formationStrings: stringArray(record.formationStrings).length ? stringArray(record.formationStrings) : rawFormationStrings.slice(0, 8),
    rawFormationStrings,
    parsedFormationStrings,
    meta: objectValue(record.meta) as SwissTrainFormationSummary["meta"],
    stops: stops.length ? stops : undefined,
    vehicles: vehicles.length ? vehicles : undefined,
    vehicleTypeLegend: nonEmptyRecord(record.vehicleTypeLegend) ?? swissFormationVehicleTypeLegend,
    serviceLegend: nonEmptyRecord(record.serviceLegend) ?? swissFormationServiceLegend,
    stopCount: numberValue(record.stopCount) ?? (stops.length || undefined),
    vehicleCount: numberValue(record.vehicleCount) ?? (vehicles.length || undefined),
    message: stringValue(record.message)
  };
}

function normalizeStops(value: unknown, rawFormationStrings: string[], referenceStops: TripStop[]): FormationStopSummary[] {
  const existingStops = arrayValue(value);
  if (existingStops.length > 0) {
    return existingStops.map((stop, index) => {
      const record = stop as Record<string, unknown>;
      const referenceStop = findReferenceStop(record, index, referenceStops);
      const formationString = stringValue(record.formationString) ?? rawFormationStrings[index];
      const name = displayStopName(stringValue(record.name), referenceStop);
      return {
        sequence: numberValue(record.sequence) ?? index + 1,
        name,
        uic: stringValue(record.uic) ?? referenceStop?.stationId,
        arrivalAt: stringValue(record.arrivalAt) ?? referenceStop?.arrivalAt,
        departureAt: stringValue(record.departureAt) ?? referenceStop?.departureAt,
        track: cleanTrack(stringValue(record.track)),
        formationString,
        parsedFormation: formationString ? parseSwissFormationShortString(formationString) : undefined,
        vehicleGoals: arrayValue(record.vehicleGoals).map((goal) => {
          const goalRecord = goal as Record<string, unknown>;
          return {
            fromPosition: numberValue(goalRecord.fromPosition),
            toPosition: numberValue(goalRecord.toPosition),
            destinationName: displayGoalName(stringValue(goalRecord.destinationName), referenceStops),
            destinationUic: stringValue(goalRecord.destinationUic)
          };
        })
      };
    });
  }

  return rawFormationStrings.map((formationString, index) => {
    const referenceStop = referenceStops[index];
    return {
      sequence: index + 1,
      name: referenceStop?.stationName ?? `Formation sample ${index + 1}`,
      uic: referenceStop?.stationId,
      arrivalAt: referenceStop?.arrivalAt,
      departureAt: referenceStop?.departureAt,
      formationString,
      parsedFormation: parseSwissFormationShortString(formationString),
      vehicleGoals: []
    };
  });
}

function normalizeVehicles(value: unknown, referenceStops: TripStop[]): FormationVehicleSummary[] {
  return arrayValue(value).map((vehicle) => {
    const record = vehicle as Record<string, unknown>;
    return {
      ...record,
      sectorsByStop: arrayValue(record.sectorsByStop).map((stop, index) => {
        const stopRecord = stop as Record<string, unknown>;
        const referenceStop = findReferenceStop(stopRecord, index, referenceStops);
        return {
          stopName: displayStopName(stringValue(stopRecord.stopName), referenceStop),
          stopUic: stringValue(stopRecord.stopUic) ?? referenceStop?.stationId,
          arrivalAt: stringValue(stopRecord.arrivalAt) ?? referenceStop?.arrivalAt,
          departureAt: stringValue(stopRecord.departureAt) ?? referenceStop?.departureAt,
          track: cleanTrack(stringValue(stopRecord.track)),
          sectors: cleanTrack(stringValue(stopRecord.sectors)),
          accessToPreviousVehicle: booleanValue(stopRecord.accessToPreviousVehicle)
        };
      })
    } as FormationVehicleSummary;
  });
}

function findReferenceStop(record: Record<string, unknown>, index: number, referenceStops: TripStop[]): TripStop | undefined {
  const uic = stringValue(record.uic) ?? stringValue(record.stopUic);
  const uicMatch = uic ? referenceStops.find((stop) => stopRefMatches(stop.stationId, uic)) : undefined;
  if (uicMatch) {
    return uicMatch;
  }

  const arrivalAt = stringValue(record.arrivalAt);
  const departureAt = stringValue(record.departureAt);
  const timeMatch = referenceStops.find((stop) => {
    return Boolean((arrivalAt && stop.arrivalAt === arrivalAt) || (departureAt && stop.departureAt === departureAt));
  });
  if (timeMatch) {
    return timeMatch;
  }

  return referenceStops[index];
}

function stopRefMatches(stationId: string, uic: string): boolean {
  if (stationId === uic) {
    return true;
  }
  const stationDigits = stationId.match(/\d+/g)?.join("");
  return Boolean(stationDigits && stationDigits.endsWith(uic.replace(/\D/g, "")));
}

function displayStopName(value: string | undefined, referenceStop: TripStop | undefined): string | undefined {
  if (value && !/^unknown stop$/i.test(value) && !/^sample \d+$/i.test(value)) {
    return value;
  }
  return referenceStop?.stationName ?? (value ? "Stop name unavailable" : undefined);
}

function displayGoalName(value: string | undefined, referenceStops: TripStop[]): string | undefined {
  if (value && !/^unknown stop$/i.test(value)) {
    return value;
  }
  return referenceStops[referenceStops.length - 1]?.stationName ?? value;
}

function cleanTrack(value: string | undefined): string | undefined {
  if (!value || /^n\/a$/i.test(value)) {
    return undefined;
  }
  return value;
}

function statusValue(value: unknown): SwissTrainFormationSummary["status"] | undefined {
  return value === "available" || value === "unavailable" || value === "failed" ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined) : [];
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function nonEmptyRecord(value: unknown): Record<string, string> | undefined {
  const record = objectValue(value);
  if (!record || Object.keys(record).length === 0) {
    return undefined;
  }
  return Object.fromEntries(Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}
