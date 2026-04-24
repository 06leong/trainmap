import type { RouteConfidence, Trip, TripFilters } from "./types";

export interface TripStats {
  totalTrips: number;
  totalDistanceKm: number;
  countryCount: number;
  operatorCount: number;
  yearBuckets: Array<{ year: number; trips: number; distanceKm: number }>;
  confidence: Record<RouteConfidence, number>;
  reviewedTrips: number;
}

export function filterTrips(trips: Trip[], filters: TripFilters): Trip[] {
  return trips.filter((trip) => {
    const text = `${trip.title} ${trip.operatorName} ${trip.trainCode ?? ""}`.toLowerCase();
    if (filters.query && !text.includes(filters.query.toLowerCase())) {
      return false;
    }
    if (filters.year && new Date(trip.date).getUTCFullYear() !== filters.year) {
      return false;
    }
    if (filters.dateFrom && trip.date < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && trip.date > filters.dateTo) {
      return false;
    }
    if (filters.operatorId && trip.operatorId !== filters.operatorId) {
      return false;
    }
    if (filters.countryCode && !trip.countryCodes.includes(filters.countryCode)) {
      return false;
    }
    if (filters.journeyId && trip.journeyId !== filters.journeyId) {
      return false;
    }
    if (filters.tagId && !trip.tagIds.includes(filters.tagId)) {
      return false;
    }
    if (filters.status && trip.status !== filters.status) {
      return false;
    }
    if (filters.serviceClass && trip.serviceClass !== filters.serviceClass) {
      return false;
    }
    if (filters.mode && trip.mode !== filters.mode) {
      return false;
    }
    return true;
  });
}

export function calculateTripStats(trips: Trip[]): TripStats {
  const countries = new Set<string>();
  const operators = new Set<string>();
  const yearMap = new Map<number, { year: number; trips: number; distanceKm: number }>();
  const confidence: Record<RouteConfidence, number> = {
    exact: 0,
    inferred: 0,
    manual: 0
  };

  let totalDistanceKm = 0;
  let reviewedTrips = 0;

  for (const trip of trips) {
    totalDistanceKm += trip.distanceKm;
    operators.add(trip.operatorId);
    trip.countryCodes.forEach((country) => countries.add(country));
    if (trip.status !== "needs_review") {
      reviewedTrips += 1;
    }
    const routeConfidence = trip.geometry?.confidence ?? "inferred";
    confidence[routeConfidence] += 1;
    const year = new Date(trip.date).getUTCFullYear();
    const bucket = yearMap.get(year) ?? { year, trips: 0, distanceKm: 0 };
    bucket.trips += 1;
    bucket.distanceKm += trip.distanceKm;
    yearMap.set(year, bucket);
  }

  return {
    totalTrips: trips.length,
    totalDistanceKm: Math.round(totalDistanceKm),
    countryCount: countries.size,
    operatorCount: operators.size,
    yearBuckets: [...yearMap.values()].sort((a, b) => a.year - b.year),
    confidence,
    reviewedTrips
  };
}
