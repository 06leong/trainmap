"use server";

import type { ImportCommitResult } from "@trainmap/domain";
import { buildImportCommitInput, buildImportPreview, type ColumnMapping } from "@trainmap/importer";
import { getRequiredTrainmapRepository } from "@/lib/db";

export interface ImportActionState {
  status: "idle" | "success" | "error";
  message?: string;
  result?: ImportCommitResult;
}

export async function commitImportAction(_previousState: ImportActionState, formData: FormData): Promise<ImportActionState> {
  try {
    const csvText = String(formData.get("csvText") ?? "");
    const sourceName = String(formData.get("sourceName") ?? "viaducttrip.csv");
    const mapping = parseMapping(String(formData.get("mappingJson") ?? "{}"));

    if (!csvText.trim()) {
      return {
        status: "error",
        message: "CSV input is empty."
      };
    }

    const repository = getRequiredTrainmapRepository();
    const stations = await repository.listStations();
    const preview = buildImportPreview(csvText, stations, mapping);
    const commitInput = buildImportCommitInput(preview, sourceName);
    const result = await repository.commitImport(commitInput);

    return {
      status: "success",
      message: `Imported ${result.committedTrips} trips. ${result.reviewRows} rows require review. ${result.skippedDuplicateTrips} duplicates skipped.`,
      result
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Import failed."
    };
  }
}

function parseMapping(value: string): ColumnMapping {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}
