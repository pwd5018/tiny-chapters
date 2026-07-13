create table if not exists public.memory_metadata (
  memory_id uuid primary key references public.memories (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  lifecycle_status text not null default 'finalized' check (lifecycle_status in ('draft', 'finalized')),
  is_favorite boolean not null default false,
  importance smallint check (importance between 1 and 3),
  people text[] not null default '{}',
  places text[] not null default '{}',
  projects text[] not null default '{}',
  topics text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memory_metadata_user_id_idx
  on public.memory_metadata (user_id);

create index if not exists memory_metadata_user_id_lifecycle_idx
  on public.memory_metadata (user_id, lifecycle_status);

create index if not exists memory_metadata_user_id_favorite_idx
  on public.memory_metadata (user_id, is_favorite);

drop trigger if exists memory_metadata_set_updated_at on public.memory_metadata;
create trigger memory_metadata_set_updated_at
before update on public.memory_metadata
for each row
execute function public.set_updated_at();

alter table public.memory_metadata enable row level security;

drop policy if exists "memory_metadata_crud_own" on public.memory_metadata;
create policy "memory_metadata_crud_own"
on public.memory_metadata
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into public.memory_metadata (memory_id, user_id)
select m.id, m.user_id
from public.memories m
on conflict (memory_id) do nothing;
