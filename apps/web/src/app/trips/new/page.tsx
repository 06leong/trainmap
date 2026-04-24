import { PageHeader } from "@/components/page-header";
import { ScheduleAssistant } from "@/components/schedule-assistant";

export default function NewTripPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Add or edit trip"
        title="Create a trip"
        description="Start manually or query a timetable adapter, pick a train, import the stop sequence, then generate editable route geometry."
      />
      <div className="grid gap-5 p-5 xl:grid-cols-[0.9fr_1.1fr] lg:p-8">
        <section className="rounded-md border border-black/10 bg-white/72 p-4 shadow-sm">
          <h2 className="font-display text-2xl text-ink">Manual trip draft</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {["Title", "Origin", "Destination", "Operator", "Train code", "Date"].map((label) => (
              <label key={label} className="text-sm">
                <span className="text-black/54">{label}</span>
                <input className="mt-1 h-10 w-full rounded-md border border-black/10 bg-[#f8f5ef] px-3 outline-none focus:border-ink" />
              </label>
            ))}
          </div>
          <div className="mt-5 rounded-md border border-dashed border-black/20 bg-[#f8f5ef] p-4 text-sm text-black/58">
            The production path stores this draft in PostGIS-backed trips, trip_stops, and trip_geometries tables. This MVP keeps the form client-side until persistence is wired.
          </div>
        </section>
        <ScheduleAssistant />
      </div>
    </div>
  );
}
