"use server";

import { revalidatePath } from "next/cache";
import type { ManualViaPoint, TripStopInput } from "@trainmap/domain";
import { repairTripWithManualGeometry } from "@trainmap/domain";
import { getRequiredTrainmapRepository } from "@/lib/db";

export async function repairTripGeometryAction(tripId: string, formData: FormData) {
  const repository = getRequiredTrainmapRepository();
  const stops = parseJson<TripStopInput[]>(formData.get("stopsJson"), []);
  const manualViaPoints = parseJson<ManualViaPoint[]>(formData.get("manualViasJson"), []);

  await repairTripWithManualGeometry(repository, {
    tripId,
    stops,
    manualViaPoints,
    createdBy: "user",
    changeSummary: "Manual route repair"
  });

  revalidatePath("/");
  revalidatePath("/map");
  revalidatePath("/trips");
  revalidatePath(`/trips/${tripId}`);
}

function parseJson<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (typeof value !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
