import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { PageHeader } from "@/components/page-header";
import { ScheduleAssistant } from "@/components/schedule-assistant";
import { TripForm } from "@/components/trip-form";
import { getTrainmapRepository } from "@/lib/db";
import { isSwissTrainFormationConfigured } from "@/lib/providers/swiss-formation";

export const dynamic = "force-dynamic";

export default function NewTripPage() {
  const repository = getTrainmapRepository();

  return (
    <div>
      <PageHeader
        eyebrow="Add or edit trip"
        title="Create a trip"
        description="Search Swiss Open Data OJP, pick a train, preview stops and geometry, then save the trip to PostGIS."
      />
      <div className="space-y-5 p-5 lg:p-8">
        {repository ? <ScheduleAssistant trainFormationConfigured={isSwissTrainFormationConfigured()} /> : <DatabaseSetupNotice />}
        {repository ? (
          <details className="border-t border-black/10 pt-5">
            <summary className="cursor-pointer font-display text-2xl text-ink">Manual trip draft</summary>
            <div className="mt-4">
              <TripForm />
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}
