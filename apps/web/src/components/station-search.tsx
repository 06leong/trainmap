"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Station, Trip } from "@trainmap/domain";

export function StationSearch({ stations: allStations, trips }: { stations: Station[]; trips: Trip[] }) {
  const [query, setQuery] = useState("");
  const stations = useMemo(() => {
    const normalized = query.toLowerCase();
    return allStations.filter((station) => station.name.toLowerCase().includes(normalized));
  }, [allStations, query]);

  return (
    <section className="rounded-md border border-black/10 bg-white/72 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-black/10 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl text-ink">Station index</h2>
          <p className="text-sm text-black/58">Search stations and inspect footprint coverage by stop usage.</p>
        </div>
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-black/38" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-9 rounded-md border border-black/10 bg-[#f8f5ef] pl-9 pr-3 text-sm outline-none focus:border-ink"
            placeholder="Search stations"
          />
        </label>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {stations.map((station) => {
          const visits = trips.filter((trip) => trip.stops.some((stop) => stop.stationId === station.id)).length;
          return (
            <article key={station.id} className="rounded-md border border-black/10 bg-[#f8f5ef] p-4">
              <div className="font-medium text-ink">{station.name}</div>
              <div className="mt-1 text-sm text-black/58">{station.countryCode}</div>
              <div className="mt-4 text-xs uppercase text-black/45">Visits</div>
              <div className="mt-1 font-display text-3xl text-ink">{visits}</div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
