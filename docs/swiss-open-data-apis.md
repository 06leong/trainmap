# Swiss Open Data API planning

Official API-format datasets currently listed by opentransportdata.swiss:

1. Alpha: Linked Open Data Pilot: Atlas and some NOVA prices
   - Use: experimental linked data for fare/stop reference exploration.
   - trainmap status: later reference-data research, not route geometry.

2. Train Formation Service (Train Composition)
   - Use: train composition by vehicle, stop, or full formation endpoints.
   - trainmap status: queried during schedule-created trip persistence for supported EVUs; displayed on trip detail as a best-effort formation summary.

3. Beta: Service for requesting price information via OJP Fare
   - Use: non-binding Swiss public transport fare calculation through OJP/NOVA.
   - trainmap status: later trip cost annotations, not MVP route geometry.

4. Open Journey Planner 2.0
   - Use: route planning from stops, coordinates, addresses, or places; supports trip planning and route geography through OJP parameters.
   - trainmap status: primary provider for schedule-assisted trip creation and route geometry refinement.

5. Traffic information (road traffic)
   - Use: real-time road traffic conditions, incidents, roadworks.
   - trainmap status: future non-rail layer only, not rail route geometry.

6. GTFS Realtime - Service Alerts
   - Use: real-time public transport service alerts as GTFS-RT protobuf.
   - trainmap status: future disruption annotations; requires matching GTFS static feed.

7. Event data Public Transport (SIRI-SX / VDV736)
   - Use: public transport incident XML, with complete and unplanned feeds.
   - trainmap status: future disruption/event annotations.

8. Traffic lights (road traffic) - real time
   - Use: road traffic signal measurements via OCIT-C.
   - trainmap status: not relevant for rail-first MVP.

9. Traffic counters (road traffic) - real time
   - Use: real-time road traffic counter data.
   - trainmap status: not relevant for rail-first MVP.

10. SIRI Planned Timetable
    - Use: daily updated operating timetable as SIRI.
    - trainmap status: later planned timetable ingestion/cache, not first live route refinement.

11. SIRI Estimated Timetable
    - Use: real-time public transport estimates in SIRI format.
    - trainmap status: later real-time annotation.

12. Open Journey Planner 2020
    - Use: OJP 1.0 production route planner endpoint.
    - trainmap status: fallback only; prefer OJP 2.0 for new work.

13. GTFS Realtime
    - Use: GTFS-RT Trip Updates, linked to matching GTFS static data.
    - trainmap status: configured for later real-time updates once GTFS static ingestion exists.

## OJP 2.0 implementation choice

trainmap uses OJP 2.0 first because it can return the two things the app needs most:

- stop sequence through `IncludeIntermediateStops`
- route geometry through `IncludeLegProjection` and `IncludeTrackSections`

The current implementation powers Add Trip and trip-detail refinement through OJP 2.0. It posts LocationInformationRequest and TripRequest XML to `https://api.opentransportdata.swiss/ojp20`, normalizes returned station refs and stops into trainmap domain objects, and saves returned projection/track coordinates as provider/exact `trip_geometries` versions when OJP returns usable geometry.

Required environment:

- `SWISS_OPEN_DATA_API_KEY`

Use the API Manager `TOKEN` value as `SWISS_OPEN_DATA_API_KEY`. The `TOKEN HASH` is not sent to the API and is not used by trainmap.

The OJP 2.0 request uses:

- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/xml`
- a descriptive `User-Agent`

OJP 2.0 `OperatorRef` values reference Business Organisations by `organisationNumber`. The app bundles the official Business Organisations v2 actual-date mapping so values such as `11`, `955`, and `1183` display as `Swiss Federal Railways SBB`, `Trasporti Pubblici Luganesi SA`, and `Trenitalia S.p.A.` instead of leaking numeric fallback labels.

Refresh the bundled operator mapping with:

```bash
npm run swiss-open-data:operators
```

No token hash is needed. To verify a token from a shell after building the timetable adapter package:

```bash
npm run build --workspace @trainmap/timetable-adapters
npm run swiss-open-data:smoke
```

Optional environment:

- `SWISS_OPEN_DATA_OJP_ENDPOINT`
- `SWISS_OPEN_DATA_REQUESTOR_REF`
- `SWISS_OPEN_DATA_USER_AGENT`

## Train Formation Service configuration

Train Formation Service is a REST/JSON service for train composition data, not a route planner. The API Manager product URL should be configured as the base URL without a version suffix:

- `https://api.opentransportdata.swiss/formation`

Do not add a version suffix in `SWISS_TRAIN_FORMATION_API_BASE_URL`. trainmap appends `/formations_full` to the base URL when it queries formation data.

Typical query parameters are:

- `evu`: supported railway undertaking, for example `SBBP`, `BLSP`, `SOB`, `THURBO`, `RhB`, `TPF`, `ZB`
- `operationDate`: service date, not in the past for stop-based data
- `trainNumber`: train number from timetable data

Configured environment:

- `SWISS_TRAIN_FORMATION_API_KEY`
- `SWISS_TRAIN_FORMATION_API_BASE_URL`, default `https://api.opentransportdata.swiss/formation`

This token is separate from the OJP token. Use the API Manager `TOKEN` value only; the token hash is not used. The public limits page currently groups Train Formation Service with OJP/OJPFare/CKAN at 50 requests per minute and 20,000 requests per day per API key.

Runtime behavior:

- Formation is not used for route planning.
- During Add Trip creation from an OJP connection, trainmap infers supported EVU codes from each OJP leg and extracts the train number from the train code.
- Supported inferred EVUs include `SBBP`, `BLSP`, `SOB`, `THURBO`, `RhB`, `TPF`, `TRN`, `MBC`, `OeBB`, and `ZB`.
- Formation query failures do not block trip creation; the trip detail page shows available, unavailable, or failed summaries from the persisted trip metadata.

## GTFS Realtime configuration

GTFS Realtime Trip Updates are protobuf feeds for real-time delays, cancellations, and modified trips. They are not suitable as the first source for Add Trip route planning because the feed references GTFS Static IDs that change between GTFS versions. The app should only attach GTFS-RT data after it can match against the correct GTFS Static feed version.

Configured environment:

- `SWISS_GTFS_RT_API_KEY`
- `SWISS_GTFS_RT_API_URL`, default `https://api.opentransportdata.swiss/la/gtfs-rt`

Implementation notes for the future adapter:

- send `Authorization: Bearer <TOKEN>`
- prefer binary protobuf, not JSON, for production use
- allow HTTP redirects
- set a descriptive `User-Agent`
- use `?format=JSON` only for diagnostics
- respect the public GTFS-RT limit of 5 requests per minute per API key
