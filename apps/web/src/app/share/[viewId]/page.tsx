import { demoTrips } from "@trainmap/domain";
import { PageHeader } from "@/components/page-header";
import { TransportMap } from "@/components/transport-map";
import { TripTable } from "@/components/trip-table";

export default function SharePage({ params }: { params: { viewId: string } }) {
  return (
    <div>
      <PageHeader
        eyebrow="Public share link"
        title="Alpine archive"
        description={`Shared view ${params.viewId} exposes a curated filter set without exposing raw imports or private edit history.`}
      />
      <div className="space-y-5 p-5 lg:p-8">
        <TransportMap trips={demoTrips.filter((trip) => trip.countryCodes.includes("CH"))} />
        <TripTable trips={demoTrips.filter((trip) => trip.countryCodes.includes("CH"))} />
      </div>
    </div>
  );
}
