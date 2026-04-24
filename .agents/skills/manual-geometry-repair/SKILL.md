---
name: manual-geometry-repair
description: Use this skill when the task is to add/remove via points, edit stop sequences, regenerate geometry, or save route geometry versions for a railway trip.
---

# Goal
Repair route geometry without losing the canonical stop sequence or previous geometry history.

# When to use
Use this skill when:
- a route path is visibly wrong
- via points must be added, moved, or removed
- the stop sequence needs correction
- geometry should be regenerated after manual edits
- a new geometry version must be saved

# Required behavior
- Preserve the original imported route and raw source values
- Keep stop sequence as the canonical trip backbone
- Store manual via points separately from stations
- Save a new trip_geometry_versions row for every accepted repair
- Mark repaired geometry confidence as manual
- Never silently overwrite geometry history

# Quality bar
- edits are reviewable before save
- fitBounds still works after repair
- geometry remains valid GeoJSON
- provenance explains whether the route is exact, inferred, or manual
