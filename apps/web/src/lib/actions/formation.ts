"use server";

import { revalidatePath } from "next/cache";
import { getRequiredTrainmapRepository } from "@/lib/db";
import { normalizeStoredTrainFormation } from "@/lib/formation-record";
import { getTrainFormationForTrip } from "@/lib/providers/swiss-formation";

export async function refreshTrainFormationForTripAction(tripId: string) {
  const repository = getRequiredTrainmapRepository();
  const trip = await repository.getTrip(tripId);
  if (!trip) {
    throw new Error(`Trip ${tripId} does not exist.`);
  }

  const formation = await getTrainFormationForTrip(trip);
  const normalized = normalizeStoredTrainFormation(formation, trip.stops) ?? formation;
  await repository.updateTripRawImportRow(trip.id, {
    ...(trip.rawImportRow ?? {}),
    trainFormation: normalized
  });
  revalidatePath(`/trips/${trip.id}`);
}
