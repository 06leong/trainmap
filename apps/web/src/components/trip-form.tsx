import { createTripAction } from "@/lib/actions/trips";

export function TripForm() {
  return (
    <form action={createTripAction} className="rounded-md border border-black/10 bg-white/72 p-4 shadow-sm">
      <h2 className="font-display text-2xl text-ink">Manual trip draft</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Input name="title" label="Title" defaultValue="Zurich to Milano" />
        <Input name="date" label="Date" type="date" defaultValue="2026-05-01" />
        <Input name="operatorName" label="Operator" defaultValue="SBB" />
        <Input name="trainCode" label="Train code" defaultValue="EC 317" />
        <Input name="distanceKm" label="Distance km" type="number" defaultValue="280" />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <StationFields prefix="origin" label="Origin" defaultName="Zurich HB" defaultCountry="CH" defaultLongitude="8.5402" defaultLatitude="47.3782" />
        <StationFields
          prefix="destination"
          label="Destination"
          defaultName="Milano Centrale"
          defaultCountry="IT"
          defaultLongitude="9.2042"
          defaultLatitude="45.4864"
        />
      </div>
      <button type="submit" className="mt-5 rounded-md bg-ink px-4 py-2.5 text-sm text-white">
        Create trip
      </button>
    </form>
  );
}

export function TripEditForm({
  tripId,
  title,
  date,
  operatorName,
  trainCode,
  distanceKm,
  status,
  serviceClass,
  action
}: {
  tripId: string;
  title: string;
  date: string;
  operatorName: string;
  trainCode?: string;
  distanceKm: number;
  status: string;
  serviceClass: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="rounded-md border border-black/10 bg-white/72 p-4 shadow-sm">
      <input type="hidden" name="tripId" value={tripId} />
      <h2 className="font-display text-2xl text-ink">Edit trip</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Input name="title" label="Title" defaultValue={title} />
        <Input name="date" label="Date" type="date" defaultValue={date} />
        <Input name="operatorName" label="Operator" defaultValue={operatorName} />
        <Input name="trainCode" label="Train code" defaultValue={trainCode ?? ""} />
        <Input name="distanceKm" label="Distance km" type="number" defaultValue={String(distanceKm)} />
        <label className="text-sm">
          <span className="text-black/54">Status</span>
          <select name="status" defaultValue={status} className="mt-1 h-10 w-full rounded-md border border-black/10 bg-[#f8f5ef] px-3 outline-none focus:border-ink">
            <option value="completed">Completed</option>
            <option value="planned">Planned</option>
            <option value="needs_review">Needs review</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-black/54">Class</span>
          <select name="serviceClass" defaultValue={serviceClass} className="mt-1 h-10 w-full rounded-md border border-black/10 bg-[#f8f5ef] px-3 outline-none focus:border-ink">
            <option value="second">Second</option>
            <option value="first">First</option>
            <option value="sleeper">Sleeper</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>
      </div>
      <button type="submit" className="mt-5 rounded-md bg-ink px-4 py-2.5 text-sm text-white">
        Save trip
      </button>
    </form>
  );
}

function StationFields({
  prefix,
  label,
  defaultName,
  defaultCountry,
  defaultLongitude,
  defaultLatitude
}: {
  prefix: "origin" | "destination";
  label: string;
  defaultName: string;
  defaultCountry: string;
  defaultLongitude: string;
  defaultLatitude: string;
}) {
  return (
    <fieldset className="rounded-md border border-black/10 bg-[#f8f5ef] p-3">
      <legend className="px-1 text-sm text-black/54">{label}</legend>
      <div className="grid gap-3 md:grid-cols-2">
        <Input name={`${prefix}Name`} label="Station" defaultValue={defaultName} />
        <Input name={`${prefix}CountryCode`} label="Country" defaultValue={defaultCountry} />
        <Input name={`${prefix}Longitude`} label="Longitude" type="number" defaultValue={defaultLongitude} step="0.0001" />
        <Input name={`${prefix}Latitude`} label="Latitude" type="number" defaultValue={defaultLatitude} step="0.0001" />
      </div>
    </fieldset>
  );
}

function Input({
  name,
  label,
  type = "text",
  defaultValue,
  step
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  step?: string;
}) {
  return (
    <label className="text-sm">
      <span className="text-black/54">{label}</span>
      <input
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        className="mt-1 h-10 w-full rounded-md border border-black/10 bg-[#f8f5ef] px-3 outline-none focus:border-ink"
      />
    </label>
  );
}
