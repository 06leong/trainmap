import { calculateTripStats, type Trip } from "@trainmap/domain";
import { createExportConfig, type ExportLayout, type ExportPresetId, type ExportTheme } from "@trainmap/exporter";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { TransportMap } from "@/components/transport-map";
import { getTrainmapRepository } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ExportRenderPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const repository = getTrainmapRepository();
  const trips = repository ? await repository.listTrips() : [];
  const config = createExportConfig({
    layout: value(searchParams.layout, "poster") as ExportLayout,
    presetId: value(searchParams.preset, "4k") as ExportPresetId,
    theme: value(searchParams.theme, "dark") as ExportTheme,
    title: value(searchParams.title, "trainmap"),
    subtitle: value(searchParams.subtitle, "Personal railway footprint"),
    includeLegend: value(searchParams.legend, "true") === "true",
    includeAttribution: value(searchParams.attribution, "true") === "true"
  });
  const stats = calculateTripStats(trips);
  const dark = config.theme === "dark";

  return (
    <div
      data-export-ready="true"
      className={dark ? "overflow-hidden bg-[#111827] text-white" : "overflow-hidden bg-[#f8f5ef] text-ink"}
      style={{ width: `${config.preset.width}px`, height: `${config.preset.height}px` }}
    >
      <div className="h-full p-8">
        <div
          className={dark ? "h-full border border-white/18 bg-[#111827] p-8" : "h-full border border-black/10 bg-[#f8f5ef] p-8"}
        >
          {!repository ? <DatabaseSetupNotice /> : null}
          {config.layout === "stats-only" ? (
            <StatsExport title={config.title} subtitle={config.subtitle} dark={dark} trips={trips} />
          ) : config.layout === "map-only" ? (
            <TransportMap trips={trips} showControls={false} heightClass="h-full" />
          ) : (
            <div className="grid h-full gap-6 lg:grid-cols-[1.4fr_0.8fr]">
              <TransportMap trips={trips} showControls={false} heightClass="h-full" />
              <div className="flex flex-col justify-between">
                <div>
                  <div className="text-sm uppercase opacity-55">trainmap poster</div>
                  <h1 className="mt-4 font-display text-6xl">{config.title}</h1>
                  <p className="mt-4 max-w-xl text-xl opacity-70">{config.subtitle}</p>
                </div>
                <div className="grid gap-4">
                  <PosterMetric label="Distance" value={`${stats.totalDistanceKm.toLocaleString()} km`} />
                  <PosterMetric label="Countries" value={String(stats.countryCount)} />
                  <PosterMetric label="Manual geometries" value={String(stats.confidence.manual)} />
                </div>
                {config.includeAttribution ? (
                  <div className="text-xs opacity-55">Basemap style compatible with OpenFreeMap/OpenMapTiles/MapTiler. Routes are trainmap business layers.</div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsExport({ title, subtitle, dark, trips }: { title: string; subtitle?: string; dark: boolean; trips: Trip[] }) {
  const stats = calculateTripStats(trips);
  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="text-sm uppercase opacity-55">statistics export</div>
        <h1 className="mt-4 font-display text-6xl">{title}</h1>
        <p className="mt-4 text-xl opacity-70">{subtitle}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <PosterMetric label="Trips" value={String(stats.totalTrips)} />
        <PosterMetric label="Distance" value={`${stats.totalDistanceKm.toLocaleString()} km`} />
        <PosterMetric label="Countries" value={String(stats.countryCount)} />
        <PosterMetric label="Operators" value={String(stats.operatorCount)} />
      </div>
      <div className={dark ? "h-28 border-t border-white/20" : "h-28 border-t border-black/15"} />
    </div>
  );
}

function PosterMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-current/25 pt-4">
      <div className="text-sm uppercase opacity-55">{label}</div>
      <div className="mt-2 font-display text-5xl">{value}</div>
    </div>
  );
}

function value(input: string | string[] | undefined, fallback: string): string {
  return Array.isArray(input) ? input[0] ?? fallback : input ?? fallback;
}
