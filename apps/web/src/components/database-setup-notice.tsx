import Link from "next/link";

export function DatabaseSetupNotice({
  title = "Database connection required",
  detail = "Set DATABASE_URL to a PostgreSQL/PostGIS database, run migrations, then seed or import trips."
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="rounded-md border border-amber-700/20 bg-amber-50 p-5 text-amber-950 shadow-sm">
      <div className="font-display text-2xl">{title}</div>
      <p className="mt-2 max-w-3xl text-sm leading-6">{detail}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <code className="rounded bg-white/70 px-2 py-1">DATABASE_URL=postgres://...</code>
        <Link href="/stations" className="rounded bg-amber-900 px-3 py-1.5 text-white">
          Check station setup
        </Link>
      </div>
    </div>
  );
}
