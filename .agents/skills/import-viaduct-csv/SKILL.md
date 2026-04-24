---
name: import-viaduct-csv
description: Use this skill when the task is to import, map, validate, clean, or normalize viaducttrip.csv-like exports into the trainmap schema. Do not use it for general CSV work unrelated to trip imports.
---

# Goal
Import a viaducttrip.csv-style file into the app safely, preserving original values while mapping rows into the internal trip model.

# When to use
Use this skill when:
- a user wants to import viaducttrip.csv
- CSV headers need field mapping
- station names need fuzzy matching
- encoding or operator name cleanup is needed
- unmatched rows need a review flow

# When not to use
Do not use this skill for:
- timetable provider adapters
- image export
- map rendering
- general spreadsheet analysis without trip import intent

# Required outcomes
- Detect delimiter and text encoding safely
- Suggest column mapping
- Run dry-run validation first
- Preserve original raw row payload
- Record import errors per row
- Separate:
  - matched rows
  - fuzzy-matched rows
  - unmatched rows
  - invalid date/time rows
- Never silently drop rows

# Expected fields to look for
Typical viaduct-style columns may include:
- from_station_name
- to_station_name
- departure_date
- departure_time
- arrival_date
- arrival_time
- operator
- train_code
- distance
- tags
- notes

# Import strategy
1. Parse raw file safely
2. Normalize text encoding
3. Infer field mapping
4. Validate dates/times
5. Match stations
6. Generate import preview report
7. Commit rows only after preview is accepted

# Data model expectations
- imports
- import_rows
- trips
- trip_stops
- trip_geometry_versions

# Quality bar
- deterministic parsing
- explicit validation messages
- reproducible import logs
- tests for malformed CSV cases
