import { notFound } from "next/navigation";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { PageHeader } from "@/components/page-header";
import { RouteEditor } from "@/components/route-editor";
import { StatusPill } from "@/components/status-pill";
import { TrainFormationPanel } from "@/components/train-formation-panel";
import { TripEditForm } from "@/components/trip-form";
import { refineTripGeometryWithSwissOpenDataAction, repairTripGeometryAction } from "@/lib/actions/geometry";
import { updateTripAction } from "@/lib/actions/trips";
import { getTrainmapRepository } from "@/lib/db";
import { isSwissOpenDataConfigured } from "@/lib/providers/swiss-open-data";
import type { TrainFormationRecord } from "@/lib/providers/swiss-formation";

export const dynamic = "force-dynamic";

export default async function TripDetailPage({ params }: { params: { tripId: string } }) {
  const repository = getTrainmapRepository();
  if (!repository) {
    return (
      <div>
        <PageHeader
          eyebrow="Trip detail mode"
          title="Database setup"
          description="Trip details are loaded from PostgreSQL/PostGIS at runtime."
        />
        <div className="p-5 lg:p-8">
          <DatabaseSetupNotice />
        </div>
      </div>
    );
  }

  const trip = await repository.getTrip(params.tripId);

  if (!trip) {
    notFound();
  }

  const saveTrip = updateTripAction.bind(null, trip.id);
  const repairTrip = repairTripGeometryAction.bind(null, trip.id);
  const refineWithSwissOpenData = refineTripGeometryWithSwissOpenDataAction.bind(null, trip.id);
  const trainFormation = trainFormationFromRawImportRow(trip.rawImportRow);

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
        <TripEditForm
          tripId={trip.id}
          title={trip.title}
          date={trip.date}
          operatorName={trip.operatorName}
          trainCode={trip.trainCode}
          distanceKm={trip.distanceKm}
          status={trip.status}
          serviceClass={trip.serviceClass}
          action={saveTrip}
        />
        {trainFormation ? <TrainFormationPanel record={trainFormation} /> : null}
        <RouteEditor
          trip={trip}
          repairAction={repairTrip}
          refineWithSwissOpenDataAction={refineWithSwissOpenData}
          swissOpenDataConfigured={isSwissOpenDataConfigured()}
        />
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

function trainFormationFromRawImportRow(rawImportRow: Record<string, unknown> | undefined): TrainFormationRecord | null {
  const candidate = rawImportRow?.trainFormation;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  return candidate as TrainFormationRecord;
}
