---
name: export-map-posters
description: Use this skill when the task is to export the map, statistics, or a poster-style summary to high-resolution PNG images for sharing or archiving.
---

# Goal
Generate polished high-resolution visual exports from app state.

# When to use
Use this skill when:
- a user wants map export
- a user wants a poster summary
- a user wants statistics export
- export presets such as 1080p, 2K, or 4K are needed

# When not to use
Do not use this skill for:
- live app layout work unrelated to export
- route generation
- CSV import
- timetable querying

# Required presets
- 1920x1080
- 2560x1440
- 3840x2160

# Export types
- map-only
- stats-only
- poster summary

# Design rules
- export layouts must be intentionally designed
- avoid screenshot-like UI exports
- support dark and light themes
- allow title, subtitle, legend, and attribution options

# Preferred implementation
- dedicated export routes/pages
- render with Playwright
- stable query-parameter driven inputs
- deterministic layout sizing

# Quality bar
- crisp typography
- consistent margins and legend placement
- safe attribution rendering
- no clipped labels or overlapping statistics
