alter table public.table_sessions
  add column if not exists internal_note text;

alter table public.table_sessions
  add constraint table_sessions_internal_note_length
  check (internal_note is null or char_length(internal_note) <= 500);
