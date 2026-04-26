import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { PageHeader } from "@/components/page-header";
import { StationSearch } from "@/components/station-search";
import { getTrainmapRepository } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function StationsPage() {
  const repository = getTrainmapRepository();
  const [stations, trips] = repository ? await Promise.all([repository.listStations(), repository.listTrips()]) : [[], []];

  return (
    <div>
      <PageHeader
        eyebrow="Station detail"
        title="Stations"
        description="Station search is separate from route rendering so aliases, country coverage, and unmatched import rows can evolve independently."
      />
      <div className="p-5 lg:p-8">
        {!repository ? <DatabaseSetupNotice /> : <StationSearch stations={stations} trips={trips} />}
      </div>
    </div>
  );
}
