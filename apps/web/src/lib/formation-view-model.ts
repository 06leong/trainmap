import type { TripStop } from "@trainmap/domain";
import type {
  FormationStopSummary,
  FormationVehicleSummary,
  ParsedFormationService,
  ParsedFormationShortString,
  ParsedFormationStatus,
  ParsedFormationVehicle,
  SwissTrainFormationSummary
} from "@trainmap/timetable-adapters";

export interface FormationViewModel {
  title: string;
  serviceLabel: string;
  directionLabel: string;
  selectedStop: FormationStopSummary;
  stops: FormationStopSummary[];
  sectorGroups: FormationSectorView[];
  coaches: FormationCoachView[];
  metrics: FormationMetricView[];
  legendItems: FormationLegendItem[];
  diagnostics: FormationDiagnostics;
}

export interface FormationSectorView {
  sector: string;
  coaches: FormationCoachView[];
}

export interface FormationCoachView {
  key: string;
  position: number;
  coachNumber: string;
  classLabel: string;
  typeLabel: string;
  rawTypeCode?: string;
  sector?: string;
  noPassageBefore: boolean;
  noPassageAfter: boolean;
  isClosed: boolean;
  services: FormationServiceView[];
  technicalVehicle?: FormationVehicleSummary;
}

export interface FormationServiceView {
  key: string;
  label: string;
  icon: "wheelchair" | "bike" | "stroller" | "restaurant" | "family" | "business" | "lowFloor" | "reservation" | "closed";
  quantity?: number;
}

export interface FormationMetricView {
  label: string;
  value: string;
}

export interface FormationLegendItem {
  label: string;
  detail: string;
  icon?: FormationServiceView["icon"];
}

export interface FormationDiagnostics {
  rawStrings: string[];
  hiddenVehicleCount: number;
  unknownTokens: string[];
  vehicles: FormationVehicleSummary[];
}

export function buildFormationViewModel(
  summary: SwissTrainFormationSummary,
  referenceStops: TripStop[] = [],
  selectedStopIndex = 0
): FormationViewModel {
  const stops = normalizedStops(summary, referenceStops);
  const selectedStop = stops[Math.min(Math.max(selectedStopIndex, 0), Math.max(0, stops.length - 1))] ?? fallbackStop(summary);
  const parsedFormation = selectedStop.parsedFormation ?? summary.parsedFormationStrings?.[0] ?? emptyParsedFormation();
  const vehicles = summary.vehicles ?? [];
  const coaches = parsedFormation.vehicles
    .map((vehicle) => coachFromParsedVehicle(vehicle, vehicles))
    .filter((coach): coach is FormationCoachView => coach !== null);
  const sectorGroups = groupCoachesBySector(coaches);
  const directionLabel = directionFromStops(referenceStops, stops);

  return {
    title: directionLabel,
    serviceLabel: summary.serviceLabel ?? `${summary.evu} ${summary.trainNumber}`,
    directionLabel,
    selectedStop,
    stops,
    sectorGroups,
    coaches,
    metrics: [
      { label: "EVU", value: summary.evu },
      { label: "Train", value: summary.trainNumber },
      { label: "Date", value: summary.operationDate },
      { label: "Stops", value: String(summary.stopCount ?? (stops.length || "-")) },
      { label: "Vehicles", value: String(summary.vehicleCount ?? (vehicles.length || coaches.length || "-")) },
      { label: "Seats", value: String(summary.meta?.seatCount ?? "-") }
    ],
    legendItems: passengerLegendItems(),
    diagnostics: {
      rawStrings: summary.rawFormationStrings?.length ? summary.rawFormationStrings : summary.formationStrings ?? [],
      hiddenVehicleCount: parsedFormation.vehicles.length - coaches.length,
      unknownTokens: [...new Set(parsedFormation.unknownTokens.flatMap((token) => token.split(",")).map((token) => token.trim()).filter(Boolean))],
      vehicles
    }
  };
}

export function stopLabel(stop: FormationStopSummary, index: number): string {
  return [String(index + 1), stop.name ?? "Stop name unavailable", stop.track ? `track ${stop.track}` : "track unavailable"]
    .filter(Boolean)
    .join(" - ");
}

function normalizedStops(summary: SwissTrainFormationSummary, referenceStops: TripStop[]): FormationStopSummary[] {
  const stops: FormationStopSummary[] = summary.stops?.length
    ? summary.stops
    : summary.parsedFormationStrings.map((parsedFormation, index) => ({
      sequence: index + 1,
      name: `Formation sample ${index + 1}`,
      parsedFormation,
      formationString: parsedFormation.raw,
      vehicleGoals: []
    }));

  if (stops.length === 0) {
    return [];
  }

  const sortedReferenceStops = [...referenceStops].sort((left, right) => left.sequence - right.sequence);
  return stops.map((stop, index) => {
    const reference = sortedReferenceStops.find((candidate) => sameStopRef(candidate, stop)) ?? sortedReferenceStops[index];
    if (!reference) {
      return stop;
    }
    const stopNameUnavailable = !stop.name || stop.name.toLowerCase().includes("unknown");
    return {
      ...stop,
      name: stopNameUnavailable ? reference.stationName : stop.name,
      uic: stop.uic ?? reference.stationId
    };
  });
}

function sameStopRef(reference: TripStop, stop: FormationStopSummary): boolean {
  if (!stop.uic || !reference.stationId) {
    return false;
  }
  return reference.stationId === stop.uic || reference.stationId.includes(stop.uic) || stop.uic.includes(reference.stationId);
}

function fallbackStop(summary: SwissTrainFormationSummary): FormationStopSummary {
  return {
    sequence: 1,
    name: summary.serviceLabel ?? `${summary.evu} ${summary.trainNumber}`,
    parsedFormation: summary.parsedFormationStrings?.[0],
    formationString: summary.rawFormationStrings?.[0],
    vehicleGoals: []
  };
}

function emptyParsedFormation(): ParsedFormationShortString {
  return {
    raw: "",
    sectors: [],
    vehicles: [],
    unknownTokens: []
  };
}

function coachFromParsedVehicle(
  parsedVehicle: ParsedFormationVehicle,
  vehicles: FormationVehicleSummary[]
): FormationCoachView | null {
  if (!shouldShowPassengerCoach(parsedVehicle)) {
    return null;
  }

  const technicalVehicle = findTechnicalVehicle(parsedVehicle, vehicles);
  const coachNumber = parsedVehicle.displayNumber ?? technicalVehicle?.displayNumber ?? String(parsedVehicle.index);
  const services = mergeServices(parsedVehicle.services, parsedVehicle.statuses, parsedVehicle.typeCode, technicalVehicle);

  return {
    key: `${parsedVehicle.index}-${parsedVehicle.raw}`,
    position: parsedVehicle.index,
    coachNumber,
    classLabel: passengerClassLabel(parsedVehicle.typeCode, technicalVehicle),
    typeLabel: passengerTypeLabel(parsedVehicle.typeCode, parsedVehicle.typeLabel, technicalVehicle),
    rawTypeCode: parsedVehicle.typeCode,
    sector: parsedVehicle.sector,
    noPassageBefore: !parsedVehicle.accessToPrevious,
    noPassageAfter: !parsedVehicle.accessToNext,
    isClosed: parsedVehicle.statuses.some((status) => status.code === "-") || technicalVehicle?.closed === true,
    services,
    technicalVehicle
  };
}

function shouldShowPassengerCoach(vehicle: ParsedFormationVehicle): boolean {
  if (vehicle.typeCode === "F" || vehicle.typeCode === "X" || vehicle.typeCode === "LK") {
    return false;
  }
  if (vehicle.statuses.some((status) => status.code === "-") && !vehicle.displayNumber) {
    return false;
  }
  return Boolean(vehicle.displayNumber || vehicle.typeCode);
}

function findTechnicalVehicle(parsedVehicle: ParsedFormationVehicle, vehicles: FormationVehicleSummary[]): FormationVehicleSummary | undefined {
  if (parsedVehicle.displayNumber) {
    const byDisplayNumber = vehicles.find((vehicle) => vehicle.displayNumber === parsedVehicle.displayNumber);
    if (byDisplayNumber) {
      return byDisplayNumber;
    }
  }
  return vehicles.find((vehicle) => vehicle.position === parsedVehicle.index);
}

function passengerClassLabel(typeCode: string | undefined, vehicle: FormationVehicleSummary | undefined): string {
  if (typeCode === "1" || typeCode === "W1") {
    return "1";
  }
  if (typeCode === "2" || typeCode === "W2") {
    return "2";
  }
  if (typeCode === "12") {
    return "1/2";
  }
  if (typeCode === "WR") {
    return "dining";
  }
  if (vehicle?.firstClassSeats && vehicle.secondClassSeats) {
    return "1/2";
  }
  if (vehicle?.firstClassSeats) {
    return "1";
  }
  if (vehicle?.secondClassSeats) {
    return "2";
  }
  return typeCode ?? "?";
}

function passengerTypeLabel(typeCode: string | undefined, fallback: string, vehicle: FormationVehicleSummary | undefined): string {
  if (vehicle?.typeCodeName) {
    return vehicle.typeCodeName;
  }
  if (typeCode === "W1") {
    return "Restaurant and 1st class";
  }
  if (typeCode === "W2") {
    return "Restaurant and 2nd class";
  }
  if (typeCode === "WR") {
    return "Restaurant";
  }
  if (typeCode === "FA") {
    return "Family coach";
  }
  return fallback;
}

function mergeServices(
  parsedServices: ParsedFormationService[],
  statuses: ParsedFormationStatus[],
  typeCode: string | undefined,
  vehicle: FormationVehicleSummary | undefined
): FormationServiceView[] {
  const services: FormationServiceView[] = [];

  for (const service of parsedServices) {
    const mapped = serviceFromCode(service.code, service.label, service.quantity);
    if (mapped) {
      services.push(mapped);
    }
  }

  if (vehicle?.lowFloor) {
    services.push({ key: "vehicle-low-floor", icon: "lowFloor", label: "Low-floor access" });
  }
  if (vehicle?.wheelchairSpaces) {
    services.push({ key: "vehicle-wheelchair", icon: "wheelchair", label: "Wheelchair spaces", quantity: vehicle.wheelchairSpaces });
  }
  if (vehicle?.bikeHooks) {
    services.push({ key: "vehicle-bike", icon: "bike", label: "Bicycle places", quantity: vehicle.bikeHooks });
  }
  if (vehicle?.strollerPlatform) {
    services.push({ key: "vehicle-stroller", icon: "stroller", label: "Stroller space" });
  }
  if (vehicle?.familyZone) {
    services.push({ key: "vehicle-family", icon: "family", label: "Family zone" });
  }
  if (vehicle?.businessZone) {
    services.push({ key: "vehicle-business", icon: "business", label: "Business zone" });
  }
  if (vehicle?.trolleyStatus?.toLowerCase().includes("restaurant")) {
    services.push({ key: "vehicle-restaurant", icon: "restaurant", label: vehicle.trolleyStatus });
  }
  if (typeCode === "WR" || typeCode === "W1" || typeCode === "W2") {
    services.push({ key: "type-restaurant", icon: "restaurant", label: "Restaurant service" });
  }
  if (statuses.some((status) => status.code === "-") || vehicle?.closed) {
    services.push({ key: "status-closed", icon: "closed", label: "Closed to passengers" });
  }

  return uniqueServices(services);
}

function serviceFromCode(code: string, label: string, quantity?: number): FormationServiceView | null {
  const key = `service-${code}`;
  if (code === "BHP") {
    return { key, icon: "wheelchair", label, quantity };
  }
  if (code === "KW") {
    return { key, icon: "stroller", label, quantity };
  }
  if (code === "NF") {
    return { key, icon: "lowFloor", label, quantity };
  }
  if (code === "VH" || code === "VR") {
    return { key, icon: code === "VR" ? "reservation" : "bike", label, quantity };
  }
  if (code === "FZ") {
    return { key, icon: "family", label, quantity };
  }
  if (code === "BZ") {
    return { key, icon: "business", label, quantity };
  }
  return null;
}

function uniqueServices(services: FormationServiceView[]): FormationServiceView[] {
  return [...new Map(services.map((service) => [`${service.icon}-${service.label}-${service.quantity ?? ""}`, service])).values()];
}

function groupCoachesBySector(coaches: FormationCoachView[]): FormationSectorView[] {
  const groups = new Map<string, FormationCoachView[]>();
  for (const coach of coaches) {
    const sector = coach.sector ?? "Train";
    groups.set(sector, [...(groups.get(sector) ?? []), coach]);
  }
  return [...groups.entries()].map(([sector, sectorCoaches]) => ({ sector, coaches: sectorCoaches }));
}

function directionFromStops(referenceStops: TripStop[], formationStops: FormationStopSummary[]): string {
  const sortedReferenceStops = [...referenceStops].sort((left, right) => left.sequence - right.sequence);
  const origin = sortedReferenceStops[0]?.stationName ?? formationStops[0]?.name ?? "Origin";
  const destination = sortedReferenceStops[sortedReferenceStops.length - 1]?.stationName ?? formationStops[formationStops.length - 1]?.name ?? "Destination";
  return `${origin} -> ${destination}`;
}

function passengerLegendItems(): FormationLegendItem[] {
  return [
    { label: "1", detail: "1st class coach" },
    { label: "2", detail: "2nd class coach" },
    { label: "1/2", detail: "Mixed 1st and 2nd class coach" },
    { label: "Dining", detail: "Restaurant or dining coach", icon: "restaurant" },
    { label: "Low floor", detail: "Step-free low-floor access", icon: "lowFloor" },
    { label: "Wheelchair", detail: "Wheelchair space or accessible area", icon: "wheelchair" },
    { label: "Stroller", detail: "Pram or stroller platform", icon: "stroller" },
    { label: "Bicycle", detail: "Bicycle spaces; reservation may be required", icon: "bike" },
    { label: "Business", detail: "Business zone in 1st class", icon: "business" },
    { label: "Family", detail: "Family area or family coach", icon: "family" }
  ];
}
