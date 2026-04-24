import type { Journey, Operator, Station, Tag, Trip } from "./types";

const now = "2026-04-24T00:00:00.000Z";

export const demoStations: Station[] = [
  {
    id: "station-paris-lyon",
    name: "Paris Gare de Lyon",
    countryCode: "FR",
    coordinates: [2.373, 48.844],
    timezone: "Europe/Paris"
  },
  {
    id: "station-zurich-hb",
    name: "Zurich HB",
    countryCode: "CH",
    coordinates: [8.5402, 47.3782],
    timezone: "Europe/Zurich"
  },
  {
    id: "station-milano-centrale",
    name: "Milano Centrale",
    countryCode: "IT",
    coordinates: [9.2042, 45.4864],
    timezone: "Europe/Rome"
  },
  {
    id: "station-munich-hbf",
    name: "Munich Hbf",
    countryCode: "DE",
    coordinates: [11.5583, 48.1402],
    timezone: "Europe/Berlin"
  },
  {
    id: "station-amsterdam-centraal",
    name: "Amsterdam Centraal",
    countryCode: "NL",
    coordinates: [4.9003, 52.3789],
    timezone: "Europe/Amsterdam"
  },
  {
    id: "station-berlin-hbf",
    name: "Berlin Hbf",
    countryCode: "DE",
    coordinates: [13.3695, 52.5251],
    timezone: "Europe/Berlin"
  }
];

export const demoOperators: Operator[] = [
  { id: "operator-sbb", name: "SBB", countryCode: "CH", color: "#e11d48" },
  { id: "operator-sncf", name: "SNCF", countryCode: "FR", color: "#2563eb" },
  { id: "operator-db", name: "Deutsche Bahn", countryCode: "DE", color: "#dc2626" },
  { id: "operator-ns", name: "NS", countryCode: "NL", color: "#f59e0b" }
];

export const demoJourneys: Journey[] = [
  {
    id: "journey-alpine-archive",
    name: "Alpine archive",
    description: "Cross-border rail days through the Alps.",
    coverColor: "#0f766e"
  },
  {
    id: "journey-night-lines",
    name: "Night lines",
    description: "Sleeper and late evening services.",
    coverColor: "#1e1b4b"
  }
];

export const demoTags: Tag[] = [
  { id: "tag-scenic", label: "Scenic", color: "#0f766e" },
  { id: "tag-work", label: "Work", color: "#475569" },
  { id: "tag-night", label: "Night train", color: "#312e81" }
];

export const demoTrips: Trip[] = [
  {
    id: "trip-paris-zurich",
    title: "Paris to Zurich",
    mode: "rail",
    status: "completed",
    serviceClass: "second",
    date: "2025-05-18",
    operatorId: "operator-sbb",
    operatorName: "SBB",
    trainCode: "TGV Lyria 9223",
    journeyId: "journey-alpine-archive",
    tagIds: ["tag-scenic"],
    countryCodes: ["FR", "CH"],
    distanceKm: 611,
    stops: [
      {
        id: "stop-paris-zurich-1",
        stationId: "station-paris-lyon",
        stationName: "Paris Gare de Lyon",
        countryCode: "FR",
        coordinates: [2.373, 48.844],
        sequence: 1,
        departureAt: "2025-05-18T10:22:00+02:00",
        source: "manual",
        confidence: "matched"
      },
      {
        id: "stop-paris-zurich-2",
        stationId: "station-zurich-hb",
        stationName: "Zurich HB",
        countryCode: "CH",
        coordinates: [8.5402, 47.3782],
        sequence: 2,
        arrivalAt: "2025-05-18T14:26:00+02:00",
        source: "manual",
        confidence: "matched"
      }
    ],
    segments: [
      {
        id: "segment-paris-zurich",
        tripId: "trip-paris-zurich",
        fromStopId: "stop-paris-zurich-1",
        toStopId: "stop-paris-zurich-2",
        distanceKm: 611
      }
    ],
    geometry: {
      id: "geometry-paris-zurich-v1",
      tripId: "trip-paris-zurich",
      version: 1,
      source: "generated",
      confidence: "inferred",
      manualViaPoints: [],
      createdAt: now,
      createdBy: "seed",
      geometry: {
        type: "LineString",
        coordinates: [
          [2.373, 48.844],
          [4.8357, 47.322],
          [7.5886, 47.5596],
          [8.5402, 47.3782]
        ]
      }
    },
    geometryVersions: [],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "trip-zurich-milano",
    title: "Zurich to Milano",
    mode: "rail",
    status: "needs_review",
    serviceClass: "first",
    date: "2025-06-02",
    operatorId: "operator-sbb",
    operatorName: "SBB",
    trainCode: "EC 317",
    journeyId: "journey-alpine-archive",
    tagIds: ["tag-scenic"],
    countryCodes: ["CH", "IT"],
    distanceKm: 280,
    stops: [
      {
        id: "stop-zurich-milano-1",
        stationId: "station-zurich-hb",
        stationName: "Zurich HB",
        countryCode: "CH",
        coordinates: [8.5402, 47.3782],
        sequence: 1,
        source: "provider",
        confidence: "matched"
      },
      {
        id: "stop-zurich-milano-2",
        stationId: "station-milano-centrale",
        stationName: "Milano Centrale",
        countryCode: "IT",
        coordinates: [9.2042, 45.4864],
        sequence: 2,
        source: "provider",
        confidence: "matched"
      }
    ],
    segments: [
      {
        id: "segment-zurich-milano",
        tripId: "trip-zurich-milano",
        fromStopId: "stop-zurich-milano-1",
        toStopId: "stop-zurich-milano-2",
        distanceKm: 280
      }
    ],
    geometry: {
      id: "geometry-zurich-milano-v2",
      tripId: "trip-zurich-milano",
      version: 2,
      source: "manual",
      confidence: "manual",
      manualViaPoints: [
        {
          id: "via-gotthard",
          label: "Gotthard via",
          coordinates: [8.58, 46.55],
          sequence: 2
        }
      ],
      createdAt: now,
      createdBy: "seed",
      notes: "Manual via added to avoid straight-line alpine crossing.",
      geometry: {
        type: "LineString",
        coordinates: [
          [8.5402, 47.3782],
          [8.58, 46.55],
          [9.2042, 45.4864]
        ]
      }
    },
    geometryVersions: [
      {
        id: "geometry-zurich-milano-v1",
        tripId: "trip-zurich-milano",
        version: 1,
        source: "generated",
        confidence: "inferred",
        manualViaPoints: [],
        createdAt: "2025-06-02T18:20:00.000Z",
        createdBy: "seed",
        changeSummary: "Initial inferred geometry",
        geometry: {
          type: "LineString",
          coordinates: [
            [8.5402, 47.3782],
            [9.2042, 45.4864]
          ]
        }
      }
    ],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "trip-amsterdam-berlin",
    title: "Amsterdam to Berlin",
    mode: "rail",
    status: "completed",
    serviceClass: "second",
    date: "2024-09-12",
    operatorId: "operator-db",
    operatorName: "Deutsche Bahn",
    trainCode: "IC 145",
    journeyId: "journey-night-lines",
    tagIds: ["tag-work"],
    countryCodes: ["NL", "DE"],
    distanceKm: 656,
    stops: [
      {
        id: "stop-amsterdam-berlin-1",
        stationId: "station-amsterdam-centraal",
        stationName: "Amsterdam Centraal",
        countryCode: "NL",
        coordinates: [4.9003, 52.3789],
        sequence: 1,
        source: "import",
        confidence: "matched"
      },
      {
        id: "stop-amsterdam-berlin-2",
        stationId: "station-berlin-hbf",
        stationName: "Berlin Hbf",
        countryCode: "DE",
        coordinates: [13.3695, 52.5251],
        sequence: 2,
        source: "import",
        confidence: "matched"
      }
    ],
    segments: [
      {
        id: "segment-amsterdam-berlin",
        tripId: "trip-amsterdam-berlin",
        fromStopId: "stop-amsterdam-berlin-1",
        toStopId: "stop-amsterdam-berlin-2",
        distanceKm: 656
      }
    ],
    geometry: {
      id: "geometry-amsterdam-berlin-v1",
      tripId: "trip-amsterdam-berlin",
      version: 1,
      source: "generated",
      confidence: "inferred",
      manualViaPoints: [],
      createdAt: now,
      createdBy: "seed",
      geometry: {
        type: "LineString",
        coordinates: [
          [4.9003, 52.3789],
          [7.4653, 51.5136],
          [10.5268, 52.2689],
          [13.3695, 52.5251]
        ]
      }
    },
    geometryVersions: [],
    createdAt: now,
    updatedAt: now
  }
];
