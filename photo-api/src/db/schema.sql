create table if not exists photo_assets (
  id text primary key,
  content_hash text not null,
  current_path text not null,
  filename text not null,
  taken_at text not null,
  last_modified_at text,
  file_size integer,
  width integer,
  height integer,
  mime_type text,
  thumbnail_path text,
  is_missing integer not null default 0,
  first_seen_at text not null,
  last_seen_at text not null,
  updated_at text not null
);

create index if not exists photo_assets_taken_at_idx on photo_assets (taken_at);
create index if not exists photo_assets_content_hash_idx on photo_assets (content_hash);
create index if not exists photo_assets_is_missing_idx on photo_assets (is_missing);
create index if not exists photo_assets_current_path_idx on photo_assets (current_path);

create table if not exists scan_runs (
  id text primary key,
  mode text not null default 'incremental',
  started_at text not null,
  finished_at text,
  status text not null,
  scanned integer default 0,
  inserted integer default 0,
  updated integer default 0,
  missing integer default 0,
  errors integer default 0,
  error_message text
);

create index if not exists scan_runs_started_at_idx on scan_runs (started_at desc);
