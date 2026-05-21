-- ─────────────────────────────────────────────────────────────────────────────
-- RALD Auth V1→V5 — phone OTP tables
-- No Supabase Twilio/phone provider used — OTP delivered via Termii API
-- ─────────────────────────────────────────────────────────────────────────────

-- OTP store (server-side, hashed)
create table if not exists rald_phone_otps (
  id          uuid primary key default gen_random_uuid(),
  phone_hash  text not null,
  otp_hash    text not null,
  expires_at  timestamptz not null,
  attempts    int  not null default 0,
  resends     int  not null default 0,
  created_at  timestamptz not null default now()
);

-- Index for fast lookup + expiry cleanup
create index if not exists rald_phone_otps_phone_hash_idx on rald_phone_otps (phone_hash);
create index if not exists rald_phone_otps_expires_at_idx on rald_phone_otps (expires_at);

-- Audit log (append-only)
create table if not exists rald_audit_logs (
  id            uuid primary key default gen_random_uuid(),
  action        text not null,
  resource_type text not null default 'phone_otp',
  resource_id   text,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists rald_audit_logs_action_idx      on rald_audit_logs (action);
create index if not exists rald_audit_logs_resource_id_idx on rald_audit_logs (resource_id);
create index if not exists rald_audit_logs_created_at_idx  on rald_audit_logs (created_at desc);

-- RLS: these tables are server-only (service role key only)
alter table rald_phone_otps  enable row level security;
alter table rald_audit_logs  enable row level security;

-- No public access — only service role bypasses RLS
create policy "service_role_only" on rald_phone_otps
  for all using (false);

create policy "service_role_only" on rald_audit_logs
  for all using (false);

-- Messenger profiles: ensure phone column exists
alter table messenger_profiles
  add column if not exists phone text;

-- Index for profile lookups by phone
create index if not exists messenger_profiles_phone_idx
  on messenger_profiles (phone);
