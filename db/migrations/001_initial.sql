create extension if not exists postgis;
create extension if not exists pgcrypto;

create type transport_mode as enum ('rail', 'tram', 'metro', 'bus', 'ferry', 'flight');
create type trip_status as enum ('planned', 'completed', 'needs_review');
create type service_class as enum ('first', 'second', 'sleeper', 'mixed');
create type geometry_confidence as enum ('exact', 'inferred', 'manual');
create type geometry_source as enum ('imported', 'generated', 'provider', 'manual');
create type import_status as enum ('draft', 'previewed', 'committed', 'failed');
create type export_status as enum ('queued', 'rendering', 'complete', 'failed');
create type export_type as enum ('map', 'stats', 'poster');

create table stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code char(2) not null,
  timezone text,
  source text,
  geom geometry(Point, 4326) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stations_geom_idx on stations using gist (geom);
create index stations_name_idx on stations using gin (to_tsvector('simple', name));

create table station_aliases (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  alias text not null,
  locale text,
  source text,
  created_at timestamptz not null default now(),
  unique (station_id, alias)
);

create table operators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code char(2),
  color text,
  created_at timestamptz not null default now(),
  unique (name, country_code)
);

create table journeys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  cover_color text,
  created_at timestamptz not null default now()
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  color text not null default '#475569',
  created_at timestamptz not null default now()
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  mode transport_mode not null default 'rail',
  status trip_status not null default 'completed',
  service_class service_class not null default 'second',
  departure_date date not null,
  arrival_date date,
  operator_id uuid references operators(id),
  train_code text,
  journey_id uuid references journeys(id) on delete set null,
  distance_km numeric(10, 2) not null default 0,
  raw_import_row jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trips_departure_date_idx on trips (departure_date);
create index trips_status_idx on trips (status);
create index trips_raw_import_row_idx on trips using gin (raw_import_row);

create table trip_tags (
  trip_id uuid not null references trips(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (trip_id, tag_id)
);

create table trip_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  station_id uuid references stations(id) on delete set null,
  station_name text not null,
  country_code char(2),
  stop_sequence integer not null,
  arrival_at timestamptz,
  departure_at timestamptz,
  source text not null default 'manual',
  match_confidence text not null default 'matched',
  geom geometry(Point, 4326),
  created_at timestamptz not null default now(),
  unique (trip_id, stop_sequence)
);

create index trip_stops_trip_sequence_idx on trip_stops (trip_id, stop_sequence);
create index trip_stops_geom_idx on trip_stops using gist (geom);

create table trip_segments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  from_stop_id uuid not null references trip_stops(id) on delete cascade,
  to_stop_id uuid not null references trip_stops(id) on delete cascade,
  distance_km numeric(10, 2) not null default 0,
  geom geometry(LineString, 4326),
  created_at timestamptz not null default now()
);

create index trip_segments_trip_idx on trip_segments (trip_id);
create index trip_segments_geom_idx on trip_segments using gist (geom);

create table trip_geometries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  version integer not null,
  source geometry_source not null,
  confidence geometry_confidence not null,
  geom geometry(LineString, 4326) not null,
  manual_via_points jsonb not null default '[]'::jsonb,
  notes text,
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  unique (trip_id, version)
);

create index trip_geometries_trip_version_idx on trip_geometries (trip_id, version desc);
create index trip_geometries_geom_idx on trip_geometries using gist (geom);

create table trip_geometry_versions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  geometry_id uuid not null references trip_geometries(id) on delete cascade,
  parent_geometry_id uuid references trip_geometries(id) on delete set null,
  version integer not null,
  source geometry_source not null,
  confidence geometry_confidence not null,
  geom geometry(LineString, 4326) not null,
  manual_via_points jsonb not null default '[]'::jsonb,
  change_summary text not null,
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);

create index trip_geometry_versions_trip_idx on trip_geometry_versions (trip_id, version desc);

create table imports (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  format text not null default 'viaduct_csv',
  status import_status not null default 'draft',
  row_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references imports(id) on delete cascade,
  row_number integer not null,
  raw jsonb not null,
  normalized jsonb not null default '{}'::jsonb,
  status text not null,
  messages text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (import_id, row_number)
);

create index import_rows_import_status_idx on import_rows (import_id, status);
create index import_rows_raw_idx on import_rows using gin (raw);

create table saved_views (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  public_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table exports (
  id uuid primary key default gen_random_uuid(),
  type export_type not null,
  preset text not null,
  theme text not null,
  title text,
  subtitle text,
  include_legend boolean not null default true,
  include_attribution boolean not null default true,
  render_url text,
  output_path text,
  status export_status not null default 'queued',
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
