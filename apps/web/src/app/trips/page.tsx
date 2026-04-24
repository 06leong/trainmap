import Link from "next/link";
import { Plus } from "lucide-react";
import { demoTrips } from "@trainmap/domain";
import { PageHeader } from "@/components/page-header";
import { TripTable } from "@/components/trip-table";

export default function TripsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Trip management"
        title="Trips"
        description="Search, sort, filter, bulk review, and open individual trips for geometry correction."
        action={
          <Link href="/trips/new" className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm text-white">
            <Plus className="h-4 w-4" />
            Add trip
          </Link>
        }
      />
      <div className="p-5 lg:p-8">
        <TripTable trips={demoTrips} />
      </div>
    </div>
  );
}
