"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Accessibility, Baby, Bike, Briefcase, CircleHelp, RefreshCw, TrainFront, Utensils } from "lucide-react";
import type { TripStop } from "@trainmap/domain";
import type { FormationVehicleSummary, SwissTrainFormationSummary } from "@trainmap/timetable-adapters";
import {
  buildFormationViewModel,
  stopLabel,
  type FormationCoachView,
  type FormationLegendItem,
  type FormationServiceView,
  type FormationViewModel
} from "@/lib/formation-view-model";
import { normalizeStoredTrainFormation, type TrainFormationRecord } from "@/lib/formation-record";

export function TrainFormationPanel({
  record,
  referenceStops = [],
  refreshAction
}: {
  record: TrainFormationRecord;
  referenceStops?: TripStop[];
  refreshAction?: (formData: FormData) => Promise<void>;
}) {
  const normalizedRecord = useMemo(() => normalizeStoredTrainFormation(record, referenceStops) ?? record, [record, referenceStops]);

  return (
    <section className="rounded-md border border-black/10 bg-white/72 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase text-black/45">Train Formation Service</div>
          <h2 className="mt-1 font-display text-2xl text-ink">Formation summary</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-black/10 bg-[#f8f5ef] px-3 py-1 text-xs text-black/58">
            {normalizedRecord.configured ? "configured" : "not configured"}
          </div>
          <div className="rounded-full border border-black/10 bg-[#f8f5ef] px-3 py-1 text-xs text-black/58">
            {normalizedRecord.archived ? "archived" : "live only"}
          </div>
          {refreshAction ? (
            <form action={refreshAction}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-xs text-white">
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh today's formation
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {normalizedRecord.message ? <p className="mt-3 text-sm text-black/58">{normalizedRecord.message}</p> : null}

      <div className="mt-4 space-y-4">
        {normalizedRecord.summaries.map((summary) => (
          <FormationSummaryPanel key={`${summary.evu}-${summary.operationDate}-${summary.trainNumber}`} summary={summary} referenceStops={referenceStops} />
        ))}
      </div>
    </section>
  );
}

function FormationSummaryPanel({ summary, referenceStops }: { summary: SwissTrainFormationSummary; referenceStops: TripStop[] }) {
  const [selectedStopIndex, setSelectedStopIndex] = useState(0);
  const viewModel = useMemo(() => buildFormationViewModel(summary, referenceStops, selectedStopIndex), [referenceStops, selectedStopIndex, summary]);

  return (
    <div className="overflow-hidden rounded-md border border-black/10 bg-[#f8f5ef]">
      <div className="border-b border-black/10 bg-white/82 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase text-black/45">
              <span>{summary.evu}</span>
              <span>{summary.operationDate}</span>
              <span>{summary.status}</span>
            </div>
            <h3 className="mt-2 font-display text-3xl text-ink">{viewModel.title}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-black/62">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-black/10 bg-[#f8f5ef] px-2 py-1 font-medium text-ink">
                <TrainFront className="h-4 w-4" />
                {viewModel.serviceLabel}
              </span>
              <span>Direction {viewModel.directionLabel.split(" -> ").at(-1) ?? "destination"}</span>
            </div>
          </div>
          <div className="rounded-full border border-black/10 bg-[#f8f5ef] px-3 py-1 text-xs text-black/58">{summary.status}</div>
        </div>
        {summary.endpoint ? (
          <details className="mt-3 text-xs text-black/48">
            <summary className="cursor-pointer">Request endpoint</summary>
            <div className="mt-1 break-all font-mono">{summary.endpoint}</div>
          </details>
        ) : null}
      </div>

      <div className="p-5">
        <div className="grid gap-3 text-sm text-black/62 sm:grid-cols-3 lg:grid-cols-6">
          {viewModel.metrics.map((metric) => (
            <SmallMetric key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>

        {viewModel.stops.length > 0 ? (
          <label className="mt-5 block text-sm">
            <span className="text-black/54">Formation at stop</span>
            <select
              value={selectedStopIndex}
              onChange={(event) => setSelectedStopIndex(Number(event.target.value))}
              className="mt-1 h-10 w-full rounded-md border border-black/10 bg-white px-3 outline-none focus:border-ink"
            >
              {viewModel.stops.map((stop, index) => (
                <option key={`${stop.name ?? "stop"}-${index}`} value={index}>
                  {stopLabel(stop, index)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <PassengerFormationView viewModel={viewModel} />
        {summary.message ? <p className="mt-3 text-xs text-black/50">{summary.message}</p> : null}
      </div>
    </div>
  );
}

function PassengerFormationView({ viewModel }: { viewModel: FormationViewModel }) {
  if (viewModel.coaches.length === 0) {
    return (
      <div className="mt-5 rounded-md border border-dashed border-black/20 bg-white p-4 text-sm text-black/58">
        No passenger coach layout is available for this stop. Saved raw Formation data is still available in diagnostics.
        <DiagnosticsPanel diagnostics={viewModel.diagnostics} />
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="rounded-md border border-black/10 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-3">
          <div>
            <div className="text-xs uppercase text-black/45">Platform sectors and vehicles</div>
            <div className="mt-1 text-sm text-black/62">{stopLabel(viewModel.selectedStop, viewModel.selectedStop.sequence - 1)}</div>
          </div>
          <div className="text-sm text-black/58">Direction of travel: {viewModel.directionLabel.split(" -> ").at(-1)}</div>
        </div>

        <div className="mt-4 space-y-5">
          {viewModel.sectorGroups.map((sectorGroup) => (
            <div key={sectorGroup.sector}>
              <div className="mb-2 flex items-center gap-3">
                <div className="h-px flex-1 bg-black/12" />
                <div className="rounded-full border border-black/10 bg-[#f8f5ef] px-3 py-1 text-xs uppercase text-black/58">
                  Sector {sectorGroup.sector}
                </div>
                <div className="h-px flex-1 bg-black/12" />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {sectorGroup.coaches.map((coach) => (
                  <CoachCard key={coach.key} coach={coach} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <DiagnosticsPanel diagnostics={viewModel.diagnostics} />
      </div>

      <PassengerLegend items={viewModel.legendItems} />
    </div>
  );
}

function CoachCard({ coach }: { coach: FormationCoachView }) {
  return (
    <div className="min-w-[118px]">
      <div className="mb-1 text-center text-xs text-black/48">{coach.coachNumber}</div>
      <div
        className={[
          "rounded-xl border px-3 py-2 shadow-sm",
          coach.isClosed ? "border-black/10 bg-black/[0.04] text-black/42" : "border-ink bg-[#fffdf8] text-ink",
          coach.noPassageBefore || coach.noPassageAfter ? "ring-1 ring-rail/15" : ""
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase text-black/42">Coach</div>
            <div className="text-xl font-semibold leading-none">{coach.coachNumber}</div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/12 bg-white text-lg font-semibold">
            {coach.classLabel}
          </div>
        </div>
        <div className="mt-2 truncate text-xs text-black/54" title={coach.typeLabel}>
          {coach.typeLabel}
        </div>
        <div className="mt-2 flex min-h-5 flex-wrap gap-1">
          {coach.services.slice(0, 5).map((service) => (
            <ServiceIcon key={service.key} service={service} />
          ))}
          {coach.noPassageBefore || coach.noPassageAfter ? <span className="rounded bg-rail/10 px-1.5 py-0.5 text-[10px] text-rail">no pass</span> : null}
        </div>
      </div>
    </div>
  );
}

function PassengerLegend({ items }: { items: FormationLegendItem[] }) {
  return (
    <aside className="rounded-md border border-black/10 bg-white p-4">
      <div className="font-medium text-ink">Legend</div>
      <div className="mt-4 space-y-3 text-sm text-black/62">
        {items.map((item) => (
          <div key={`${item.label}-${item.detail}`} className="grid grid-cols-[32px_1fr] gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded border border-black/10 bg-[#f8f5ef] text-xs font-semibold text-ink">
              {item.icon ? <ServiceIcon service={{ key: item.label, icon: item.icon, label: item.detail }} labelOnly /> : item.label}
            </div>
            <div>
              <div className="font-medium text-ink">{item.label}</div>
              <div className="text-xs text-black/50">{item.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function DiagnosticsPanel({ diagnostics }: { diagnostics: FormationViewModel["diagnostics"] }) {
  return (
    <details className="mt-5 rounded-md border border-black/10 bg-[#f8f5ef] px-3 py-2">
      <summary className="cursor-pointer text-xs uppercase text-black/45">Technical diagnostics</summary>
      <div className="mt-3 space-y-4">
        <div className="grid gap-2 text-xs text-black/55 sm:grid-cols-3">
          <SmallMetric label="Hidden internal vehicles" value={String(diagnostics.hiddenVehicleCount)} />
          <SmallMetric label="Unknown tokens" value={diagnostics.unknownTokens.length ? diagnostics.unknownTokens.join(", ") : "-"} />
          <SmallMetric label="Raw samples" value={String(diagnostics.rawStrings.length)} />
        </div>
        <VehicleTable vehicles={diagnostics.vehicles} />
        <RawFormationStrings strings={diagnostics.rawStrings} />
      </div>
    </details>
  );
}

function ServiceIcon({
  service,
  labelOnly = false
}: {
  service: FormationServiceView;
  labelOnly?: boolean;
}) {
  const icon = iconForService(service.icon);
  if (labelOnly) {
    return icon;
  }
  return (
    <span title={service.label} className="inline-flex items-center gap-1 rounded border border-black/10 bg-white px-1.5 py-0.5 text-[10px] text-black/58">
      {icon}
      {service.quantity ? <span>{service.quantity}</span> : null}
    </span>
  );
}

function iconForService(icon: FormationServiceView["icon"]) {
  if (icon === "wheelchair" || icon === "lowFloor") {
    return <Accessibility className="h-3.5 w-3.5" />;
  }
  if (icon === "bike" || icon === "reservation") {
    return <Bike className="h-3.5 w-3.5" />;
  }
  if (icon === "stroller" || icon === "family") {
    return <Baby className="h-3.5 w-3.5" />;
  }
  if (icon === "restaurant") {
    return <Utensils className="h-3.5 w-3.5" />;
  }
  if (icon === "business") {
    return <Briefcase className="h-3.5 w-3.5" />;
  }
  return <CircleHelp className="h-3.5 w-3.5" />;
}

function VehicleTable({ vehicles }: { vehicles: FormationVehicleSummary[] }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <div className="mb-2 text-xs uppercase text-black/45">Vehicle details</div>
      <table className="min-w-full text-left text-xs">
        <thead className="text-black/45">
          <tr className="border-b border-black/10">
            <th className="py-2 pr-3 font-medium">Pos</th>
            <th className="py-2 pr-3 font-medium">Coach no.</th>
            <th className="py-2 pr-3 font-medium">Type</th>
            <th className="py-2 pr-3 font-medium">From / to</th>
            <th className="py-2 pr-3 font-medium">Seats</th>
            <th className="py-2 pr-3 font-medium">Features</th>
            <th className="py-2 pr-3 font-medium">Sectors</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((vehicle, index) => (
            <tr key={`${vehicle.evn ?? vehicle.position ?? index}`} className="border-b border-black/5 align-top">
              <td className="py-2 pr-3 text-black/60">{vehicle.position ?? "-"}</td>
              <td className="py-2 pr-3 font-medium text-ink">{vehicle.displayNumber && vehicle.displayNumber !== "0" ? vehicle.displayNumber : "-"}</td>
              <td className="py-2 pr-3">
                <div className="font-medium text-ink">{vehicle.typeCodeName ?? vehicle.typeCode ?? "Unknown"}</div>
                <div className="font-mono text-[11px] text-black/42">{vehicle.evn || vehicle.parentEvn || ""}</div>
              </td>
              <td className="py-2 pr-3 text-black/58">
                {[vehicle.fromStopName, vehicle.toStopName].filter(Boolean).join(" -> ") || "-"}
              </td>
              <td className="py-2 pr-3 text-black/58">
                {[
                  vehicle.firstClassSeats ? `1st ${vehicle.firstClassSeats}` : "",
                  vehicle.secondClassSeats ? `2nd ${vehicle.secondClassSeats}` : ""
                ]
                  .filter(Boolean)
                  .join(", ") || "-"}
              </td>
              <td className="py-2 pr-3">
                <div className="flex flex-wrap gap-1 text-black/58">
                  {vehicle.lowFloor ? <IconBadge icon={<Accessibility className="h-3 w-3" />} label="low floor" /> : null}
                  {vehicle.wheelchairSpaces ? <IconBadge icon={<Accessibility className="h-3 w-3" />} label={`${vehicle.wheelchairSpaces} wheelchair`} /> : null}
                  {vehicle.bikeHooks ? <IconBadge icon={<Bike className="h-3 w-3" />} label={`${vehicle.bikeHooks} bike`} /> : null}
                  {vehicle.strollerPlatform ? <IconBadge icon={<Baby className="h-3 w-3" />} label="stroller" /> : null}
                  {vehicle.familyZone ? <IconBadge icon={<Baby className="h-3 w-3" />} label="family" /> : null}
                  {vehicle.businessZone ? <IconBadge icon={<TrainFront className="h-3 w-3" />} label="business" /> : null}
                  {vehicle.trolleyStatus?.includes("Restaurant") ? <IconBadge icon={<Utensils className="h-3 w-3" />} label={vehicle.trolleyStatus} /> : null}
                </div>
              </td>
              <td className="py-2 pr-3 text-black/58">
                {vehicle.sectorsByStop
                  .map((stop) => [stop.stopName, stop.sectors].filter(Boolean).join(" "))
                  .filter(Boolean)
                  .slice(0, 3)
                  .join("; ") || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RawFormationStrings({ strings }: { strings: string[] }) {
  if (strings.length === 0) {
    return null;
  }

  return (
    <details className="mt-4 rounded-md border border-black/10 bg-white px-3 py-2">
      <summary className="cursor-pointer text-xs uppercase text-black/45">Raw CUS strings</summary>
      <div className="mt-2 space-y-1">
        {strings.map((formation, index) => (
          <div key={`${formation}-${index}`} className="break-all rounded bg-[#f8f5ef] px-2 py-1 font-mono text-[11px] text-black/58">
            {formation}
          </div>
        ))}
      </div>
    </details>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-black/40">{label}</div>
      <div className="mt-1 font-medium text-ink">{value}</div>
    </div>
  );
}

function IconBadge({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-black/10 bg-white px-1.5 py-0.5">
      {icon}
      {label}
    </span>
  );
}
