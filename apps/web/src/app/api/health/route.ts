export const dynamic = "force-static";

export function GET() {
  return Response.json({
    ok: true,
    service: "trainmap",
    checks: {
      app: "ready",
      database: "configure DATABASE_URL for PostGIS persistence"
    }
  });
}
