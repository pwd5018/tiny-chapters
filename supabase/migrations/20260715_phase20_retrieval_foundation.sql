create table if not exists public.memory_entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('tag', 'person', 'place', 'project', 'topic')),
  canonical_name text not null,
  normalized_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memory_entities_user_kind_normalized_unique unique (user_id, kind, normalized_name)
);

create table if not exists public.memory_entity_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.memory_entities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz not null default now(),
  constraint memory_entity_aliases_user_kind_normalized_unique
    unique (user_id, normalized_alias)
);

create table if not exists public.memory_entity_memberships (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories (id) on delete cascade,
  entity_id uuid not null references public.memory_entities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  constraint memory_entity_memberships_unique unique (memory_id, entity_id)
);

create index if not exists memory_entities_user_kind_idx
  on public.memory_entities (user_id, kind, normalized_name);

create index if not exists memory_entity_aliases_entity_id_idx
  on public.memory_entity_aliases (entity_id);

create index if not exists memory_entity_aliases_user_normalized_idx
  on public.memory_entity_aliases (user_id, normalized_alias);

create index if not exists memory_entity_memberships_entity_id_idx
  on public.memory_entity_memberships (entity_id);

create index if not exists memory_entity_memberships_memory_id_idx
  on public.memory_entity_memberships (memory_id);

create index if not exists memory_entity_memberships_user_id_idx
  on public.memory_entity_memberships (user_id);

drop trigger if exists memory_entities_set_updated_at on public.memory_entities;
create trigger memory_entities_set_updated_at
before update on public.memory_entities
for each row
execute function public.set_updated_at();

alter table public.memory_entities enable row level security;
alter table public.memory_entity_aliases enable row level security;
alter table public.memory_entity_memberships enable row level security;

drop policy if exists "memory_entities_crud_own" on public.memory_entities;
create policy "memory_entities_crud_own"
on public.memory_entities
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "memory_entity_aliases_crud_own" on public.memory_entity_aliases;
create policy "memory_entity_aliases_crud_own"
on public.memory_entity_aliases
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "memory_entity_memberships_crud_own" on public.memory_entity_memberships;
create policy "memory_entity_memberships_crud_own"
on public.memory_entity_memberships
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Backfill only confirmed Phase 19 values. Pending or rejected suggestions are excluded.
with source_values as (
  select m.id as memory_id, m.user_id, 'tag'::text as kind, value
  from public.memories m cross join lateral unnest(coalesce(m.tags, '{}')) as value
  union all
  select mm.memory_id, mm.user_id, field_group.field_kind, value
  from public.memory_metadata mm
  cross join lateral (
    values
      ('person'::text, mm.people),
      ('place'::text, mm.places),
      ('project'::text, mm.projects),
      ('topic'::text, mm.topics)
  ) as field_group(field_kind, field_values)
  cross join lateral unnest(coalesce(field_group.field_values, '{}')) as value
), normalized as (
  select distinct
    memory_id,
    user_id,
    kind,
    trim(value) as value,
    lower(regexp_replace(trim(value), '\s+', ' ', 'g')) as normalized_value
  from source_values
  where trim(value) <> ''
)
insert into public.memory_entities (user_id, kind, canonical_name, normalized_name)
select user_id, kind, min(value), normalized_value
from normalized
group by user_id, kind, normalized_value
on conflict (user_id, kind, normalized_name) do nothing;

with source_values as (
  select m.id as memory_id, m.user_id, 'tag'::text as kind, value
  from public.memories m cross join lateral unnest(coalesce(m.tags, '{}')) as value
  union all
  select mm.memory_id, mm.user_id, field_group.field_kind, value
  from public.memory_metadata mm
  cross join lateral (
    values
      ('person'::text, mm.people),
      ('place'::text, mm.places),
      ('project'::text, mm.projects),
      ('topic'::text, mm.topics)
  ) as field_group(field_kind, field_values)
  cross join lateral unnest(coalesce(field_group.field_values, '{}')) as value
), normalized as (
  select distinct memory_id, user_id, kind, trim(value) as value,
    lower(regexp_replace(trim(value), '\s+', ' ', 'g')) as normalized_value
  from source_values
  where trim(value) <> ''
)
insert into public.memory_entity_memberships (memory_id, entity_id, user_id)
select normalized.memory_id, entities.id, normalized.user_id
from normalized
join public.memory_entities entities
  on entities.user_id = normalized.user_id
 and entities.kind = normalized.kind
 and entities.normalized_name = normalized.normalized_value
on conflict (memory_id, entity_id) do nothing;
