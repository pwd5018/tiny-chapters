create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  prompt text not null,
  text text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_photo_refs (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  photo_id text not null,
  source text not null check (source in ('nas', 'local', 'mock')),
  path text not null,
  content_hash text,
  attached_at timestamptz not null default now()
);

create index if not exists memories_user_id_date_idx
  on public.memories (user_id, date desc, created_at desc);

create index if not exists memory_photo_refs_memory_id_idx
  on public.memory_photo_refs (memory_id);

create index if not exists memory_photo_refs_user_id_idx
  on public.memory_photo_refs (user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, null)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists memories_set_updated_at on public.memories;
create trigger memories_set_updated_at
before update on public.memories
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.memories enable row level security;
alter table public.memory_photo_refs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "memories_crud_own" on public.memories;
create policy "memories_crud_own"
on public.memories
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "memory_photo_refs_crud_own" on public.memory_photo_refs;
create policy "memory_photo_refs_crud_own"
on public.memory_photo_refs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into public.profiles (id, display_name)
select u.id, null
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
