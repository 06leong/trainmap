import { isDatabaseConfigured } from "./client";
import { PostgresTrainmapRepository } from "./repository";

export function getTrainmapRepository(): PostgresTrainmapRepository | null {
  if (!isDatabaseConfigured()) {
    return null;
  }

  return new PostgresTrainmapRepository();
}

export function getRequiredTrainmapRepository(): PostgresTrainmapRepository {
  const repository = getTrainmapRepository();
  if (!repository) {
    throw new Error("DATABASE_URL is required for this action.");
  }
  return repository;
}
