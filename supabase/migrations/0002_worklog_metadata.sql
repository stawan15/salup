alter table public.work_logs
  add column if not exists category text not null default 'ทั่วไป',
  add column if not exists voice_mode text not null default 'neutral',
  add column if not exists output_mode text not null default 'report';
