"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Check, Search } from "lucide-react";
import type { TimetableProviderId, TimetableTripOption } from "@trainmap/timetable-adapters";
import { getTimetableAdapter, listTimetableProviders } from "@trainmap/timetable-adapters";

export function ScheduleAssistant() {
  const providers = useMemo(() => listTimetableProviders(), []);
  const [providerId, setProviderId] = useState<TimetableProviderId>("swiss_open_data");
  const [origin, setOrigin] = useState("Zurich HB");
  const [destination, setDestination] = useState("Milano Centrale");
  const [departureDate, setDepartureDate] = useState("2026-05-01");
  const [options, setOptions] = useState<TimetableTripOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const selectedProvider = providers.find((provider) => provider.id === providerId);

  async function searchTrips() {
    const adapter = getTimetableAdapter(providerId);
    setOptions(await adapter.searchTrips({ origin, destination, departureDate }));
    setSelectedOptionId(null);
  }

  return (
    <section className="rounded-md border border-black/10 bg-white/72 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-moss p-2 text-white">
          <CalendarClock className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-2xl text-ink">Schedule-assisted creation</h2>
          <p className="text-sm text-black/58">Provider adapters return normalized options and stop sequences behind a stable boundary.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm">
          <span className="text-black/54">Provider</span>
          <select
            value={providerId}
            onChange={(event) => setProviderId(event.target.value as TimetableProviderId)}
            className="mt-1 h-10 w-full rounded-md border border-black/10 bg-[#f8f5ef] px-3 outline-none focus:border-ink"
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-black/54">Origin</span>
          <input
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-black/10 bg-[#f8f5ef] px-3 outline-none focus:border-ink"
          />
        </label>
        <label className="text-sm">
          <span className="text-black/54">Destination</span>
          <input
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-black/10 bg-[#f8f5ef] px-3 outline-none focus:border-ink"
          />
        </label>
        <label className="text-sm">
          <span className="text-black/54">Date</span>
          <input
            type="date"
            value={departureDate}
            onChange={(event) => setDepartureDate(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-black/10 bg-[#f8f5ef] px-3 outline-none focus:border-ink"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-black/58">
          {selectedProvider?.region}. Stop sequence support: {selectedProvider?.capabilities.stopSequence ? "yes" : "no"}.
        </div>
        <button
          type="button"
          onClick={searchTrips}
          className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm text-white"
        >
          <Search className="h-4 w-4" />
          Query adapter
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSelectedOptionId(option.id)}
            className="flex w-full items-center justify-between gap-3 rounded-md border border-black/10 bg-[#f8f5ef] p-3 text-left transition hover:border-ink"
          >
            <div>
              <div className="font-medium text-ink">
                {option.trainCode} · {option.origin} to {option.destination}
              </div>
              <div className="mt-1 text-sm text-black/58">
                {option.departureAt} to {option.arrivalAt} · {option.stopCount} stops
              </div>
            </div>
            {selectedOptionId === option.id ? <Check className="h-5 w-5 text-moss" /> : null}
          </button>
        ))}
        {options.length === 0 ? (
          <div className="rounded-md border border-dashed border-black/20 bg-[#f8f5ef] p-4 text-sm text-black/58">
            Query a provider to preview schedule-assisted trip options. Generic GTFS exposes the same contract but needs a feed before trip search.
          </div>
        ) : null}
      </div>
    </section>
  );
}
