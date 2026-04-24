import { Filter } from "lucide-react";
import { demoOperators, demoTags, demoTrips } from "@trainmap/domain";
import { PageHeader } from "@/components/page-header";
import { TransportMap } from "@/components/transport-map";

export default function MapPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Overview map mode"
        title="Full footprint map"
        description="Many trips render as business route, station, label, and coverage layers over a swappable MapLibre basemap."
      />
      <div className="grid gap-5 p-5 lg:grid-cols-[300px_1fr] lg:p-8">
        <aside className="rounded-md border border-black/10 bg-white/72 p-4 shadow-sm">
          <div className="flex items-center gap-2 font-medium text-ink">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          <div className="mt-4 space-y-4 text-sm">
            <FilterBlock label="Year" options={["2026", "2025", "2024"]} />
            <FilterBlock label="Operator" options={demoOperators.map((operator) => operator.name)} />
            <FilterBlock label="Tag" options={demoTags.map((tag) => tag.label)} />
            <FilterBlock label="Status" options={["completed", "planned", "needs review"]} />
            <FilterBlock label="Class" options={["first", "second", "sleeper", "mixed"]} />
          </div>
        </aside>
        <TransportMap trips={demoTrips} heightClass="h-[calc(100vh-170px)] min-h-[620px]" />
      </div>
    </div>
  );
}

function FilterBlock({ label, options }: { label: string; options: string[] }) {
  return (
    <div>
      <div className="mb-2 text-xs uppercase text-black/45">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button key={option} type="button" className="rounded-full border border-black/10 bg-[#f8f5ef] px-3 py-1.5 text-xs text-black/62">
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
