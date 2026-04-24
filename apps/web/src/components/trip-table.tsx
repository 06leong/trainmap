"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Search } from "lucide-react";
import type { Trip } from "@trainmap/domain";
import { filterTrips } from "@trainmap/domain";
import { StatusPill } from "@/components/status-pill";

export function TripTable({ trips }: { trips: Trip[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | Trip["status"]>("all");
  const filteredTrips = useMemo(
    () => filterTrips(trips, { query, status: status === "all" ? undefined : status }),
    [query, status, trips]
  );

  return (
    <section className="rounded-md border border-black/10 bg-white/72 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-black/10 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl text-ink">Trips</h2>
          <p className="mt-1 text-sm text-black/58">Search, sort, filter, and select routes for bulk export or review.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-black/38" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 rounded-md border border-black/10 bg-[#f8f5ef] pl-9 pr-3 text-sm outline-none focus:border-ink"
              placeholder="Search trips"
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="h-9 rounded-md border border-black/10 bg-[#f8f5ef] px-3 text-sm outline-none focus:border-ink"
          >
            <option value="all">All status</option>
            <option value="completed">Completed</option>
            <option value="planned">Planned</option>
            <option value="needs_review">Needs review</option>
          </select>
        </div>
      </div>
      <div className="selection-panel overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse text-left text-sm">
          <thead className="bg-[#f8f5ef] text-xs uppercase text-black/48">
            <tr>
              <th className="px-4 py-3 font-medium">
                <span className="inline-flex items-center gap-2">
                  Trip <ArrowUpDown className="h-3.5 w-3.5" />
                </span>
              </th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Operator</th>
              <th className="px-4 py-3 font-medium">Distance</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Geometry</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrips.map((trip) => (
              <tr key={trip.id} className="border-t border-black/10">
                <td className="px-4 py-3">
                  <Link href={`/trips/${trip.id}`} className="font-medium text-ink hover:underline">
                    {trip.title}
                  </Link>
                  <div className="mt-1 text-xs text-black/48">{trip.trainCode ?? "Manual trip"}</div>
                </td>
                <td className="px-4 py-3 text-black/62">{trip.date}</td>
                <td className="px-4 py-3 text-black/62">{trip.operatorName}</td>
                <td className="px-4 py-3 text-black/62">{trip.distanceKm.toLocaleString()} km</td>
                <td className="px-4 py-3">
                  <StatusPill value={trip.status} />
                </td>
                <td className="px-4 py-3">
                  <StatusPill value={trip.geometry?.confidence ?? "inferred"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
