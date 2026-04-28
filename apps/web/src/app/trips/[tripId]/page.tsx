import { notFound } from "next/navigation";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { PageHeader } from "@/components/page-header";
import { RouteEditor } from "@/components/route-editor";
import { StatusPill } from "@/components/status-pill";
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

function TrainFormationPanel({ record }: { record: TrainFormationRecord }) {
  return (
    <section className="rounded-md border border-black/10 bg-white/72 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase text-black/45">Train Formation Service</div>
          <h2 className="mt-1 font-display text-2xl text-ink">Formation summary</h2>
        </div>
        <div className="rounded-full border border-black/10 bg-[#f8f5ef] px-3 py-1 text-xs text-black/58">
          {record.configured ? "configured" : "not configured"}
        </div>
      </div>

      {record.message ? <p className="mt-3 text-sm text-black/58">{record.message}</p> : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {record.summaries.map((summary) => (
          <div key={`${summary.evu}-${summary.operationDate}-${summary.trainNumber}`} className="rounded-md border border-black/10 bg-[#f8f5ef] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium text-ink">{summary.serviceLabel ?? `${summary.evu} ${summary.trainNumber}`}</div>
              <div className="rounded-full border border-black/10 bg-white px-2 py-1 text-xs text-black/58">{summary.status}</div>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-black/62 sm:grid-cols-3">
              <SmallMetric label="EVU" value={summary.evu} />
              <SmallMetric label="Train" value={summary.trainNumber} />
              <SmallMetric label="Date" value={summary.operationDate} />
              <SmallMetric label="Stops" value={summary.stopCount ? String(summary.stopCount) : "-"} />
              <SmallMetric label="Vehicles" value={summary.vehicleCount ? String(summary.vehicleCount) : "-"} />
              <SmallMetric label="Samples" value={String(summary.formationStrings.length)} />
            </div>
            {summary.formationStrings.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {summary.formationStrings.map((formation) => (
                  <span key={formation} className="rounded border border-black/10 bg-white px-2 py-1 font-mono text-xs text-black/68">
                    {formation}
                  </span>
                ))}
              </div>
            ) : null}
            {summary.message ? <p className="mt-3 text-xs text-black/50">{summary.message}</p> : null}
            <div className="mt-3 rounded border border-black/10 bg-white px-2 py-1 font-mono text-[11px] text-black/55">
              {summary.endpoint}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-black/40">{label}</div>
      <div className="mt-1 font-medium text-ink">{value}</div>
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
