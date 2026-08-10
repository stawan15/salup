alter table public.work_logs
  add column if not exists ai_rating smallint;

alter table public.work_logs
  drop constraint if exists work_logs_ai_rating_check;

alter table public.work_logs
  add constraint work_logs_ai_rating_check check (ai_rating is null or ai_rating between 1 and 5);
