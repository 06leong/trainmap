insert into stations (id, name, country_code, timezone, source, geom)
values
  ('00000000-0000-4000-8000-000000000001', 'Paris Gare de Lyon', 'FR', 'Europe/Paris', 'seed', st_setsrid(st_makepoint(2.3730, 48.8440), 4326)),
  ('00000000-0000-4000-8000-000000000002', 'Zurich HB', 'CH', 'Europe/Zurich', 'seed', st_setsrid(st_makepoint(8.5402, 47.3782), 4326)),
  ('00000000-0000-4000-8000-000000000003', 'Milano Centrale', 'IT', 'Europe/Rome', 'seed', st_setsrid(st_makepoint(9.2042, 45.4864), 4326)),
  ('00000000-0000-4000-8000-000000000004', 'Berlin Hbf', 'DE', 'Europe/Berlin', 'seed', st_setsrid(st_makepoint(13.3695, 52.5251), 4326)),
  ('00000000-0000-4000-8000-000000000005', 'Amsterdam Centraal', 'NL', 'Europe/Amsterdam', 'seed', st_setsrid(st_makepoint(4.9003, 52.3789), 4326)),
  ('00000000-0000-4000-8000-000000000006', 'Basel SBB', 'CH', 'Europe/Zurich', 'seed', st_setsrid(st_makepoint(7.5896, 47.5476), 4326)),
  ('00000000-0000-4000-8000-000000000007', 'Brig', 'CH', 'Europe/Zurich', 'seed', st_setsrid(st_makepoint(7.9881, 46.3190), 4326))
on conflict (id) do update set
  name = excluded.name,
  country_code = excluded.country_code,
  timezone = excluded.timezone,
  source = excluded.source,
  geom = excluded.geom;

insert into operators (id, name, country_code, color)
values
  ('10000000-0000-4000-8000-000000000001', 'SBB', 'CH', '#e11d48'),
  ('10000000-0000-4000-8000-000000000002', 'SNCF', 'FR', '#2563eb'),
  ('10000000-0000-4000-8000-000000000003', 'Deutsche Bahn', 'DE', '#dc2626'),
  ('10000000-0000-4000-8000-000000000004', 'NS', 'NL', '#f59e0b')
on conflict (id) do update set
  name = excluded.name,
  country_code = excluded.country_code,
  color = excluded.color;

insert into journeys (id, name, description, cover_color)
values
  ('20000000-0000-4000-8000-000000000001', 'Alpine archive', 'Cross-border rail days through Switzerland and northern Italy.', '#0f766e'),
  ('20000000-0000-4000-8000-000000000002', 'Northern corridor', 'Long-distance city links across Germany and the Netherlands.', '#1d4ed8')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  cover_color = excluded.cover_color;

insert into tags (id, label, color)
values
  ('30000000-0000-4000-8000-000000000001', 'Scenic', '#0f766e'),
  ('30000000-0000-4000-8000-000000000002', 'Work', '#475569'),
  ('30000000-0000-4000-8000-000000000003', 'Night train', '#312e81')
on conflict (id) do update set
  label = excluded.label,
  color = excluded.color;

insert into trips (
  id, title, mode, status, service_class, departure_date, arrival_date,
  operator_id, train_code, journey_id, distance_km, raw_import_row
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    'Zurich HB to Milano Centrale',
    'rail',
    'completed',
    'second',
    '2025-04-14',
    null,
    '10000000-0000-4000-8000-000000000001',
    'EC 151',
    '20000000-0000-4000-8000-000000000001',
    280,
    '{"source":"seed"}'::jsonb
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    'Amsterdam Centraal to Berlin Hbf',
    'rail',
    'completed',
    'first',
    '2025-06-02',
    null,
    '10000000-0000-4000-8000-000000000003',
    'IC 143',
    '20000000-0000-4000-8000-000000000002',
    650,
    '{"source":"seed"}'::jsonb
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    'Paris Gare de Lyon to Zurich HB',
    'rail',
    'planned',
    'second',
    '2026-05-19',
    null,
    '10000000-0000-4000-8000-000000000002',
    'TGV Lyria 9213',
    '20000000-0000-4000-8000-000000000001',
    610,
    '{"source":"seed"}'::jsonb
  )
on conflict (id) do update set
  title = excluded.title,
  mode = excluded.mode,
  status = excluded.status,
  service_class = excluded.service_class,
  departure_date = excluded.departure_date,
  arrival_date = excluded.arrival_date,
  operator_id = excluded.operator_id,
  train_code = excluded.train_code,
  journey_id = excluded.journey_id,
  distance_km = excluded.distance_km,
  raw_import_row = excluded.raw_import_row,
  updated_at = now();

delete from trip_tags where trip_id in (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003'
);

insert into trip_tags (trip_id, tag_id)
values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001')
on conflict do nothing;

delete from trip_segments where trip_id in (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003'
);

insert into trip_stops (
  id, trip_id, station_id, station_name, country_code, stop_sequence,
  arrival_at, departure_at, source, match_confidence, geom
)
values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Zurich HB', 'CH', 1, null, '2025-04-14 08:33:00+02', 'import', 'matched', st_setsrid(st_makepoint(8.5402, 47.3782), 4326)),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000006', 'Basel SBB', 'CH', 2, '2025-04-14 09:26:00+02', '2025-04-14 09:34:00+02', 'import', 'matched', st_setsrid(st_makepoint(7.5896, 47.5476), 4326)),
  ('50000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000007', 'Brig', 'CH', 3, '2025-04-14 11:10:00+02', '2025-04-14 11:18:00+02', 'import', 'matched', st_setsrid(st_makepoint(7.9881, 46.3190), 4326)),
  ('50000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'Milano Centrale', 'IT', 4, '2025-04-14 12:50:00+02', null, 'import', 'matched', st_setsrid(st_makepoint(9.2042, 45.4864), 4326)),
  ('50000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000005', 'Amsterdam Centraal', 'NL', 1, null, '2025-06-02 07:00:00+02', 'import', 'matched', st_setsrid(st_makepoint(4.9003, 52.3789), 4326)),
  ('50000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004', 'Berlin Hbf', 'DE', 2, '2025-06-02 13:22:00+02', null, 'import', 'matched', st_setsrid(st_makepoint(13.3695, 52.5251), 4326)),
  ('50000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Paris Gare de Lyon', 'FR', 1, null, '2026-05-19 10:22:00+02', 'import', 'matched', st_setsrid(st_makepoint(2.3730, 48.8440), 4326)),
  ('50000000-0000-4000-8000-000000000008', '40000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000006', 'Basel SBB', 'CH', 2, '2026-05-19 13:26:00+02', '2026-05-19 13:33:00+02', 'import', 'matched', st_setsrid(st_makepoint(7.5896, 47.5476), 4326)),
  ('50000000-0000-4000-8000-000000000009', '40000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'Zurich HB', 'CH', 3, '2026-05-19 14:26:00+02', null, 'import', 'matched', st_setsrid(st_makepoint(8.5402, 47.3782), 4326))
on conflict (id) do update set
  trip_id = excluded.trip_id,
  station_id = excluded.station_id,
  station_name = excluded.station_name,
  country_code = excluded.country_code,
  stop_sequence = excluded.stop_sequence,
  arrival_at = excluded.arrival_at,
  departure_at = excluded.departure_at,
  source = excluded.source,
  match_confidence = excluded.match_confidence,
  geom = excluded.geom;

insert into trip_segments (trip_id, from_stop_id, to_stop_id, distance_km, geom)
values
  ('40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 70, st_setsrid(st_makeline(st_makepoint(8.5402, 47.3782), st_makepoint(7.5896, 47.5476)), 4326)),
  ('40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000003', 105, st_setsrid(st_makeline(st_makepoint(7.5896, 47.5476), st_makepoint(7.9881, 46.3190)), 4326)),
  ('40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000004', 105, st_setsrid(st_makeline(st_makepoint(7.9881, 46.3190), st_makepoint(9.2042, 45.4864)), 4326)),
  ('40000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000006', 650, st_setsrid(st_makeline(st_makepoint(4.9003, 52.3789), st_makepoint(13.3695, 52.5251)), 4326)),
  ('40000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000007', '50000000-0000-4000-8000-000000000008', 480, st_setsrid(st_makeline(st_makepoint(2.3730, 48.8440), st_makepoint(7.5896, 47.5476)), 4326)),
  ('40000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000008', '50000000-0000-4000-8000-000000000009', 130, st_setsrid(st_makeline(st_makepoint(7.5896, 47.5476), st_makepoint(8.5402, 47.3782)), 4326));

delete from trip_geometry_versions where trip_id in (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003'
);

delete from trip_geometries where trip_id in (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003'
);

insert into trip_geometries (
  id, trip_id, version, source, confidence, geom, manual_via_points, notes, created_by
)
values
  ('60000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 1, 'generated', 'inferred', st_setsrid(st_geomfromgeojson('{"type":"LineString","coordinates":[[8.5402,47.3782],[7.5896,47.5476],[7.9881,46.3190],[9.2042,45.4864]]}'), 4326), '[]'::jsonb, 'Seed inferred geometry from stops.', 'seed'),
  ('60000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 1, 'generated', 'inferred', st_setsrid(st_geomfromgeojson('{"type":"LineString","coordinates":[[4.9003,52.3789],[13.3695,52.5251]]}'), 4326), '[]'::jsonb, 'Seed inferred geometry from stops.', 'seed'),
  ('60000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003', 1, 'generated', 'inferred', st_setsrid(st_geomfromgeojson('{"type":"LineString","coordinates":[[2.373,48.844],[7.5896,47.5476],[8.5402,47.3782]]}'), 4326), '[]'::jsonb, 'Seed inferred geometry from stops.', 'seed')
on conflict (trip_id, version) do update set
  source = excluded.source,
  confidence = excluded.confidence,
  geom = excluded.geom,
  manual_via_points = excluded.manual_via_points,
  notes = excluded.notes,
  created_by = excluded.created_by;

insert into trip_geometry_versions (
  id, trip_id, geometry_id, parent_geometry_id, version, source, confidence,
  geom, manual_via_points, change_summary, created_by
)
values
  ('70000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', null, 1, 'generated', 'inferred', st_setsrid(st_geomfromgeojson('{"type":"LineString","coordinates":[[8.5402,47.3782],[7.5896,47.5476],[7.9881,46.3190],[9.2042,45.4864]]}'), 4326), '[]'::jsonb, 'Initial seed geometry', 'seed'),
  ('70000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', null, 1, 'generated', 'inferred', st_setsrid(st_geomfromgeojson('{"type":"LineString","coordinates":[[4.9003,52.3789],[13.3695,52.5251]]}'), 4326), '[]'::jsonb, 'Initial seed geometry', 'seed'),
  ('70000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000003', null, 1, 'generated', 'inferred', st_setsrid(st_geomfromgeojson('{"type":"LineString","coordinates":[[2.373,48.844],[7.5896,47.5476],[8.5402,47.3782]]}'), 4326), '[]'::jsonb, 'Initial seed geometry', 'seed')
on conflict (id) do update set
  geometry_id = excluded.geometry_id,
  parent_geometry_id = excluded.parent_geometry_id,
  version = excluded.version,
  source = excluded.source,
  confidence = excluded.confidence,
  geom = excluded.geom,
  manual_via_points = excluded.manual_via_points,
  change_summary = excluded.change_summary,
  created_by = excluded.created_by;
