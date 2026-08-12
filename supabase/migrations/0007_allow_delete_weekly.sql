drop policy if exists "Users can delete own weekly summaries" on public.weekly_summaries;

create policy "Users can delete own weekly summaries"
on public.weekly_summaries
for delete
to authenticated
using (auth.uid() = user_id);
