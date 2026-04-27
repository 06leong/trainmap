import type { SwissOpenDataRouteOption, SwissOpenDataServiceSummary } from "./swiss-open-data";

export interface SwissTrainFormationConfig {
  apiKey: string;
  baseUrl?: string;
  userAgent?: string;
  fetchImpl?: typeof fetch;
}

export interface SwissTrainFormationQuery {
  evu: string;
  operationDate: string;
  trainNumber: string;
  serviceLabel?: string;
}

export interface SwissTrainFormationSummary extends SwissTrainFormationQuery {
  status: "available" | "unavailable" | "failed";
  endpoint: string;
  formationStrings: string[];
  stopCount?: number;
  vehicleCount?: number;
  message?: string;
}

const defaultFormationBaseUrl = "https://api.opentransportdata.swiss/formation";
const defaultUserAgent = "trainmap/0.1";

export async function fetchSwissTrainFormation(
  query: SwissTrainFormationQuery,
  config: SwissTrainFormationConfig
): Promise<SwissTrainFormationSummary> {
  const endpoint = buildSwissTrainFormationUrl(config.baseUrl ?? defaultFormationBaseUrl, query);
  const fetchImpl = config.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
        "User-Agent": config.userAgent ?? defaultUserAgent
      },
      signal: AbortSignal.timeout(15_000)
    });

    if (!response.ok) {
      return {
        ...query,
        status: "failed",
        endpoint,
        formationStrings: [],
        message: `Formation request failed with HTTP ${response.status}.`
      };
    }

    const payload = (await response.json()) as unknown;
    const summary = summarizeSwissTrainFormationPayload(payload);
    return {
      ...query,
      ...summary,
      status: summary.formationStrings.length > 0 || summary.stopCount || summary.vehicleCount ? "available" : "unavailable",
      endpoint
    };
  } catch (error) {
    return {
      ...query,
      status: "failed",
      endpoint,
      formationStrings: [],
      message: error instanceof Error ? error.message : "Formation request failed."
    };
  }
}

export function buildSwissTrainFormationUrl(baseUrl: string, query: SwissTrainFormationQuery): string {
  const url = new URL(`${baseUrl.replace(/\/+$/g, "")}/formations_full`);
  url.searchParams.set("evu", query.evu);
  url.searchParams.set("operationDate", query.operationDate);
  url.searchParams.set("trainNumber", query.trainNumber);
  return url.toString();
}

export function inferSwissTrainFormationQueries(option: SwissOpenDataRouteOption): SwissTrainFormationQuery[] {
  const operationDate = option.departureAt.slice(0, 10);
  const queries: SwissTrainFormationQuery[] = [];

  for (const service of option.services) {
    const evu = service.operatorName ? evuFromOperatorName(service.operatorName) : null;
    const trainNumber = trainNumberFromCode(service.trainCode);
    if (!evu || !trainNumber) {
      continue;
    }
    queries.push({
      evu,
      operationDate,
      trainNumber,
      serviceLabel: service.trainCode
    });
  }

  return uniqueFormationQueries(queries);
}

export function summarizeSwissTrainFormationPayload(payload: unknown): Omit<SwissTrainFormationSummary, keyof SwissTrainFormationQuery | "status" | "endpoint"> {
  return {
    formationStrings: uniqueValues(findStringsByKey(payload, /formation(short)?string/i)).slice(0, 8),
    stopCount: largestArrayLengthByKey(payload, /stops|scheduledStops|formationStops/i),
    vehicleCount: largestArrayLengthByKey(payload, /vehicles|formationElements|vehicleBased/i)
  };
}

function evuFromOperatorName(operatorName: string): string | null {
  const normalized = operatorName.toLowerCase();
  if (normalized.includes("swiss federal railways") || normalized.includes("schweizerische bundesbahnen") || normalized.includes("sbb")) {
    return "SBBP";
  }
  if (normalized.includes("bls")) {
    return "BLSP";
  }
  if (normalized.includes("suedostbahn") || normalized.includes("sudostbahn") || normalized.includes("südostbahn") || normalized.includes("sob")) {
    return "SOB";
  }
  if (normalized.includes("thurbo")) {
    return "THURBO";
  }
  if (normalized.includes("rhatische") || normalized.includes("rhätische") || normalized.includes("rhb")) {
    return "RhB";
  }
  if (normalized.includes("fribourgeois") || normalized.includes("tpf")) {
    return "TPF";
  }
  if (normalized.includes("neuchatelois") || normalized.includes("neuchâtelois") || normalized.includes("trn")) {
    return "TRN";
  }
  if (normalized.includes("morges") || normalized.includes("mbc")) {
    return "MBC";
  }
  if (normalized.includes("oensingen") || normalized.includes("oebb") || normalized.includes("öbb")) {
    return "OeBB";
  }
  if (normalized.includes("zentralbahn")) {
    return "ZB";
  }
  return null;
}

function trainNumberFromCode(trainCode: string): string | null {
  return trainCode.match(/(\d+)(?!.*\d)/)?.[1] ?? null;
}

function uniqueFormationQueries(queries: SwissTrainFormationQuery[]): SwissTrainFormationQuery[] {
  return [...new Map(queries.map((query) => [`${query.evu}-${query.operationDate}-${query.trainNumber}`, query])).values()];
}

function findStringsByKey(value: unknown, keyPattern: RegExp): string[] {
  const results: string[] = [];
  visitJson(value, (key, item) => {
    if (keyPattern.test(key) && typeof item === "string" && item.trim()) {
      results.push(item.trim());
    }
  });
  return results;
}

function largestArrayLengthByKey(value: unknown, keyPattern: RegExp): number | undefined {
  let largest = 0;
  visitJson(value, (key, item) => {
    if (keyPattern.test(key) && Array.isArray(item)) {
      largest = Math.max(largest, item.length);
    }
  });
  return largest || undefined;
}

function visitJson(value: unknown, visitor: (key: string, value: unknown) => void): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      visitJson(item, visitor);
    }
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    visitor(key, item);
    visitJson(item, visitor);
  }
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
