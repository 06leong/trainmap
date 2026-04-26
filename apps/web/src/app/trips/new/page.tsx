import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { PageHeader } from "@/components/page-header";
import { ScheduleAssistant } from "@/components/schedule-assistant";
import { TripForm } from "@/components/trip-form";
import { getTrainmapRepository } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function NewTripPage() {
  const repository = getTrainmapRepository();

  return (
    <div>
      <PageHeader
        eyebrow="Add or edit trip"
        title="Create a trip"
        description="Start manually or query a timetable adapter, pick a train, import the stop sequence, then generate editable route geometry."
      />
      <div className="grid gap-5 p-5 xl:grid-cols-[0.9fr_1.1fr] lg:p-8">
        {repository ? <TripForm /> : <DatabaseSetupNotice />}
        <ScheduleAssistant />
      </div>
    </div>
  );
}
