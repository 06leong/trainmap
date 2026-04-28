import type { SwissOpenDataRouteOption, SwissOpenDataServiceSummary } from "./swiss-open-data";

export interface SwissTrainFormationConfig {
  apiKey: string;
  baseUrl?: string;
  fullPath?: string;
  fullEndpoint?: string;
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
  httpStatus?: number;
  formationStrings: string[];
  rawFormationStrings: string[];
  parsedFormationStrings: ParsedFormationShortString[];
  meta?: SwissTrainFormationMeta;
  stops?: FormationStopSummary[];
  vehicles?: FormationVehicleSummary[];
  vehicleTypeLegend: Record<string, string>;
  serviceLegend: Record<string, string>;
  stopCount?: number;
  vehicleCount?: number;
  message?: string;
}

export interface SwissTrainFormationMeta {
  lengthMeters?: number;
  vehicleCount?: number;
  seatCount?: number;
}

export interface FormationStopSummary {
  sequence: number;
  name?: string;
  uic?: string;
  arrivalAt?: string;
  departureAt?: string;
  track?: string;
  formationString?: string;
  parsedFormation?: ParsedFormationShortString;
  vehicleGoals: FormationVehicleGoalSummary[];
}

export interface FormationVehicleGoalSummary {
  fromPosition?: number;
  toPosition?: number;
  destinationName?: string;
  destinationUic?: string;
}

export interface FormationVehicleSummary {
  position?: number;
  displayNumber?: string;
  evn?: string;
  parentEvn?: string;
  typeCode?: string;
  typeCodeName?: string;
  lengthMeters?: number;
  fromStopName?: string;
  toStopName?: string;
  firstClassSeats?: number;
  secondClassSeats?: number;
  bikeHooks?: number;
  wheelchairSpaces?: number;
  lowFloor?: boolean;
  strollerPlatform?: boolean;
  wheelchairAccessible?: boolean;
  familyZone?: boolean;
  businessZone?: boolean;
  closed?: boolean;
  trolleyStatus?: string;
  sectorsByStop: FormationVehicleStopSummary[];
}

export interface FormationVehicleStopSummary {
  stopName?: string;
  stopUic?: string;
  arrivalAt?: string;
  departureAt?: string;
  track?: string;
  sectors?: string;
  accessToPreviousVehicle?: boolean;
}

export interface ParsedFormationShortString {
  raw: string;
  sectors: ParsedFormationSector[];
  vehicles: ParsedFormationVehicle[];
  unknownTokens: string[];
}

export interface ParsedFormationSector {
  name: string;
  vehicles: ParsedFormationVehicle[];
}

export interface ParsedFormationVehicle {
  index: number;
  raw: string;
  sector?: string;
  typeCode?: string;
  typeLabel: string;
  displayNumber?: string;
  services: ParsedFormationService[];
  statuses: ParsedFormationStatus[];
  inTrainGroup: boolean;
  groupStart: boolean;
  groupEnd: boolean;
  accessToPrevious: boolean;
  accessToNext: boolean;
  unknownTokens: string[];
}

export interface ParsedFormationService {
  code: string;
  label: string;
  quantity?: number;
}

export interface ParsedFormationStatus {
  code: string;
  label: string;
}

const defaultFormationBaseUrl = "https://api.opentransportdata.swiss/formation";
const defaultFormationFullPath = "/v2/formations_full";
const defaultUserAgent = "trainmap/0.1";

export const swissFormationVehicleTypeLegend: Record<string, string> = {
  "1": "1st class coach",
  "2": "2nd class coach",
  "12": "1st and 2nd class coach",
  CC: "Couchette car",
  FA: "Family coach",
  WL: "Sleeping car",
  WR: "Restaurant car",
  W1: "Restaurant and 1st class coach",
  W2: "Restaurant and 2nd class coach",
  LK: "Traction unit",
  D: "Baggage car",
  F: "Fictitious sector filler",
  K: "Classless vehicle",
  X: "Parked coach"
};

export const swissFormationServiceLegend: Record<string, string> = {
  BHP: "Wheelchair spaces",
  BZ: "Business zone",
  FZ: "Family zone",
  KW: "Pram platform",
  NF: "Low-floor access",
  VH: "Bicycle hooks/platform",
  VR: "Bicycle hooks/platform with reservation"
};

const swissFormationStatusLegend: Record<string, string> = {
  "-": "Closed",
  ">": "Vehicle with groups starting here",
  "=": "Reserved for through groups",
  "%": "Open but restaurant not served"
};

export async function fetchSwissTrainFormation(
  query: SwissTrainFormationQuery,
  config: SwissTrainFormationConfig
): Promise<SwissTrainFormationSummary> {
  const endpoint = buildSwissTrainFormationUrl(config.baseUrl ?? defaultFormationBaseUrl, query, {
    fullPath: config.fullPath,
    fullEndpoint: config.fullEndpoint
  });
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

    const responseText = await response.text();

    if (!response.ok) {
      const snippet = sanitizeResponseSnippet(responseText);
      return {
        ...query,
        status: "failed",
        endpoint,
        httpStatus: response.status,
        formationStrings: [],
        rawFormationStrings: [],
        parsedFormationStrings: [],
        vehicleTypeLegend: swissFormationVehicleTypeLegend,
        serviceLegend: swissFormationServiceLegend,
        message: [formationFailureMessage(response.status), snippet ? `Response: ${snippet}` : ""].filter(Boolean).join(" ")
      };
    }

    const payload = JSON.parse(responseText) as unknown;
    const summary = normalizeSwissTrainFormationPayload(payload);
    return {
      ...query,
      ...summary,
      status: summary.rawFormationStrings.length > 0 || summary.stopCount || summary.vehicleCount ? "available" : "unavailable",
      endpoint
    };
  } catch (error) {
    return {
      ...query,
      status: "failed",
      endpoint,
      formationStrings: [],
      rawFormationStrings: [],
      parsedFormationStrings: [],
      vehicleTypeLegend: swissFormationVehicleTypeLegend,
      serviceLegend: swissFormationServiceLegend,
      message: error instanceof Error ? error.message : "Formation request failed."
    };
  }
}

export function buildSwissTrainFormationUrl(
  baseUrl: string,
  query: SwissTrainFormationQuery,
  options: { fullPath?: string; fullEndpoint?: string } = {}
): string {
  const endpoint = options.fullEndpoint?.trim() || `${baseUrl.replace(/\/+$/g, "")}${normalizePath(options.fullPath ?? defaultFormationFullPath)}`;
  const url = new URL(endpoint);
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

export function parseSwissFormationShortString(value: string): ParsedFormationShortString {
  const tokens = tokenizeFormationShortString(value);
  const vehicles: ParsedFormationVehicle[] = [];
  const sectors = new Map<string, ParsedFormationVehicle[]>();
  const unknownTokens: string[] = [];
  let currentSector: string | undefined;
  let groupActive = false;
  let pendingGroupStart = false;
  let pendingNoAccessBefore = false;

  for (const token of tokens) {
    if (token.type === "sector") {
      currentSector = token.value;
      if (!sectors.has(currentSector)) {
        sectors.set(currentSector, []);
      }
      continue;
    }
    if (token.type === "groupStart") {
      groupActive = true;
      pendingGroupStart = true;
      continue;
    }
    if (token.type === "groupEnd") {
      const previous = vehicles[vehicles.length - 1];
      if (previous) {
        previous.groupEnd = true;
      }
      groupActive = false;
      continue;
    }
    if (token.type === "noAccessStart") {
      pendingNoAccessBefore = true;
      continue;
    }
    if (token.type === "noAccessEnd") {
      const previous = vehicles[vehicles.length - 1];
      if (previous) {
        previous.accessToNext = false;
      }
      continue;
    }
    if (token.type !== "vehicle") {
      continue;
    }

    if (token.value.startsWith("#")) {
      const previous = vehicles[vehicles.length - 1];
      if (previous) {
        previous.services.push(...parseServiceList(token.value.slice(1), previous.unknownTokens));
      } else {
        unknownTokens.push(token.value);
      }
      continue;
    }

    const vehicle = parseFormationVehicleToken(token.value, vehicles.length + 1, currentSector, groupActive, pendingGroupStart, pendingNoAccessBefore);
    pendingGroupStart = false;
    pendingNoAccessBefore = false;
    vehicles.push(vehicle);
    if (vehicle.unknownTokens.length > 0) {
      unknownTokens.push(...vehicle.unknownTokens);
    }
    if (currentSector) {
      sectors.set(currentSector, [...(sectors.get(currentSector) ?? []), vehicle]);
    }
  }

  return {
    raw: value,
    sectors: [...sectors.entries()].map(([name, sectorVehicles]) => ({ name, vehicles: sectorVehicles })),
    vehicles,
    unknownTokens: uniqueValues(unknownTokens)
  };
}

export function summarizeSwissTrainFormationPayload(payload: unknown): Omit<SwissTrainFormationSummary, keyof SwissTrainFormationQuery | "status" | "endpoint"> {
  return normalizeSwissTrainFormationPayload(payload);
}

export function normalizeSwissTrainFormationPayload(
  payload: unknown
): Omit<SwissTrainFormationSummary, keyof SwissTrainFormationQuery | "status" | "endpoint"> {
  const rawFormationStrings = uniqueValues(findStringsByKey(payload, /^formationShortString$/i)).slice(0, 24);
  const stops = formationStopsFromPayload(payload);
  const vehicles = formationVehiclesFromPayload(payload);
  const meta = formationMetaFromPayload(payload, vehicles);
  const parsedFormationStrings = rawFormationStrings.map(parseSwissFormationShortString);
  const stopCount = stops.length || largestArrayLengthByKey(payload, /stops|scheduledStops|formationStops|formationsAtScheduledStops/i);
  const vehicleCount =
    meta.vehicleCount ?? (vehicles.length || largestArrayLengthByKey(payload, /vehicles|formationElements|formationVehicles|vehicleBased/i));

  return {
    formationStrings: rawFormationStrings.slice(0, 8),
    rawFormationStrings,
    parsedFormationStrings,
    meta: hasMetaValues(meta) ? meta : undefined,
    stops: stops.length > 0 ? stops : undefined,
    vehicles: vehicles.length > 0 ? vehicles : undefined,
    vehicleTypeLegend: swissFormationVehicleTypeLegend,
    serviceLegend: swissFormationServiceLegend,
    stopCount,
    vehicleCount
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

function formationFailureMessage(status: number): string {
  if (status === 403) {
    return "Formation request failed with HTTP 403. Check that the Train Formation Service token is configured, approved for this app, valid for the v2 endpoint, and allowed for this EVU/date.";
  }
  if (status === 401) {
    return "Formation request failed with HTTP 401. The Authorization bearer token was missing or rejected.";
  }
  if (status === 404) {
    return "Formation request failed with HTTP 404. Check the Formation base URL and endpoint path.";
  }
  return `Formation request failed with HTTP ${status}.`;
}

function normalizePath(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

function trainNumberFromCode(trainCode: string): string | null {
  return trainCode.match(/(\d+)(?!.*\d)/)?.[1] ?? null;
}

function formationStopsFromPayload(payload: unknown): FormationStopSummary[] {
  const records = arrayAtPath(payload, ["formationsAtScheduledStops"]);
  return records.map((record, index) => {
    const scheduledStop = objectAtPath(record, ["scheduledStop"]);
    const stopPoint = objectAtPath(scheduledStop, ["stopPoint"]);
    const stopTime = objectAtPath(scheduledStop, ["stopTime"]);
    const formationShort = objectAtPath(record, ["formationShort"]);
    const formationString = stringAtPath(formationShort, ["formationShortString"]);

    return {
      sequence: index + 1,
      name: stringAtPath(stopPoint, ["name"]),
      uic: valueToString(valueAtPath(stopPoint, ["uic"])),
      arrivalAt: stringAtPath(stopTime, ["arrivalTime"]),
      departureAt: stringAtPath(stopTime, ["departureTime"]),
      track: valueToString(valueAtPath(scheduledStop, ["track"])),
      formationString,
      parsedFormation: formationString ? parseSwissFormationShortString(formationString) : undefined,
      vehicleGoals: arrayAtPath(formationShort, ["vehicleGoals"]).map((goal) => {
        const destination = objectAtPath(goal, ["destinationStopPoint"]);
        return {
          fromPosition: numberAtPath(goal, ["fromVehicleAtPosition"]),
          toPosition: numberAtPath(goal, ["toVehicleAtPosition"]),
          destinationName: stringAtPath(destination, ["name"]),
          destinationUic: valueToString(valueAtPath(destination, ["uic"]))
        };
      })
    };
  });
}

function formationVehiclesFromPayload(payload: unknown): FormationVehicleSummary[] {
  return arrayAtPath(payload, ["formations"]).flatMap((formation) =>
    arrayAtPath(formation, ["formationVehicles"]).map((vehicle) => {
      const vehicleIdentifier = objectAtPath(vehicle, ["vehicleIdentifier"]);
      const properties = objectAtPath(vehicle, ["vehicleProperties"]);
      const accessibility = objectAtPath(properties, ["accessibilityProperties"]);
      const pictos = objectAtPath(properties, ["pictoProperties"]);
      const fromStop = objectAtPath(properties, ["fromStop"]);
      const toStop = objectAtPath(properties, ["toStop"]);

      return {
        position: numberAtPath(vehicle, ["position"]),
        displayNumber: valueToString(valueAtPath(vehicle, ["number"])),
        evn: stringAtPath(vehicleIdentifier, ["evn"]),
        parentEvn: stringAtPath(vehicleIdentifier, ["parentEvn"]),
        typeCode: valueToString(valueAtPath(vehicleIdentifier, ["typeCode"])),
        typeCodeName: stringAtPath(vehicleIdentifier, ["typeCodeName"]),
        lengthMeters: numberAtPath(properties, ["length"]),
        fromStopName: stringAtPath(fromStop, ["name"]),
        toStopName: stringAtPath(toStop, ["name"]),
        firstClassSeats: numberAtPath(properties, ["number1class"]),
        secondClassSeats: numberAtPath(properties, ["number2class"]),
        bikeHooks: numberAtPath(properties, ["numberBikeHooks"]),
        wheelchairSpaces: numberAtPath(accessibility, ["numberWheelchairSpaces"]),
        lowFloor: booleanAtPath(properties, ["lowFloorTrolley"]),
        strollerPlatform: booleanAtPath(pictos, ["strollerPicto"]),
        wheelchairAccessible: booleanAtPath(pictos, ["wheelchairPicto"]),
        familyZone: booleanAtPath(pictos, ["familyZonePicto"]),
        businessZone: booleanAtPath(pictos, ["businessZonePicto"]),
        closed: booleanAtPath(properties, ["closed"]),
        trolleyStatus: stringAtPath(properties, ["trolleyStatus"]),
        sectorsByStop: arrayAtPath(vehicle, ["formationVehicleAtScheduledStops"]).map((stopRecord) => {
          const stopPoint = objectAtPath(stopRecord, ["stopPoint"]);
          const stopTime = objectAtPath(stopRecord, ["stopTime"]);
          return {
            stopName: stringAtPath(stopPoint, ["name"]),
            stopUic: valueToString(valueAtPath(stopPoint, ["uic"])),
            arrivalAt: stringAtPath(stopTime, ["arrivalTime"]),
            departureAt: stringAtPath(stopTime, ["departureTime"]),
            track: valueToString(valueAtPath(stopRecord, ["track"])),
            sectors: stringAtPath(stopRecord, ["sectors"]),
            accessToPreviousVehicle: booleanAtPath(stopRecord, ["accessToPreviousVehicle"])
          };
        })
      };
    })
  );
}

function formationMetaFromPayload(payload: unknown, vehicles: FormationVehicleSummary[]): SwissTrainFormationMeta {
  const metaRecord = arrayAtPath(payload, ["formations"]).map((formation) => objectAtPath(formation, ["metaInformation"])).find(Boolean);
  const seatCount =
    numberAtPath(metaRecord, ["numberSeats"]) ??
    (vehicles.reduce((sum, vehicle) => sum + (vehicle.firstClassSeats ?? 0) + (vehicle.secondClassSeats ?? 0), 0) ||
      undefined);

  return {
    lengthMeters: numberAtPath(metaRecord, ["length"]),
    vehicleCount: numberAtPath(metaRecord, ["numberVehicles"]) ?? (vehicles.length || undefined),
    seatCount
  };
}

function hasMetaValues(meta: SwissTrainFormationMeta): boolean {
  return Boolean(meta.lengthMeters || meta.vehicleCount || meta.seatCount);
}

function tokenizeFormationShortString(value: string): Array<{ type: "sector" | "vehicle" | "groupStart" | "groupEnd" | "noAccessStart" | "noAccessEnd"; value: string }> {
  const tokens: Array<{ type: "sector" | "vehicle" | "groupStart" | "groupEnd" | "noAccessStart" | "noAccessEnd"; value: string }> = [];
  let buffer = "";
  const flush = () => {
    const normalized = buffer.trim();
    if (normalized) {
      tokens.push({ type: "vehicle", value: normalized });
    }
    buffer = "";
  };

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "@") {
      flush();
      const sector = value[index + 1];
      if (sector && /[A-Z]/i.test(sector)) {
        tokens.push({ type: "sector", value: sector.toUpperCase() });
        index += 1;
      }
      continue;
    }
    if (char === ",") {
      flush();
      continue;
    }
    if (char === "[") {
      flush();
      tokens.push({ type: "groupStart", value: char });
      continue;
    }
    if (char === "]") {
      flush();
      tokens.push({ type: "groupEnd", value: char });
      continue;
    }
    if (char === "(") {
      flush();
      tokens.push({ type: "noAccessStart", value: char });
      continue;
    }
    if (char === ")") {
      flush();
      tokens.push({ type: "noAccessEnd", value: char });
      continue;
    }
    buffer += char;
  }
  flush();
  return tokens;
}

function parseFormationVehicleToken(
  raw: string,
  index: number,
  sector: string | undefined,
  inTrainGroup: boolean,
  groupStart: boolean,
  noAccessBefore: boolean
): ParsedFormationVehicle {
  const unknownTokens: string[] = [];
  let remaining = raw.trim();
  const statuses: ParsedFormationStatus[] = [];

  while (remaining.length > 0 && Object.prototype.hasOwnProperty.call(swissFormationStatusLegend, remaining[0])) {
    const code = remaining[0];
    statuses.push({ code, label: swissFormationStatusLegend[code] });
    remaining = remaining.slice(1);
  }

  const [vehiclePart, servicePart] = remaining.split("#", 2);
  const typeMatch = vehiclePart.match(/^(12|CC|FA|WL|WR|W1|W2|LK|[12DFKX])(?::([A-Za-z0-9-]+))?$/);
  const typeCode = typeMatch?.[1];
  const displayNumber = typeMatch?.[2];

  if (!typeMatch) {
    unknownTokens.push(raw);
  }

  return {
    index,
    raw,
    sector,
    typeCode,
    typeLabel: typeCode ? swissFormationVehicleTypeLegend[typeCode] ?? `Unknown type ${typeCode}` : "Unknown vehicle",
    displayNumber,
    services: servicePart ? parseServiceList(servicePart, unknownTokens) : [],
    statuses,
    inTrainGroup,
    groupStart,
    groupEnd: false,
    accessToPrevious: !noAccessBefore,
    accessToNext: true,
    unknownTokens
  };
}

function parseServiceList(value: string, unknownTokens: string[]): ParsedFormationService[] {
  return value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(\d+)?([A-Z0-9]+)$/i);
      if (!match) {
        unknownTokens.push(part);
        return { code: part, label: "Unknown service" };
      }
      const code = match[2].toUpperCase();
      const quantity = match[1] ? Number(match[1]) : undefined;
      if (!swissFormationServiceLegend[code]) {
        unknownTokens.push(part);
      }
      return {
        code,
        label: swissFormationServiceLegend[code] ?? `Unknown service ${code}`,
        quantity
      };
    });
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

function valueAtPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function objectAtPath(value: unknown, path: string[]): Record<string, unknown> | undefined {
  const candidate = valueAtPath(value, path);
  return candidate && typeof candidate === "object" && !Array.isArray(candidate) ? (candidate as Record<string, unknown>) : undefined;
}

function arrayAtPath(value: unknown, path: string[]): Record<string, unknown>[] {
  const candidate = valueAtPath(value, path);
  return Array.isArray(candidate) ? candidate.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function stringAtPath(value: unknown, path: string[]): string | undefined {
  const candidate = valueAtPath(value, path);
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}

function numberAtPath(value: unknown, path: string[]): number | undefined {
  const candidate = valueAtPath(value, path);
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate;
  }
  if (typeof candidate === "string" && candidate.trim() && Number.isFinite(Number(candidate))) {
    return Number(candidate);
  }
  return undefined;
}

function booleanAtPath(value: unknown, path: string[]): boolean | undefined {
  const candidate = valueAtPath(value, path);
  return typeof candidate === "boolean" ? candidate : undefined;
}

function valueToString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
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

function sanitizeResponseSnippet(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .trim()
    .slice(0, 600);
}
