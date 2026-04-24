import Link from "next/link";
import { ArrowRight, ImageDown, MapPinned, Route, Upload } from "lucide-react";
import { calculateTripStats, demoTrips } from "@trainmap/domain";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { TransportMap } from "@/components/transport-map";
import { TripTable } from "@/components/trip-table";

export default function OverviewPage() {
  const stats = calculateTripStats(demoTrips);

  return (
    <div>
      <PageHeader
        eyebrow="Personal transport footprint"
        title="Rail-first travel archive"
        description="A self-hosted workspace for trips, route geometry, station coverage, import review, and export-ready visual summaries."
        action={
          <Link href="/trips/new" className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm text-white">
            Add trip
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="space-y-6 p-5 lg:p-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Trips" value={String(stats.totalTrips)} detail="Completed and reviewable journeys" />
          <StatCard label="Distance" value={`${stats.totalDistanceKm.toLocaleString()} km`} detail="Across stored route segments" />
          <StatCard label="Countries" value={String(stats.countryCount)} detail="Coverage from station sequence" />
          <StatCard label="Operators" value={String(stats.operatorCount)} detail="Normalized carrier records" />
        </div>

        <section className="grid gap-5 xl:grid-cols-[1.5fr_0.8fr]">
          <TransportMap trips={demoTrips} />
          <div className="grid gap-4">
            {[
              {
                icon: Upload,
                title: "Import queue",
                detail: "Dry-run CSV validation with fuzzy station matching and unmatched row review.",
                href: "/import"
              },
              {
                icon: Route,
                title: "Geometry repair",
                detail: "Manual vias and stop sequence edits create new geometry versions.",
                href: "/trips/trip-zurich-milano"
              },
              {
                icon: ImageDown,
                title: "Poster exports",
                detail: "Dedicated render pages for 1080p, 2K, 4K, and 8K PNG output.",
                href: "/export"
              },
              {
                icon: MapPinned,
                title: "Saved views",
                detail: "Shareable filters keep public routes separate from private source data.",
                href: "/share/alpine-archive"
              }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.title} href={item.href} className="rounded-md border border-black/10 bg-white/72 p-4 shadow-sm transition hover:border-ink">
                  <Icon className="h-5 w-5 text-rail" />
                  <div className="mt-3 font-display text-2xl text-ink">{item.title}</div>
                  <p className="mt-2 text-sm leading-6 text-black/58">{item.detail}</p>
                </Link>
              );
            })}
          </div>
        </section>

        <TripTable trips={demoTrips} />
      </div>
    </div>
  );
}
