-- ARISE sync table. One row per player. Row-level security means each signed-in player
-- can read, write and delete only their own row. Mood and cycle data are never sent here.
create table if not exists public.arise_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.arise_saves enable row level security;

drop policy if exists "arise own select" on public.arise_saves;
drop policy if exists "arise own insert" on public.arise_saves;
drop policy if exists "arise own update" on public.arise_saves;
drop policy if exists "arise own delete" on public.arise_saves;

create policy "arise own select" on public.arise_saves for select to authenticated using (auth.uid() = user_id);
create policy "arise own insert" on public.arise_saves for insert to authenticated with check (auth.uid() = user_id);
create policy "arise own update" on public.arise_saves for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "arise own delete" on public.arise_saves for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.arise_saves to authenticated;
