#!/usr/bin/env node

const apiKey = process.env.SWISS_OPEN_DATA_API_KEY?.trim();

if (!apiKey) {
  console.error("SWISS_OPEN_DATA_API_KEY is required. Use the API Manager TOKEN value, not TOKEN HASH.");
  process.exit(1);
}

const originQuery = process.env.SWISS_OPEN_DATA_SMOKE_ORIGIN ?? "Zürich HB";
const destinationQuery = process.env.SWISS_OPEN_DATA_SMOKE_DESTINATION ?? "Milano Centrale";
const departureAt = process.env.SWISS_OPEN_DATA_SMOKE_DEPARTURE_AT ?? "2026-05-01T09:00:00";

const { createSwissOpenDataAdapter, listTimetableProviders } = await import("../packages/timetable-adapters/dist/index.js").catch(
  () => {
    console.error("Could not load built timetable adapters. Run `npm run build --workspace @trainmap/timetable-adapters` first.");
    process.exit(1);
  }
);

const metadata = listTimetableProviders().find((provider) => provider.id === "swiss_open_data");

if (!metadata) {
  console.error("Swiss Open Data provider metadata is not registered.");
  process.exit(1);
}

const adapter = createSwissOpenDataAdapter(metadata, {
  apiKey,
  endpoint: process.env.SWISS_OPEN_DATA_OJP_ENDPOINT,
  requestorRef: process.env.SWISS_OPEN_DATA_REQUESTOR_REF ?? "trainmap_smoke_test",
  userAgent: process.env.SWISS_OPEN_DATA_USER_AGENT ?? "trainmap/0.1"
});

console.log(`Testing station search: ${originQuery}`);
const originStations = await adapter.searchStations(originQuery);
console.log(`Origin candidates: ${originStations.length}`);

console.log(`Testing station search: ${destinationQuery}`);
const destinationStations = await adapter.searchStations(destinationQuery);
console.log(`Destination candidates: ${destinationStations.length}`);

const origin = selectStation(originStations, originQuery);
const destination = selectStation(destinationStations, destinationQuery);

if (!origin || !destination?.coordinates || !origin.coordinates) {
  console.error("Station smoke failed: origin or destination did not return coordinates.");
  process.exit(1);
}

console.log(`Testing trip search: ${origin.name} (${origin.id}) to ${destination.name} (${destination.id}) at ${departureAt}`);
const options = await adapter.searchRoute({
  origin: {
    id: origin.id,
    name: origin.name,
    coordinates: origin.coordinates
  },
  destination: {
    id: destination.id,
    name: destination.name,
    coordinates: destination.coordinates
  },
  departureAt,
  numberOfResults: 3
});

console.log(`Trip options: ${options.length}`);

if (options.length === 0) {
  console.error("Trip smoke failed: OJP returned no trip options.");
  process.exit(1);
}

const first = options[0];
console.log(
  `First option: ${first.trainCode}, ${first.origin} -> ${first.destination}, ${first.stopCount} stops, ${
    first.geometry?.coordinates.length ?? 0
  } geometry points`
);

function selectStation(stations, query) {
  const normalizedQuery = normalize(query);
  return (
    stations.find((station) => normalize(station.name) === normalizedQuery && station.coordinates) ??
    stations.find((station) => station.coordinates)
  );
}

function normalize(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
