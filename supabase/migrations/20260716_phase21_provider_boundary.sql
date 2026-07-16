create table if not exists public.memory_provider_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_key text not null,
  provider_label text not null,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz,
  constraint memory_provider_grants_user_provider_unique unique (user_id, provider_key)
);

create table if not exists public.memory_provider_access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  grant_id uuid references public.memory_provider_grants (id) on delete set null,
  provider_key text not null,
  operation text not null,
  scope text not null,
  query_summary text,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists memory_provider_grants_user_status_idx
  on public.memory_provider_grants (user_id, status);

create index if not exists memory_provider_access_logs_user_created_idx
  on public.memory_provider_access_logs (user_id, created_at desc);

alter table public.memory_provider_grants enable row level security;
alter table public.memory_provider_access_logs enable row level security;

drop policy if exists "memory_provider_grants_crud_own" on public.memory_provider_grants;
create policy "memory_provider_grants_crud_own"
on public.memory_provider_grants
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "memory_provider_access_logs_read_own" on public.memory_provider_access_logs;
create policy "memory_provider_access_logs_read_own"
on public.memory_provider_access_logs
for select
using (auth.uid() = user_id);

drop policy if exists "memory_provider_access_logs_insert_own" on public.memory_provider_access_logs;
create policy "memory_provider_access_logs_insert_own"
on public.memory_provider_access_logs
for insert
with check (auth.uid() = user_id);
