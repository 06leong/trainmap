import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { PageHeader } from "@/components/page-header";
import { TransportMap } from "@/components/transport-map";
import { TripTable } from "@/components/trip-table";
import { getTrainmapRepository } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: { viewId: string } }) {
  const repository = getTrainmapRepository();
  const trips = repository ? (await repository.listTrips()).filter((trip) => trip.countryCodes.includes("CH")) : [];

  return (
    <div>
      <PageHeader
        eyebrow="Public share link"
        title="Alpine archive"
        description={`Shared view ${params.viewId} exposes a curated filter set without exposing raw imports or private edit history.`}
      />
      <div className="space-y-5 p-5 lg:p-8">
        {!repository ? <DatabaseSetupNotice /> : null}
        <TransportMap trips={trips} />
        <TripTable trips={trips} />
      </div>
    </div>
  );
}
