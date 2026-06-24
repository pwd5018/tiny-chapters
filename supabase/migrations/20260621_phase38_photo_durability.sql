alter table public.memory_photo_refs
  add column if not exists filename text,
  add column if not exists taken_at timestamptz,
  add column if not exists file_size bigint,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists local_uri text,
  add column if not exists sync_status text not null default 'linked_to_nas';

alter table public.memory_photo_refs
  drop constraint if exists memory_photo_refs_sync_status_check;

alter table public.memory_photo_refs
  add constraint memory_photo_refs_sync_status_check
  check (
    sync_status in (
      'local_only',
      'pending_nas_match',
      'linked_to_nas',
      'missing',
      'preserved_copy'
    )
  );

comment on column public.memory_photo_refs.local_uri is
  'Device-local URI for temporary phone photo references. This is not durable across devices and should not be treated as permanent storage.';

comment on column public.memory_photo_refs.sync_status is
  'Durability state for the attached photo reference. Local phone photos usually start as pending_nas_match until a later NAS relink step can replace them with durable NAS references.';
