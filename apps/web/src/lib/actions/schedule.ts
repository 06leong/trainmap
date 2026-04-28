"use server";

import { redirect } from "next/navigation";
import type { LineStringGeometry, ServiceClass, TripStopInput } from "@trainmap/domain";
import { createTripWithInitialGeometry } from "@trainmap/domain";
import type { StationSearchResult, SwissOpenDataPlace, SwissOpenDataRouteOption } from "@trainmap/timetable-adapters";
import { getRequiredTrainmapRepository } from "@/lib/db";
import {
  estimateDistanceKm,
  isSwissOpenDataConfigured,
  searchSwissOpenDataRoutes,
  searchSwissOpenDataStations
} from "@/lib/providers/swiss-open-data";
import { getTrainFormationForScheduleOption } from "@/lib/providers/swiss-formation";
import { europeanLocalDateTimeToUtcIso } from "@/lib/time";

export interface ScheduleStationSearchResult {
  stations: StationSearchResult[];
  error?: string;
}

export interface ScheduleConnectionSearchInput {
  origin: SwissOpenDataPlace;
  destination: SwissOpenDataPlace;
  departureDate: string;
  departureTime: string;
}

export interface ScheduleConnectionSearchResult {
  options: SwissOpenDataRouteOption[];
  error?: string;
}

export async function searchScheduleStationsAction(query: string): Promise<ScheduleStationSearchResult> {
  if (!isSwissOpenDataConfigured()) {
    return { stations: [], error: "SWISS_OPEN_DATA_API_KEY is not configured." };
  }

  try {
    return { stations: await searchSwissOpenDataStations(query) };
  } catch (error) {
    return { stations: [], error: errorMessage(error, "Station search failed.") };
  }
}

export async function searchScheduleConnectionsAction(
  input: ScheduleConnectionSearchInput
): Promise<ScheduleConnectionSearchResult> {
  if (!isSwissOpenDataConfigured()) {
    return { options: [], error: "SWISS_OPEN_DATA_API_KEY is not configured." };
  }

  try {
    return {
      options: await searchSwissOpenDataRoutes({
        origin: input.origin,
        destination: input.destination,
        departureAt: europeanLocalDateTimeToUtcIso(input.departureDate, input.departureTime),
        numberOfResults: 8
      })
    };
  } catch (error) {
    return { options: [], error: errorMessage(error, "Connection search failed.") };
  }
}

export async function createTripFromScheduleAction(formData: FormData) {
  const repository = getRequiredTrainmapRepository();
  const option = parseOption(formData.get("scheduleOptionJson"));
  const geometry = option.geometry ?? geometryFromStops(option.stops);
  const origin = option.stops[0];
  const destination = option.stops[option.stops.length - 1];
  const serviceClass = stringValue(formData, "serviceClass", "second") as ServiceClass;
  const title = stringValue(formData, "title", `${origin.stationName} to ${destination.stationName}`);
  const formation = await getTrainFormationForScheduleOption(option);

  const trip = await createTripWithInitialGeometry(repository, {
    title,
    date: option.departureAt,
    arrivalDate: option.arrivalAt,
    operatorName: option.operatorName || "Swiss Open Data",
    operatorCountryCode: "CH",
    trainCode: option.trainCode,
    status: "completed",
    serviceClass,
    distanceKm: estimateDistanceKm(geometry),
    stops: option.stops.map(toTripStopInput),
    initialGeometry: {
      source: "provider",
      confidence: geometry.coordinates.length > option.stops.length ? "exact" : "inferred",
      geometry,
      manualViaPoints: [],
      notes: `Created from Swiss Open Data OJP result ${option.rawResultId}.`,
      createdBy: "swiss_open_data"
    },
    rawImportRow: {
      provider: "swiss_open_data_ojp",
      rawResultId: option.rawResultId,
      services: option.services,
      routeSegments: option.routeSegments,
      trainFormation: formation
    }
  });

  redirect(`/trips/${trip.id}`);
}

function parseOption(value: FormDataEntryValue | null): SwissOpenDataRouteOption {
  if (typeof value !== "string") {
    throw new Error("No schedule option was selected.");
  }

  const parsed = JSON.parse(value) as SwissOpenDataRouteOption;
  if (!parsed.stops?.length || parsed.stops.length < 2) {
    throw new Error("Selected schedule option does not contain at least two stops.");
  }

  return parsed;
}

function toTripStopInput(stop: SwissOpenDataRouteOption["stops"][number], index: number): TripStopInput {
  return {
    stationId: stop.stationId,
    stationName: stop.stationName,
    countryCode: stop.countryCode,
    coordinates: stop.coordinates,
    sequence: index + 1,
    arrivalAt: stop.arrivalAt,
    departureAt: stop.departureAt,
    source: "provider",
    confidence: "matched"
  };
}

function geometryFromStops(stops: SwissOpenDataRouteOption["stops"]): LineStringGeometry {
  return {
    type: "LineString",
    coordinates: stops.map((stop) => stop.coordinates)
  };
}

function stringValue(formData: FormData, key: string, fallback: string): string {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
