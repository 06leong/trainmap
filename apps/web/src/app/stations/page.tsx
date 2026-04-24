import { PageHeader } from "@/components/page-header";
import { StationSearch } from "@/components/station-search";

export default function StationsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Station detail"
        title="Stations"
        description="Station search is separate from route rendering so aliases, country coverage, and unmatched import rows can evolve independently."
      />
      <div className="p-5 lg:p-8">
        <StationSearch />
      </div>
    </div>
  );
}
