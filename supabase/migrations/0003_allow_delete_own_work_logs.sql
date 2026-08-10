drop policy if exists "Users can delete own work logs" on public.work_logs;

create policy "Users can delete own work logs"
on public.work_logs
for delete
to authenticated
using (auth.uid() = user_id);
