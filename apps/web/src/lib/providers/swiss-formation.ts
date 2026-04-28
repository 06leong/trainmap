import {
  fetchSwissTrainFormation,
  inferSwissTrainFormationQueries,
  type SwissOpenDataRouteOption,
  type SwissTrainFormationSummary
} from "@trainmap/timetable-adapters";

export interface TrainFormationRecord {
  provider: "swiss_train_formation";
  requestedAt: string;
  configured: boolean;
  summaries: SwissTrainFormationSummary[];
  message?: string;
}

export function isSwissTrainFormationConfigured(): boolean {
  return Boolean(process.env.SWISS_TRAIN_FORMATION_API_KEY?.trim());
}

export async function getTrainFormationForScheduleOption(option: SwissOpenDataRouteOption): Promise<TrainFormationRecord> {
  const apiKey = process.env.SWISS_TRAIN_FORMATION_API_KEY?.trim();
  const requestedAt = new Date().toISOString();
  if (!apiKey) {
    return {
      provider: "swiss_train_formation",
      requestedAt,
      configured: false,
      summaries: [],
      message: "SWISS_TRAIN_FORMATION_API_KEY is not configured."
    };
  }

  const queries = inferSwissTrainFormationQueries(option);
  if (queries.length === 0) {
    return {
      provider: "swiss_train_formation",
      requestedAt,
      configured: true,
      summaries: [],
      message: "No supported Train Formation EVU could be inferred from this OJP connection."
    };
  }

  const summaries = await Promise.all(
    queries.map((query) =>
      fetchSwissTrainFormation(query, {
        apiKey,
        baseUrl: process.env.SWISS_TRAIN_FORMATION_API_BASE_URL,
        userAgent: process.env.SWISS_TRAIN_FORMATION_USER_AGENT ?? process.env.SWISS_OPEN_DATA_USER_AGENT ?? "trainmap/0.1"
      })
    )
  );

  return {
    provider: "swiss_train_formation",
    requestedAt,
    configured: true,
    summaries
  };
}
