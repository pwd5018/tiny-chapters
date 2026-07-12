create table if not exists public.memory_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('vacation', 'school_year', 'holiday', 'kid_chapter', 'custom')),
  description text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_collection_memberships (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.memory_collections (id) on delete cascade,
  memory_id uuid not null references public.memories (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  constraint memory_collection_memberships_unique unique (collection_id, memory_id)
);

create index if not exists memory_collections_user_id_created_at_idx
  on public.memory_collections (user_id, created_at desc);

create index if not exists memory_collections_user_id_kind_idx
  on public.memory_collections (user_id, kind, start_date desc, created_at desc);

create index if not exists memory_collection_memberships_collection_id_idx
  on public.memory_collection_memberships (collection_id);

create index if not exists memory_collection_memberships_memory_id_idx
  on public.memory_collection_memberships (memory_id);

create index if not exists memory_collection_memberships_user_id_idx
  on public.memory_collection_memberships (user_id);

drop trigger if exists memory_collections_set_updated_at on public.memory_collections;
create trigger memory_collections_set_updated_at
before update on public.memory_collections
for each row
execute function public.set_updated_at();

alter table public.memory_collections enable row level security;
alter table public.memory_collection_memberships enable row level security;

drop policy if exists "memory_collections_crud_own" on public.memory_collections;
create policy "memory_collections_crud_own"
on public.memory_collections
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "memory_collection_memberships_crud_own" on public.memory_collection_memberships;
create policy "memory_collection_memberships_crud_own"
on public.memory_collection_memberships
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
