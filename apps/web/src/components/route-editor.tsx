"use client";

import { useMemo, useState } from "react";
import { GitBranchPlus, MapPinned, Minus, Plus } from "lucide-react";
import type { ManualViaPoint, Trip, TripStop } from "@trainmap/domain";
import { regenerateRouteGeometry } from "@trainmap/geo";
import { TransportMap } from "@/components/transport-map";

export function RouteEditor({
  trip,
  repairAction
}: {
  trip: Trip;
  repairAction: (formData: FormData) => Promise<void>;
}) {
  const [stops, setStops] = useState<TripStop[]>(trip.stops);
  const [manualVias, setManualVias] = useState<ManualViaPoint[]>(trip.geometry?.manualViaPoints ?? []);
  const editedTrip = useMemo<Trip>(() => ({ ...trip, stops }), [stops, trip]);
  const generatedGeometry = useMemo(() => regenerateRouteGeometry(editedTrip, manualVias), [editedTrip, manualVias]);
  const previewTrip = useMemo<Trip>(
    () => ({
      ...editedTrip,
      geometry: generatedGeometry
    }),
    [editedTrip, generatedGeometry]
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <form action={repairAction} className="rounded-md border border-black/10 bg-white/72 p-4 shadow-sm">
        <input type="hidden" name="stopsJson" value={JSON.stringify(stops)} />
        <input type="hidden" name="manualViasJson" value={JSON.stringify(manualVias)} />
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-rail p-2 text-white">
            <GitBranchPlus className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-2xl text-ink">Manual route repair</h2>
            <p className="text-sm text-black/58">Edit the stop backbone, add vias, regenerate geometry, then save as a new version.</p>
          </div>
        </div>

        <div className="mt-5">
          <div className="text-xs uppercase text-black/45">Stop sequence</div>
          <div className="mt-2 space-y-2">
            {stops.map((stop, index) => (
              <div key={stop.id} className="flex items-center gap-2 rounded-md border border-black/10 bg-[#f8f5ef] p-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs text-white">
                  {index + 1}
                </span>
                <span className="flex-1 text-sm text-ink">{stop.stationName}</span>
                <button
                  type="button"
                  className="rounded border border-black/10 px-2 py-1 text-xs disabled:opacity-30"
                  disabled={index === 0}
                  onClick={() => setStops(moveStop(stops, index, index - 1))}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="rounded border border-black/10 px-2 py-1 text-xs disabled:opacity-30"
                  disabled={index === stops.length - 1}
                  onClick={() => setStops(moveStop(stops, index, index + 1))}
                >
                  Down
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase text-black/45">Manual vias</div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-ink px-3 py-2 text-xs text-white"
              onClick={() =>
                setManualVias((current) => [
                  ...current,
                  {
                    id: crypto.randomUUID(),
                    label: `Via ${current.length + 1}`,
                    coordinates: midpoint(stops),
                    sequence: 2
                  }
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Add via
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {manualVias.map((via) => (
              <div key={via.id} className="grid gap-2 rounded-md border border-black/10 bg-[#f8f5ef] p-2 md:grid-cols-[1fr_1fr_auto]">
                <input
                  value={via.label}
                  onChange={(event) =>
                    setManualVias((current) =>
                      current.map((candidate) => (candidate.id === via.id ? { ...candidate, label: event.target.value } : candidate))
                    )
                  }
                  className="rounded border border-black/10 bg-white px-2 py-1 text-sm outline-none focus:border-ink"
                />
                <input
                  value={via.coordinates.join(", ")}
                  onChange={(event) => {
                    const [longitude, latitude] = event.target.value.split(",").map((value) => Number(value.trim()));
                    if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
                      setManualVias((current) =>
                        current.map((candidate) =>
                          candidate.id === via.id ? { ...candidate, coordinates: [longitude, latitude] } : candidate
                        )
                      );
                    }
                  }}
                  className="rounded border border-black/10 bg-white px-2 py-1 text-sm outline-none focus:border-ink"
                />
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded border border-black/10 px-2 text-sm"
                  onClick={() => setManualVias((current) => current.filter((candidate) => candidate.id !== via.id))}
                >
                  <Minus className="h-4 w-4" />
                </button>
              </div>
            ))}
            {manualVias.length === 0 ? (
              <div className="rounded-md border border-dashed border-black/20 bg-[#f8f5ef] p-4 text-sm text-black/58">
                No manual vias yet. Add one when inferred geometry needs a specific pass-through point.
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 rounded-md border border-black/10 bg-[#111827] p-4 text-white">
          <div className="flex items-center gap-2 text-sm">
            <MapPinned className="h-4 w-4" />
            New geometry version preview
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-white/48">Version</div>
              <div className="font-display text-2xl">{generatedGeometry.version}</div>
            </div>
            <div>
              <div className="text-white/48">Confidence</div>
              <div className="font-display text-2xl capitalize">{generatedGeometry.confidence}</div>
            </div>
            <div>
              <div className="text-white/48">Points</div>
              <div className="font-display text-2xl">{generatedGeometry.geometry.coordinates.length}</div>
            </div>
          </div>
        </div>
        <button type="submit" className="mt-5 rounded-md bg-rail px-4 py-2.5 text-sm text-white">
          Save geometry version
        </button>
      </form>
      <TransportMap trips={[previewTrip]} heightClass="h-[680px]" />
    </div>
  );
}

function moveStop(stops: TripStop[], from: number, to: number): TripStop[] {
  const next = [...stops];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next.map((stop, index) => ({ ...stop, sequence: index + 1 }));
}

function midpoint(stops: TripStop[]): [number, number] {
  const first = stops[0]?.coordinates ?? [8, 47];
  const last = stops[stops.length - 1]?.coordinates ?? [9, 46];
  return [Number(((first[0] + last[0]) / 2).toFixed(4)), Number(((first[1] + last[1]) / 2).toFixed(4))];
}
