# trainmap

Self-hosted personal railway footprint platform inspired by the product scope of viaduct.world, with an independent architecture for basemaps and personal transport data.

## What is implemented

- Next.js App Router web app in `apps/web`
- TypeScript workspace packages for domain types, route generation, CSV import, export presets, UI utilities, and timetable adapters
- MapLibre GL JS map with independent business route, station, label, and coverage-ready layers
- Trip dashboard, full map, trip list, trip detail, manual route repair, station search, CSV import wizard, schedule-assisted trip draft, share view, and export designer pages
- PostGIS-first schema covering stations, aliases, operators, journeys, tags, trips, segments, stops, geometries, geometry versions, imports, import rows, saved views, and exports
- Dockerfile and Docker Compose deployment for an existing reverse proxy network, with no nginx inside the stack

## Local development

```bash
npm install
npm run dev
```

The app binds to `0.0.0.0:3000` for local testing.

Validation:

```bash
npm run lint
npm run test
npm run build
```

## Docker image

Build and publish a GHCR image from the repository root:

```bash
docker build -t ghcr.io/<owner>/trainmap:latest .
docker push ghcr.io/<owner>/trainmap:latest
```

## Self-hosted deployment

Copy `infra/compose/docker-compose.yml` to the server or deploy from a checkout.

Create an `.env` next to the compose file:

```bash
TRAINMAP_IMAGE=ghcr.io/<owner>/trainmap:latest
POSTGRES_DB=trainmap
POSTGRES_USER=trainmap
POSTGRES_PASSWORD=change-me
TRAINMAP_INTERNAL_PORT=3000
NEXT_PUBLIC_APP_URL=https://trainmap.example.com
NEXT_PUBLIC_MAP_STYLE_LIGHT=https://tiles.openfreemap.org/styles/bright
NEXT_PUBLIC_MAP_STYLE_DARK=https://tiles.openfreemap.org/styles/liberty
REVERSE_PROXY_NETWORK=proxy
```

Ensure your existing reverse proxy is attached to the external Docker network named by `REVERSE_PROXY_NETWORK`, then start:

```bash
docker compose -f infra/compose/docker-compose.yml up -d
```

The app exposes only the internal service port to Docker networks. The stack intentionally does not include nginx.

## Architecture notes

- Basemap styles are MapLibre-compatible URLs. The basemap never owns trip geometry.
- Route, station, label, saved view, and export data are trainmap business layers.
- Stop sequence is the canonical route backbone.
- `@trainmap/geo` provides `getRoute(...)`, `loadConnectionsOrSetManualVias(...)`, route confidence, fitBounds helpers, and geometry version creation.
- CSV import preserves raw rows and separates matched, fuzzy matched, unmatched, and invalid rows.
- Timetable adapters expose stable provider contracts for `swiss_open_data`, `db_api`, `ns_api`, and `generic_gtfs`.

## Current limitations

- The web UI uses seeded demo data while PostGIS persistence is scaffolded.
- PNG export has dedicated render pages and presets; the Playwright capture worker is a next step.
- Timetable adapters are typed static adapters until real provider credentials and feed ingestion are configured.
- Route generation currently creates inferred/manual GeoJSON from stop sequences and vias; exact railway track matching is future work.
