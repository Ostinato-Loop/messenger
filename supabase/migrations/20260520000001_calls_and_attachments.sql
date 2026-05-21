-- ============================================================
-- Loop Messenger — V1: calls table  |  V2: attachments bucket
-- Run in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Calls table (V1 completion)
create table if not exists public.calls (
  id           uuid primary key default gen_random_uuid(),
  chat_id      uuid not null references public.chats(id) on delete cascade,
  caller_id    uuid not null,
  callee_id    uuid,
  type         text not null check (type in ('voice', 'video')),
  status       text not null default 'initiated'
               check (status in ('initiated', 'ringing', 'active', 'ended', 'missed', 'declined')),
  started_at   timestamptz not null default now(),
  answered_at  timestamptz,
  ended_at     timestamptz,
  duration_sec integer,
  peer_name    text,
  created_at   timestamptz not null default now()
);

alter table public.calls enable row level security;

create policy "calls_select" on public.calls for select
  using (
    caller_id = auth.uid() or
    callee_id = auth.uid() or
    exists (
      select 1 from public.chat_members
      where chat_id = calls.chat_id and user_id = auth.uid()
    )
  );

create policy "calls_insert" on public.calls for insert
  with check (caller_id = auth.uid());

create policy "calls_update" on public.calls for update
  using (caller_id = auth.uid() or callee_id = auth.uid());

create index if not exists calls_chat_id_idx    on public.calls(chat_id);
create index if not exists calls_caller_id_idx  on public.calls(caller_id);
create index if not exists calls_started_at_idx on public.calls(started_at desc);

-- Enable realtime for calls
alter publication supabase_realtime add table public.calls;


-- 2. Storage bucket for attachments (V2)
-- Creates the "attachments" bucket if it doesn't exist
insert into storage.buckets (id, name, public)
  values ('attachments', 'attachments', true)
  on conflict (id) do nothing;

-- Policy: authenticated users can upload to their own folder
create policy "attachments_upload" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'attachments');

-- Policy: anyone can read public attachments
create policy "attachments_read" on storage.objects for select
  using (bucket_id = 'attachments');

-- Policy: users can delete their own uploads
create policy "attachments_delete" on storage.objects for delete
  to authenticated
  using (bucket_id = 'attachments' and auth.uid()::text = (storage.foldername(name))[1]);
