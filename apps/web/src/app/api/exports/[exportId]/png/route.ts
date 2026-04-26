import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getRequiredTrainmapRepository } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { exportId: string } }) {
  const repository = getRequiredTrainmapRepository();
  const job = await repository.getExport(params.exportId);

  if (!job?.outputPath || job.status !== "complete") {
    return NextResponse.json({ error: "Export PNG is not available." }, { status: 404 });
  }

  const file = await readFile(job.outputPath);
  return new NextResponse(file, {
    headers: {
      "content-type": "image/png",
      "content-disposition": `attachment; filename="trainmap-${job.id}.png"`
    }
  });
}
