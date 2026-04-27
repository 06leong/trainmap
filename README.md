# trainmap

Self-hosted personal railway footprint platform inspired by the product scope of viaduct.world, with an independent architecture for basemaps and personal transport data.

## What is implemented

- Next.js App Router web app in `apps/web`
- TypeScript workspace packages for domain types, route generation, CSV import, export presets, UI utilities, and timetable adapters
- MapLibre GL JS map with independent business route, station, label, and coverage-ready layers
- Trip dashboard, full map, trip list, trip detail, manual route repair, station search, CSV import wizard, schedule-assisted trip draft, share view, and export designer pages
- PNG export presets are limited to 1080p (1920x1080), 2K (2560x1440), and 4K (3840x2160)
- PostGIS-first schema covering stations, aliases, operators, journeys, tags, trips, segments, stops, geometries, geometry versions, imports, import rows, saved views, and exports
- Dockerfile and Docker Compose deployment for an existing reverse proxy network, with no nginx inside the stack

## Local development

```bash
npm install
npm run playwright:install
cp .env.example .env.local
npm run dev
```

The app binds to `0.0.0.0:3000` for local testing. The runtime app reads trips, stations, route geometry, imports, saved views, and exports from PostgreSQL/PostGIS. If `DATABASE_URL` is missing, pages show a setup notice instead of falling back to hardcoded trips.

### Local database

Start a local PostGIS database:

```bash
docker run --name trainmap-postgis \
  -e POSTGRES_DB=trainmap \
  -e POSTGRES_USER=trainmap \
  -e POSTGRES_PASSWORD=trainmap \
  -p 5432:5432 \
  -d postgis/postgis:16-3.4
```

Set the required database environment variable:

```bash
export DATABASE_URL=postgres://trainmap:trainmap@localhost:5432/trainmap
```

Then apply the schema and optional demo seed:

```bash
npm run db:migrate
npm run db:seed
```

Required runtime environment variables:

- `DATABASE_URL`: PostgreSQL/PostGIS connection string.
- `NEXT_PUBLIC_APP_URL`: canonical public app URL for share/export links.
- `NEXT_PUBLIC_MAP_STYLE_LIGHT`: MapLibre-compatible light style URL.
- `NEXT_PUBLIC_MAP_STYLE_DARK`: MapLibre-compatible dark style URL.
- `TRAINMAP_INTERNAL_PORT`: internal app port, default `3000`.
- `TRAINMAP_RENDER_BASE_URL`: internal URL Playwright uses to capture export render pages, default `http://127.0.0.1:3000`.
- `TRAINMAP_EXPORT_DIR`: local directory for generated PNG exports, default `storage/exports`.
- `SWISS_OPEN_DATA_API_KEY`: optional opentransportdata.swiss API Manager token used for Swiss Open Data OJP route refinement.
- `SWISS_OPEN_DATA_OJP_ENDPOINT`: optional OJP endpoint override, default `https://api.opentransportdata.swiss/ojp20`.
- `SWISS_OPEN_DATA_REQUESTOR_REF`: optional OJP requestor reference, default `trainmap_prod` in the app. Use a suffix such as `_test`, `_int`, or `_prod`.
- `SWISS_OPEN_DATA_USER_AGENT`: optional User-Agent for Swiss Open Data API calls, default `trainmap/0.1`.

Only the API Manager `TOKEN` is used. The `TOKEN HASH` shown in the API Manager is not needed by trainmap and should not be configured in compose.

Validation:

```bash
npm run lint
npm run test
npm run build
```

## Docker image

GitHub Actions builds the production Docker image from the repository root and publishes it to GHCR on every push to `main`, or when you run the workflow manually:

```bash
ghcr.io/<owner>/trainmap:latest
ghcr.io/<owner>/trainmap:0.1
ghcr.io/<owner>/trainmap:<git-sha>
```

The workflow is defined in `.github/workflows/docker-publish.yml` and uses `GITHUB_TOKEN` with `packages: write` by default. If your repository or package permissions reject `GITHUB_TOKEN` with `write_package`, add a repository secret named `GHCR_TOKEN` containing a GitHub PAT with `write:packages` and `read:packages`. For private repositories, include `repo` on a classic PAT. The workflow prefers `GHCR_TOKEN` when present and falls back to `GITHUB_TOKEN`.

The version tag is generated from the root `package.json` major/minor version, so the current `0.1.0` package version publishes `ghcr.io/<owner>/trainmap:0.1`. `latest` always points at the newest `main` build.

After the first successful workflow run, open the package page in GitHub:

1. Go to your repository page, then `Packages`, then `trainmap`.
2. Open `Package settings`.
3. Under visibility, choose whether the image should be public or private.
4. If the package already existed before this repository published it, open `Manage Actions access` and grant `06leong/trainmap` write access.
5. If private, make sure the VPS can authenticate to GHCR with a token that has `read:packages`.

## Self-hosted deployment

On a VPS, a simple layout is:

```bash
/home/docker/trainmap/
  docker-compose.yml
  db/migrations/
  db/seeds/
  data/postgres/
```

Create the directories:

```bash
sudo mkdir -p /home/docker/trainmap/db/migrations /home/docker/trainmap/db/seeds /home/docker/trainmap/data/postgres
cd /home/docker/trainmap
```

Copy `infra/compose/docker-compose.yml` to `/home/docker/trainmap/docker-compose.yml`, and copy `db/migrations` plus optional `db/seeds` into `/home/docker/trainmap/db`. The PostGIS container runs SQL files from `db/migrations` on first database initialization.

Edit `/home/docker/trainmap/docker-compose.yml` before starting:

- `app.image`: use `ghcr.io/06leong/trainmap:0.1` for the current stable version, `latest` for newest `main`, or a full git SHA tag for a pinned deployment.
- `app.environment.DATABASE_URL`: replace `change-me` with a strong password.
- `postgres.environment.POSTGRES_PASSWORD`: use the same strong password as `DATABASE_URL`.
- `app.environment.NEXT_PUBLIC_APP_URL`: set your public domain, for example `https://trainmap.example.com`.
- `app.environment.SWISS_OPEN_DATA_API_KEY`: optional. Set this after creating an API Manager token to enable Swiss OJP route refinement from trip detail pages.
- `app.ports`: the default is `172.18.0.1:4396:3000` for Nginx Proxy Manager upstream `http://172.18.0.1:4396`. Change the gateway IP or host port if your VPS uses different values.

The compose file stores PostgreSQL data under `./data` and PNG exports in a Docker-managed named volume:

- `./data/postgres`: PostgreSQL/PostGIS database files.
- `trainmap_exports`: generated PNG export files, served through the app download endpoint.

The export volume is intentionally not a host bind mount. The app container runs as a non-root user, and a Docker-managed volume avoids host filesystem ownership problems without requiring `chown` steps during installation.

To inspect or back up generated PNG files on the VPS:

```bash
docker run --rm \
  -v trainmap_exports:/exports:ro \
  -v "$PWD/data/export-backup:/backup" \
  alpine:3.20 sh -c "cp -a /exports/. /backup/"
```

Start the stack:

```bash
cd /home/docker/trainmap
docker compose up -d
```

The stack intentionally does not include nginx. The compose file binds the app only on the Docker gateway address configured in `ports`, so it is intended to be reached by Nginx Proxy Manager rather than exposed publicly.

If the GHCR package is private, log in on the VPS before pulling:

```bash
echo "<github-token-with-read-packages>" | docker login ghcr.io -u <github-username> --password-stdin
cd /home/docker/trainmap
docker compose pull
docker compose up -d
```

To load the optional demo seed into the running Docker database from a checkout:

```bash
cd /home/docker/trainmap
docker compose exec -T postgres \
  psql -U trainmap -d trainmap < db/seeds/demo.sql
```

## Architecture notes

- Basemap styles are MapLibre-compatible URLs. The basemap never owns trip geometry.
- Route, station, label, saved view, and export data are trainmap business layers.
- Stop sequence is the canonical route backbone.
- `@trainmap/geo` provides `getRoute(...)`, `loadConnectionsOrSetManualVias(...)`, route confidence, fitBounds helpers, and geometry version creation.
- Swiss Open Data OJP 2.0 can refine existing trip geometries with provider stop sequences and leg projection / track section coordinates when `SWISS_OPEN_DATA_API_KEY` is configured.
- The Add Trip page uses OJP 2.0 server-side for station search, connection search, stop sequence import, map preview, and provider geometry creation.
- CSV import preserves raw rows and separates matched, fuzzy matched, unmatched, and invalid rows.
- Timetable adapters expose stable provider contracts for `swiss_open_data`, `db_api`, `ns_api`, and `generic_gtfs`.

## Current limitations

- Runtime pages now require PostgreSQL/PostGIS persistence; without `DATABASE_URL`, the UI shows a setup notice and empty runtime data.
- PNG export uses a simple in-process Playwright capture job for MVP; a queue can be added later if export volume grows.
- Timetable adapters are still static in the client-side schedule assistant until provider-backed trip creation is moved behind server actions.
- Route generation creates inferred/manual GeoJSON by default, and can create provider/exact geometry through Swiss Open Data OJP when credentials are configured. Exact coverage depends on the upstream OJP response returning usable projection or track coordinates.
