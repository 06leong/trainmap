---
name: route-generation-and-repair
description: Use this skill when the task is to generate route geometry from stop sequences, infer a missing route, repair a wrong route, or support manual via/waypoint editing for railway trips.
---

# Goal
Produce or repair trip route geometry while preserving route provenance and editability.

# When to use
Use this skill when:
- a trip needs route generation
- a trip has stops but no geometry
- a diverted route needs manual correction
- manual via points must be inserted or removed
- route confidence must be tracked

# When not to use
Do not use this skill for:
- general map UI work
- CSV parsing
- PNG export
- provider timetable fetching unless needed to obtain stop sequence

# Route model
Every trip may have:
- stop sequence
- current geometry
- geometry versions
- confidence level: exact / inferred / manual

# Preferred workflow
1. Start from canonical stop sequence
2. Attempt exact route generation if sufficient data exists
3. Otherwise generate inferred geometry
4. Allow manual via edits
5. Save a new geometry version rather than overwriting history
6. Mark provenance and confidence explicitly

# Manual repair rules
- Never destroy original geometry history
- Preserve source stop sequence
- Record user-specified via points separately
- Recompute geometry after via edits
- Keep exact/inferred/manual labels accurate

# Output expectations
- valid GeoJSON-compatible geometry
- fitBounds-safe coordinates
- stable serialization for storage and export

# Quality bar
- no hidden mutation of historical geometry
- clear fallback behavior
- route display must still work when exact geometry is missing
