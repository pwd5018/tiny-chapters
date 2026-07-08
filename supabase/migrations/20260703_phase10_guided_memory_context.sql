alter table public.memories
  add column if not exists guided_context jsonb;
