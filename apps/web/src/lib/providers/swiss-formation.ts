import {
  buildSwissTrainFormationUrl,
  fetchSwissTrainFormation,
  inferSwissTrainFormationQueriesFromServices,
  swissFormationServiceLegend,
  swissFormationVehicleTypeLegend,
  type SwissOpenDataRouteOption,
  type SwissOpenDataServiceSummary
} from "@trainmap/timetable-adapters";
import type { Trip } from "@trainmap/domain";
import {
  dateInTimeZone,
  formationDisplayTimeZone,
  isFormationLiveQueryDate,
  trainFormationOperationDatePolicy,
  trainFormationSchemaVersion,
  type TrainFormationRecord
} from "@/lib/formation-record";

export type { TrainFormationRecord } from "@/lib/formation-record";

export function isSwissTrainFormationConfigured(): boolean {
  return Boolean(process.env.SWISS_TRAIN_FORMATION_API_KEY?.trim());
}

export async function getTrainFormationForScheduleOption(option: SwissOpenDataRouteOption): Promise<TrainFormationRecord> {
  return getTrainFormationForServices({
    services: option.services,
    operationDate: dateInTimeZone(option.departureAt, formationDisplayTimeZone)
  });
}

export async function getTrainFormationForTrip(trip: Trip): Promise<TrainFormationRecord> {
  const rawServices = trip.rawImportRow?.services;
  const services = Array.isArray(rawServices) ? (rawServices as SwissOpenDataServiceSummary[]) : [];
  const fallbackServices =
    services.length > 0
      ? services
      : trip.trainCode
        ? [{ trainCode: trip.trainCode, operatorName: trip.operatorName }]
        : [];

  return getTrainFormationForServices({
    services: fallbackServices,
    operationDate: dateInTimeZone(trip.date, formationDisplayTimeZone)
  });
}

async function getTrainFormationForServices({
  services,
  operationDate
}: {
  services: SwissOpenDataServiceSummary[];
  operationDate: string;
}): Promise<TrainFormationRecord> {
  const apiKey = process.env.SWISS_TRAIN_FORMATION_API_KEY?.trim();
  const requestedAt = new Date().toISOString();
  const queries = inferSwissTrainFormationQueriesFromServices(services, operationDate);
  const liveQueryAvailableOn = dateInTimeZone(new Date(), formationDisplayTimeZone);
  const baseRecord = {
    provider: "swiss_train_formation" as const,
    schemaVersion: trainFormationSchemaVersion,
    requestedAt,
    operationDatePolicy: trainFormationOperationDatePolicy,
    liveQueryAvailableOn,
    summaries: []
  };

  if (!apiKey) {
    return {
      ...baseRecord,
      configured: false,
      archived: false,
      message: "SWISS_TRAIN_FORMATION_API_KEY is not configured."
    };
  }

  if (queries.length === 0) {
    return {
      ...baseRecord,
      configured: true,
      archived: false,
      message: "No supported Train Formation EVU could be inferred from this OJP connection."
    };
  }

  if (!isFormationLiveQueryDate(operationDate, formationDisplayTimeZone)) {
    return {
      ...baseRecord,
      configured: true,
      archived: false,
      summaries: queries.map((query) => ({
        ...query,
        status: "unavailable",
        endpoint: trainFormationEndpoint(query),
        formationStrings: [],
        rawFormationStrings: [],
        parsedFormationStrings: [],
        vehicleTypeLegend: swissFormationVehicleTypeLegend,
        serviceLegend: swissFormationServiceLegend,
        message: "Live formation only available on the operating day."
      })),
      message: "Live formation only available on the operating day."
    };
  }

  const summaries = await Promise.all(
    queries.map((query) =>
      fetchSwissTrainFormation(query, {
        apiKey,
        baseUrl: process.env.SWISS_TRAIN_FORMATION_API_BASE_URL,
        fullPath: process.env.SWISS_TRAIN_FORMATION_FULL_PATH,
        fullEndpoint: process.env.SWISS_TRAIN_FORMATION_FULL_ENDPOINT,
        userAgent: process.env.SWISS_TRAIN_FORMATION_USER_AGENT ?? process.env.SWISS_OPEN_DATA_USER_AGENT ?? "trainmap/0.1"
      })
    )
  );

  return {
    ...baseRecord,
    configured: true,
    archived: summaries.some((summary) => summary.status === "available"),
    summaries
  };
}

function trainFormationEndpoint(query: { evu: string; operationDate: string; trainNumber: string }): string {
  return buildSwissTrainFormationUrl(process.env.SWISS_TRAIN_FORMATION_API_BASE_URL ?? "https://api.opentransportdata.swiss/formation", query, {
    fullPath: process.env.SWISS_TRAIN_FORMATION_FULL_PATH,
    fullEndpoint: process.env.SWISS_TRAIN_FORMATION_FULL_ENDPOINT
  });
}
