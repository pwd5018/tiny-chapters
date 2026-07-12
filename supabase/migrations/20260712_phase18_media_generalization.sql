alter table public.memory_photo_refs
  add column if not exists media_kind text not null default 'photo',
  add column if not exists duration_ms bigint,
  add column if not exists mime_type text,
  add column if not exists poster_path text,
  add column if not exists poster_local_uri text;

alter table public.memory_photo_refs
  drop constraint if exists memory_photo_refs_media_kind_check;

alter table public.memory_photo_refs
  add constraint memory_photo_refs_media_kind_check
  check (media_kind in ('photo', 'video', 'voice'));

comment on column public.memory_photo_refs.media_kind is
  'Generalized attachment kind. Existing rows default to photo so legacy flows continue unchanged.';

comment on column public.memory_photo_refs.duration_ms is
  'Optional duration for time-based attachments such as video and future voice notes.';

comment on column public.memory_photo_refs.mime_type is
  'Optional MIME type captured from the attachment source when available.';

comment on column public.memory_photo_refs.poster_path is
  'Optional durable preview or poster reference for non-photo media.';

comment on column public.memory_photo_refs.poster_local_uri is
  'Optional temporary device-local poster preview for non-photo media.';
