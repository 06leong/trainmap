import { calculateTripStats, type Trip } from "@trainmap/domain";
import { createExportConfig, type ExportConfig, type ExportLayout, type ExportPresetId, type ExportTheme } from "@trainmap/exporter";
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
      {!repository ? <DatabaseSetupNotice /> : null}
      {config.layout === "stats-only" ? (
        <StatsExport config={config} trips={trips} />
      ) : config.layout === "map-only" ? (
        <MapOnlyExport config={config} trips={trips} />
      ) : (
        <PosterExport config={config} trips={trips} />
      )}
    </div>
  );
}

function MapOnlyExport({ config, trips }: { config: ExportConfig; trips: Trip[] }) {
  const dark = config.theme === "dark";

  return (
    <div className="relative h-full">
      <TransportMap
        trips={trips}
        showControls={false}
        showCaption={false}
        initialBaseStyle={dark ? "dark" : "light"}
        frame="export"
        mapMode="export"
        heightClass="h-full"
      />
      <div
        className={
          dark
            ? "absolute left-14 top-14 max-w-3xl border border-white/18 bg-[#111827]/88 px-8 py-6 text-white backdrop-blur"
            : "absolute left-14 top-14 max-w-3xl border border-black/10 bg-[#f8f5ef]/88 px-8 py-6 text-ink backdrop-blur"
        }
      >
        <div className="text-sm uppercase opacity-55">trainmap route archive</div>
        <h1 className="mt-3 font-display text-6xl">{config.title}</h1>
        {config.subtitle ? <p className="mt-3 text-xl opacity-70">{config.subtitle}</p> : null}
      </div>
      {config.includeLegend ? <RouteLegend dark={dark} /> : null}
      {config.includeAttribution ? <ExportAttribution dark={dark} /> : null}
    </div>
  );
}

function PosterExport({ config, trips }: { config: ExportConfig; trips: Trip[] }) {
  const stats = calculateTripStats(trips);
  const dark = config.theme === "dark";

  return (
    <div className="h-full p-10">
      <div className="grid h-full grid-cols-[minmax(0,1.55fr)_minmax(420px,0.7fr)] gap-8">
        <div className={dark ? "border border-white/18" : "border border-black/10"}>
          <TransportMap
            trips={trips}
            showControls={false}
            showCaption={false}
            initialBaseStyle={dark ? "dark" : "light"}
            frame="export"
            mapMode="export"
            heightClass="h-full"
          />
        </div>
        <aside className={dark ? "flex flex-col justify-between border border-white/18 bg-[#111827] p-10" : "flex flex-col justify-between border border-black/10 bg-[#f8f5ef] p-10"}>
          <div>
            <div className="text-sm uppercase opacity-55">personal rail footprint</div>
            <h1 className="mt-5 font-display text-7xl leading-none">{config.title}</h1>
            {config.subtitle ? <p className="mt-6 text-2xl opacity-70">{config.subtitle}</p> : null}
          </div>
          <div className="grid gap-5">
            <PosterMetric label="Trips" value={String(stats.totalTrips)} />
            <PosterMetric label="Distance" value={`${stats.totalDistanceKm.toLocaleString()} km`} />
            <PosterMetric label="Countries" value={String(stats.countryCount)} />
            <PosterMetric label="Manual geometries" value={String(stats.confidence.manual)} />
          </div>
          <div className="space-y-5">
            {config.includeLegend ? <RouteLegend dark={dark} inline /> : null}
            {config.includeAttribution ? (
              <div className="text-xs leading-relaxed opacity-55">
                Basemap style compatible with OpenFreeMap, OpenMapTiles, and MapTiler. Routes, stations, labels, and coverage are trainmap business layers.
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatsExport({ config, trips }: { config: ExportConfig; trips: Trip[] }) {
  const stats = calculateTripStats(trips);
  const dark = config.theme === "dark";

  return (
    <div className="flex h-full flex-col justify-between p-14">
      <div>
        <div className="text-sm uppercase opacity-55">statistics export</div>
        <h1 className="mt-4 font-display text-7xl">{config.title}</h1>
        {config.subtitle ? <p className="mt-4 text-2xl opacity-70">{config.subtitle}</p> : null}
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

function RouteLegend({ dark, inline = false }: { dark: boolean; inline?: boolean }) {
  const content = (
    <>
      <LegendItem color="#0f766e" label="Exact" />
      <LegendItem color="#2563eb" label="Inferred" />
      <LegendItem color="#9f1239" label="Manual" />
    </>
  );

  if (inline) {
    return <div className="flex flex-wrap gap-4 text-xs uppercase tracking-wide opacity-75">{content}</div>;
  }

  return (
    <div
      className={
        dark
          ? "absolute bottom-14 left-14 flex gap-5 border border-white/18 bg-[#111827]/88 px-5 py-4 text-xs uppercase tracking-wide text-white backdrop-blur"
          : "absolute bottom-14 left-14 flex gap-5 border border-black/10 bg-[#f8f5ef]/88 px-5 py-4 text-xs uppercase tracking-wide text-ink backdrop-blur"
      }
    >
      {content}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="block h-1.5 w-8" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}

function ExportAttribution({ dark }: { dark: boolean }) {
  return (
    <div
      className={
        dark
          ? "absolute bottom-8 right-10 bg-[#111827]/80 px-3 py-2 text-xs text-white/58"
          : "absolute bottom-8 right-10 bg-[#f8f5ef]/80 px-3 py-2 text-xs text-black/55"
      }
    >
      OpenFreeMap / OpenMapTiles compatible basemap. Route data managed by trainmap.
    </div>
  );
}

function value(input: string | string[] | undefined, fallback: string): string {
  return Array.isArray(input) ? input[0] ?? fallback : input ?? fallback;
}
