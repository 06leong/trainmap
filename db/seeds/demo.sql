insert into stations (name, country_code, timezone, geom)
values
  ('Paris Gare de Lyon', 'FR', 'Europe/Paris', st_setsrid(st_makepoint(2.373, 48.844), 4326)),
  ('Zurich HB', 'CH', 'Europe/Zurich', st_setsrid(st_makepoint(8.5402, 47.3782), 4326)),
  ('Milano Centrale', 'IT', 'Europe/Rome', st_setsrid(st_makepoint(9.2042, 45.4864), 4326)),
  ('Berlin Hbf', 'DE', 'Europe/Berlin', st_setsrid(st_makepoint(13.3695, 52.5251), 4326)),
  ('Amsterdam Centraal', 'NL', 'Europe/Amsterdam', st_setsrid(st_makepoint(4.9003, 52.3789), 4326))
on conflict do nothing;

insert into operators (name, country_code, color)
values
  ('SBB', 'CH', '#e11d48'),
  ('SNCF', 'FR', '#2563eb'),
  ('Deutsche Bahn', 'DE', '#dc2626'),
  ('NS', 'NL', '#f59e0b')
on conflict do nothing;

insert into tags (label, color)
values
  ('Scenic', '#0f766e'),
  ('Work', '#475569'),
  ('Night train', '#312e81')
on conflict do nothing;
