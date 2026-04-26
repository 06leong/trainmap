"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ServiceClass, TripStatus } from "@trainmap/domain";
import { createTripWithInitialGeometry } from "@trainmap/domain";
import { getRequiredTrainmapRepository } from "@/lib/db";

export async function createTripAction(formData: FormData) {
  const repository = getRequiredTrainmapRepository();
  const originCoordinates = coordinatesFromForm(formData, "origin");
  const destinationCoordinates = coordinatesFromForm(formData, "destination");

  const trip = await createTripWithInitialGeometry(repository, {
    title: stringValue(formData, "title", "Untitled trip"),
    date: stringValue(formData, "date", new Date().toISOString().slice(0, 10)),
    operatorName: stringValue(formData, "operatorName", "Unknown operator"),
    trainCode: optionalString(formData, "trainCode"),
    status: "completed",
    serviceClass: "second",
    distanceKm: numberValue(formData, "distanceKm", 0),
    stops: [
      {
        stationName: stringValue(formData, "originName", "Origin"),
        countryCode: stringValue(formData, "originCountryCode", "XX"),
        coordinates: originCoordinates,
        sequence: 1,
        source: "manual",
        confidence: "matched"
      },
      {
        stationName: stringValue(formData, "destinationName", "Destination"),
        countryCode: stringValue(formData, "destinationCountryCode", "XX"),
        coordinates: destinationCoordinates,
        sequence: 2,
        source: "manual",
        confidence: "matched"
      }
    ]
  });

  revalidatePath("/");
  revalidatePath("/map");
  revalidatePath("/trips");
  redirect(`/trips/${trip.id}`);
}

export async function updateTripAction(tripId: string, formData: FormData) {
  const repository = getRequiredTrainmapRepository();
  await repository.updateTrip(tripId, {
    title: stringValue(formData, "title", "Untitled trip"),
    status: stringValue(formData, "status", "completed") as TripStatus,
    serviceClass: stringValue(formData, "serviceClass", "second") as ServiceClass,
    date: stringValue(formData, "date", new Date().toISOString().slice(0, 10)),
    operatorName: stringValue(formData, "operatorName", "Unknown operator"),
    trainCode: optionalString(formData, "trainCode"),
    distanceKm: numberValue(formData, "distanceKm", 0)
  });

  revalidatePath("/");
  revalidatePath("/map");
  revalidatePath("/trips");
  revalidatePath(`/trips/${tripId}`);
}

function coordinatesFromForm(formData: FormData, prefix: "origin" | "destination"): [number, number] {
  return [
    numberValue(formData, `${prefix}Longitude`, 0),
    numberValue(formData, `${prefix}Latitude`, 0)
  ];
}

function stringValue(formData: FormData, key: string, fallback: string): string {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function optionalString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(formData: FormData, key: string, fallback: number): number {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : fallback;
}
