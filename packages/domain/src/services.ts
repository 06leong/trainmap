import type { TrainmapRepository } from "./repository";
import type { CreateTripInput, ManualViaPoint, RepairTripGeometryInput, Trip, TripStopInput } from "./types";

export async function createTripWithInitialGeometry(
  repository: TrainmapRepository,
  input: CreateTripInput
): Promise<Trip> {
  const initialGeometry =
    input.initialGeometry ??
    (() => {
      return {
        source: "generated" as const,
        confidence: "inferred" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: [...input.stops].sort((a, b) => a.sequence - b.sequence).map((stop) => stop.coordinates)
        },
        manualViaPoints: [] as ManualViaPoint[],
        createdBy: "user"
      };
    })();

  return repository.createTrip({
    ...input,
    initialGeometry
  });
}

export async function repairTripWithManualGeometry(
  repository: TrainmapRepository,
  input: RepairTripGeometryInput
): Promise<Trip> {
  return repository.repairTripGeometry(input);
}
