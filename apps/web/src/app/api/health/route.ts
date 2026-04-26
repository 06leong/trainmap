import { isDatabaseConfigured } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    ok: true,
    service: "trainmap",
    checks: {
      app: "ready",
      database: isDatabaseConfigured() ? "configured" : "configure DATABASE_URL for PostGIS persistence"
    }
  });
}
