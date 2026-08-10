create table if not exists public.weekly_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  ai_summary text not null,
  created_at timestamptz not null default now()
);

alter table public.weekly_summaries enable row level security;

drop policy if exists "Users can read own weekly summaries" on public.weekly_summaries;
create policy "Users can read own weekly summaries" on public.weekly_summaries for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can create own weekly summaries" on public.weekly_summaries;
create policy "Users can create own weekly summaries" on public.weekly_summaries for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can update own weekly summaries" on public.weekly_summaries;
create policy "Users can update own weekly summaries" on public.weekly_summaries for update to authenticated using (auth.uid() = user_id);
