import { notFound } from "next/navigation";
import { demoTrips } from "@trainmap/domain";
import { PageHeader } from "@/components/page-header";
import { RouteEditor } from "@/components/route-editor";
import { StatusPill } from "@/components/status-pill";

export function generateStaticParams() {
  return demoTrips.map((trip) => ({ tripId: trip.id }));
}

export default function TripDetailPage({ params }: { params: { tripId: string } }) {
  const trip = demoTrips.find((candidate) => candidate.id === params.tripId);

  if (!trip) {
    notFound();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Trip detail mode"
        title={trip.title}
        description="Single-trip mode renders the current geometry or falls back to stop sequence and waypoints when exact geometry is missing."
        action={
          <div className="flex flex-wrap gap-2">
            <StatusPill value={trip.status} />
            <StatusPill value={trip.geometry?.confidence ?? "inferred"} />
          </div>
        }
      />
      <div className="space-y-5 p-5 lg:p-8">
        <section className="grid gap-3 md:grid-cols-4">
          <TripMeta label="Date" value={trip.date} />
          <TripMeta label="Operator" value={trip.operatorName} />
          <TripMeta label="Train" value={trip.trainCode ?? "Manual"} />
          <TripMeta label="Distance" value={`${trip.distanceKm.toLocaleString()} km`} />
        </section>
        <RouteEditor trip={trip} />
      </div>
    </div>
  );
}

function TripMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-black/10 bg-white/72 p-4 shadow-sm">
      <div className="text-xs uppercase text-black/45">{label}</div>
      <div className="mt-2 font-display text-2xl text-ink">{value}</div>
    </div>
  );
}
