# Swiss Open Data API planning

Official API-format datasets currently listed by opentransportdata.swiss:

1. Alpha: Linked Open Data Pilot: Atlas and some NOVA prices
   - Use: experimental linked data for fare/stop reference exploration.
   - trainmap status: later reference-data research, not route geometry.

2. Train Formation Service (Train Composition)
   - Use: train composition by vehicle, stop, or full formation endpoints.
   - trainmap status: later train detail enrichment, not route geometry.

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
    - trainmap status: later real-time updates once GTFS static ingestion exists.

## OJP 2.0 implementation choice

trainmap uses OJP 2.0 first because it can return the two things the app needs most:

- stop sequence through `IncludeIntermediateStops`
- route geometry through `IncludeLegProjection` and `IncludeTrackSections`

The first implementation refines an existing trip from its current first and last stop coordinates. It posts an OJP TripRequest to `https://api.opentransportdata.swiss/ojp20`, requests rail mode, normalizes returned stops into `trip_stops`, and saves returned projection/track coordinates as a provider/exact `trip_geometries` version.

Required environment:

- `SWISS_OPEN_DATA_API_KEY`

Optional environment:

- `SWISS_OPEN_DATA_OJP_ENDPOINT`
- `SWISS_OPEN_DATA_REQUESTOR_REF`
- `SWISS_OPEN_DATA_USER_AGENT`
