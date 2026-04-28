"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Accessibility, Baby, Bike, CircleHelp, TrainFront, Utensils } from "lucide-react";
import {
  parseSwissFormationShortString,
  type FormationStopSummary,
  type FormationVehicleSummary,
  type ParsedFormationShortString,
  type ParsedFormationVehicle,
  type SwissTrainFormationSummary
} from "@trainmap/timetable-adapters";
import type { TrainFormationRecord } from "@/lib/providers/swiss-formation";

export function TrainFormationPanel({ record }: { record: TrainFormationRecord }) {
  return (
    <section className="rounded-md border border-black/10 bg-white/72 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase text-black/45">Train Formation Service</div>
          <h2 className="mt-1 font-display text-2xl text-ink">Formation summary</h2>
        </div>
        <div className="rounded-full border border-black/10 bg-[#f8f5ef] px-3 py-1 text-xs text-black/58">
          {record.configured ? "configured" : "not configured"}
        </div>
      </div>

      {record.message ? <p className="mt-3 text-sm text-black/58">{record.message}</p> : null}

      <div className="mt-4 space-y-4">
        {record.summaries.map((summary) => (
          <FormationSummaryPanel key={`${summary.evu}-${summary.operationDate}-${summary.trainNumber}`} summary={summary} />
        ))}
      </div>
    </section>
  );
}

function FormationSummaryPanel({ summary }: { summary: SwissTrainFormationSummary }) {
  const stops = useMemo(() => normalizedStops(summary), [summary]);
  const [selectedStopIndex, setSelectedStopIndex] = useState(0);
  const selectedStop = stops[Math.min(selectedStopIndex, Math.max(0, stops.length - 1))];
  const parsedFormation = selectedStop?.parsedFormation ?? summary.parsedFormationStrings?.[0] ?? fallbackParsedFormations(summary)[0];

  return (
    <div className="rounded-md border border-black/10 bg-[#f8f5ef] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-ink">{summary.serviceLabel ?? `${summary.evu} ${summary.trainNumber}`}</div>
          <div className="mt-1 text-xs text-black/48">{summary.endpoint}</div>
        </div>
        <div className="rounded-full border border-black/10 bg-white px-2 py-1 text-xs text-black/58">{summary.status}</div>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-black/62 sm:grid-cols-3 lg:grid-cols-6">
        <SmallMetric label="EVU" value={summary.evu} />
        <SmallMetric label="Train" value={summary.trainNumber} />
        <SmallMetric label="Date" value={summary.operationDate} />
        <SmallMetric label="Stops" value={String(summary.stopCount ?? (stops.length || "-"))} />
        <SmallMetric label="Vehicles" value={String(summary.vehicleCount ?? summary.vehicles?.length ?? "-")} />
        <SmallMetric label="Seats" value={String(summary.meta?.seatCount ?? "-")} />
      </div>

      {stops.length > 0 ? (
        <label className="mt-4 block text-sm">
          <span className="text-black/54">Formation at stop</span>
          <select
            value={selectedStopIndex}
            onChange={(event) => setSelectedStopIndex(Number(event.target.value))}
            className="mt-1 h-10 w-full rounded-md border border-black/10 bg-white px-3 outline-none focus:border-ink"
          >
            {stops.map((stop, index) => (
              <option key={`${stop.name ?? "stop"}-${index}`} value={index}>
                {stopLabel(stop, index)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {parsedFormation ? <FormationDiagram parsed={parsedFormation} /> : null}
      {summary.vehicles?.length ? <VehicleTable vehicles={summary.vehicles} /> : null}

      {summary.message ? <p className="mt-3 text-xs text-black/50">{summary.message}</p> : null}
      <RawFormationStrings strings={rawStrings(summary)} />
    </div>
  );
}

function FormationDiagram({ parsed }: { parsed: ParsedFormationShortString }) {
  const sectors = parsed.sectors.length > 0 ? parsed.sectors : [{ name: "Train", vehicles: parsed.vehicles }];
  return (
    <div className="mt-4 space-y-3">
      <div className="text-xs uppercase text-black/45">Platform sectors and vehicles</div>
      {sectors.map((sector) => (
        <div key={sector.name} className="grid gap-2 md:grid-cols-[56px_1fr]">
          <div className="flex h-9 items-center justify-center rounded border border-black/10 bg-white font-medium text-ink">
            {sector.name}
          </div>
          <div className="flex flex-wrap gap-2">
            {sector.vehicles.map((vehicle) => (
              <VehiclePill key={`${sector.name}-${vehicle.index}`} vehicle={vehicle} />
            ))}
          </div>
        </div>
      ))}
      {parsed.unknownTokens.length > 0 ? (
        <div className="flex items-center gap-2 text-xs text-black/45">
          <CircleHelp className="h-3.5 w-3.5" />
          Unknown tokens preserved: {parsed.unknownTokens.join(", ")}
        </div>
      ) : null}
    </div>
  );
}

function VehiclePill({ vehicle }: { vehicle: ParsedFormationVehicle }) {
  const visibleServices = vehicle.services.slice(0, 4);
  return (
    <div
      title={vehicle.typeLabel}
      className={[
        "min-w-[82px] rounded-md border px-2 py-1 text-xs shadow-sm",
        vehicle.typeCode === "F" ? "border-black/5 bg-black/[0.04] text-black/35" : "border-black/10 bg-white text-ink",
        vehicle.inTrainGroup ? "ring-1 ring-moss/30" : ""
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{vehicle.displayNumber ? `${vehicle.typeCode}:${vehicle.displayNumber}` : vehicle.typeCode ?? "?"}</span>
        <span className="text-black/38">#{vehicle.index}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {vehicle.groupStart ? <Badge label="start" /> : null}
        {vehicle.groupEnd ? <Badge label="end" /> : null}
        {!vehicle.accessToPrevious || !vehicle.accessToNext ? <Badge label="no pass" /> : null}
        {vehicle.statuses.map((status) => (
          <Badge key={status.code} label={status.label} />
        ))}
        {visibleServices.map((service) => (
          <ServiceBadge key={`${service.code}-${service.quantity ?? "n"}`} code={service.code} label={service.label} quantity={service.quantity} />
        ))}
      </div>
    </div>
  );
}

function VehicleTable({ vehicles }: { vehicles: FormationVehicleSummary[] }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <div className="mb-2 text-xs uppercase text-black/45">Vehicle details</div>
      <table className="min-w-full text-left text-xs">
        <thead className="text-black/45">
          <tr className="border-b border-black/10">
            <th className="py-2 pr-3 font-medium">Pos</th>
            <th className="py-2 pr-3 font-medium">No.</th>
            <th className="py-2 pr-3 font-medium">Type</th>
            <th className="py-2 pr-3 font-medium">From / to</th>
            <th className="py-2 pr-3 font-medium">Capacity</th>
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

function normalizedStops(summary: SwissTrainFormationSummary): FormationStopSummary[] {
  if (summary.stops?.length) {
    return summary.stops;
  }
  return fallbackParsedFormations(summary).map((parsedFormation, index) => ({
    sequence: index + 1,
    name: `Sample ${index + 1}`,
    parsedFormation,
    formationString: parsedFormation.raw,
    vehicleGoals: []
  }));
}

function fallbackParsedFormations(summary: SwissTrainFormationSummary): ParsedFormationShortString[] {
  if (summary.parsedFormationStrings?.length) {
    return summary.parsedFormationStrings;
  }
  return rawStrings(summary).map(parseSwissFormationShortString);
}

function rawStrings(summary: SwissTrainFormationSummary): string[] {
  return summary.rawFormationStrings?.length ? summary.rawFormationStrings : summary.formationStrings ?? [];
}

function stopLabel(stop: FormationStopSummary, index: number): string {
  return [String(index + 1), stop.name ?? "Unknown stop", stop.track ? `track ${stop.track}` : undefined].filter(Boolean).join(" · ");
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-black/40">{label}</div>
      <div className="mt-1 font-medium text-ink">{value}</div>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return <span className="rounded border border-black/10 bg-[#f8f5ef] px-1 text-[10px] text-black/52">{label}</span>;
}

function ServiceBadge({ code, label, quantity }: { code: string; label: string; quantity?: number }) {
  return (
    <span title={label} className="rounded border border-moss/20 bg-moss/5 px-1 text-[10px] text-moss">
      {quantity ? `${quantity} ` : ""}
      {code}
    </span>
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
