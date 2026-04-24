---
name: timetable-adapters
description: Use this skill when the task is to build, extend, or debug timetable/provider adapters such as swiss_open_data, db_api, ns_api, or generic_gtfs for schedule-assisted trip creation.
---

# Goal
Provide a stable adapter layer for timetable and stop-sequence retrieval without coupling the whole app to one provider.

# When to use
Use this skill when:
- implementing a new timetable adapter
- normalizing provider responses
- retrieving stop sequences for trip creation
- building provider capability checks
- debugging schedule-assisted trip import

# When not to use
Do not use this skill for:
- CSV imports
- visual map export
- general UI styling
- route geometry editing after stop sequence already exists

# Adapter contract
Every adapter should expose stable methods such as:
- searchStations(...)
- searchTrips(...)
- getTripStopSequence(...)
- getProviderMetadata(...)

# Rules
- normalize provider output into internal types
- keep provider-specific fields isolated
- expose capability flags explicitly
- handle partial data safely
- fail gracefully when providers are unavailable

# Europe-first initial providers
- swiss_open_data
- db_api
- ns_api
- generic_gtfs

# Quality bar
- provider modules are swappable
- no provider-specific assumptions leak into UI pages
- typed normalization is required
- tests cover partial and malformed upstream responses
