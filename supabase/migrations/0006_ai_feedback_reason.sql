alter table public.work_logs
  add column if not exists ai_feedback text;
