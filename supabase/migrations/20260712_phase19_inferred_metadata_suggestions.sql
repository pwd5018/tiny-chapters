create table if not exists public.memory_metadata_suggestions (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  field text not null check (field in ('tag', 'person', 'place', 'project', 'topic')),
  value text not null,
  matched_value text,
  confidence smallint not null check (confidence between 0 and 100),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  provider text,
  model text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists memory_metadata_suggestions_memory_id_status_idx
  on public.memory_metadata_suggestions (memory_id, status, created_at desc);

create index if not exists memory_metadata_suggestions_user_id_idx
  on public.memory_metadata_suggestions (user_id);

alter table public.memory_metadata_suggestions enable row level security;

drop policy if exists "memory_metadata_suggestions_crud_own" on public.memory_metadata_suggestions;
create policy "memory_metadata_suggestions_crud_own"
on public.memory_metadata_suggestions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
