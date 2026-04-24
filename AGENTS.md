# AGENTS.md

## Project identity
This repository contains a production-quality self-hosted personal transport footprint web app called trainmap.
The app is inspired by viaduct.world in product scope, but it must not blindly copy viaduct’s implementation details or visual design.
The product should feel premium, map-first, editorial, and personal-archive-like.

## Core architecture rules
- Use a single primary map stack across the product. Prefer MapLibre GL JS.
- Treat basemap assets and business route data as separate systems.
- Do not assume basemap providers compute railway routes.
- Model route geometry, stop sequence, and manual via editing as first-class concepts.
- Keep the schema Europe-first but world-ready.
- Use PostgreSQL + PostGIS for all persistent geographic data.

## Product priorities
1. Rail first
2. Beautiful UI
3. Import from viaducttrip.csv-like exports
4. Manual route repair and via editing
5. High-resolution PNG export
6. Self-hosted deployment with Docker Compose
7. Future-ready timetable/provider adapters

## Infrastructure constraints
- The deployment target is a 4C8G Debian 13 VPS.
- There is already an existing reverse proxy in front of the app.
- Do not include nginx in the stack.
- The app must bind to 0.0.0.0 on an internal port only.
- The production stack should be lightweight enough for a single VPS.
- Prefer maintainable defaults over distributed complexity.
- Route vector tiles are allowed as a later optimization, not required for MVP.

## Deployment constraints
- The repository should be buildable into a GHCR image such as ghcr.io/<owner>/trainmap:latest.
- Deployment should work with docker compose by pulling a prebuilt image from GHCR.
- Do not assume Vercel or any managed frontend hosting platform.

## UI rules
- Avoid generic SaaS admin dashboard aesthetics.
- Use strong typography, restrained colors, dense-but-clear information layout, and elegant whitespace.
- Desktop-first, but tablet/mobile must remain usable.
- Add polished loading, empty, import-validation, and export-preview states.
- Export views should look intentionally designed, not like screenshots of app pages.

## Map rules
- Basemap selector is required.
- Dark and light themes are required.
- Route rendering must support:
  - exact geometry
  - inferred geometry
  - manual geometry
- Trip detail pages must work even when exact route geometry is missing by falling back to stop sequence / waypoints.

## Import rules
- Build a field-mapping CSV import wizard.
- Preserve original imported values.
- Support encoding cleanup and fuzzy station matching.
- Unmatched rows must be reviewable, not silently dropped.

## Export rules
- Support map-only, stats-only, and poster layouts.
- Support PNG export presets:
  - 1920x1080
  - 2560x1440
  - 3840x2160
  - 7680x4320
- Exports must support dark and light themes.

## Timetable/provider rules
- Build adapters behind stable interfaces.
- Start with Europe-first adapters:
  - swiss_open_data
  - db_api
  - ns_api
  - generic_gtfs
- Never hardwire the whole app to one provider.

## Coding standards
- TypeScript end-to-end.
- Prefer server-side validation for critical mutations.
- Prefer explicit domain objects and services over page-level business logic.
- Write tests for import parsing, station matching, route generation fallback logic, and export rendering inputs.
- Keep dependencies justified and minimal.

## Validation requirements
Before declaring any substantial task complete:
- run lint
- run tests relevant to the change
- run build
- summarize any remaining limitations honestly

## Codex behavior
When working in this repo:
- propose a plan before large refactors
- prefer incremental commits
- do not add placeholder-only UI
- do not add dead code or speculative abstractions without immediate use
- do not introduce a second map stack unless explicitly required
- do not add nginx, Redis, Kafka, or background workers unless clearly justified
