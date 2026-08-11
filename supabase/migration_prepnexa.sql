-- =============================================================
-- PrepNexa — Incremental migration for the live Supabase project
-- =============================================================
-- Run this ENTIRE block in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- It is idempotent: safe to re-run.
--
-- Adds:
--   1. profiles: free_interview_used, resume_analysis_count, is_premium
--   2. subscriptions      (premium plan records)
--   3. resume_analyses    (ATS / quality / job-match reports)
--   4. ai_usage_logs      (request logging / cost control)
--   5. provider_health    (durable provider telemetry, written by the AI router)
-- =============================================================

-- -------------------------------------------------------------
-- 1. PROFILES — plan + usage columns
-- -------------------------------------------------------------
alter table public.profiles
  add column if not exists free_interview_used boolean not null default false;

alter table public.profiles
  add column if not exists resume_analysis_count integer not null default 0;

alter table public.profiles
  add column if not exists is_premium boolean not null default false;

-- -------------------------------------------------------------
-- 2. SUBSCRIPTIONS
-- -------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan text not null default 'pro',
  status text not null default 'active'
    check (status in ('active', 'cancelled', 'expired', 'past_due', 'trialing')),
  provider text not null,
  transaction_id text,
  start_date timestamptz not null default now(),
  expiry_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_status_idx on public.subscriptions(status);

alter table public.subscriptions enable row level security;

create policy "Subscriptions are viewable by the owner"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Subscriptions are insertable by the owner"
  on public.subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Subscriptions are updatable by the owner"
  on public.subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 3. RESUME ANALYSES
-- -------------------------------------------------------------
create table if not exists public.resume_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_file_id uuid references public.resume_files(id) on delete set null,
  ats_score integer,
  quality_score integer,
  job_match_score integer,
  has_job_description boolean not null default false,
  report jsonb,
  created_at timestamptz not null default now()
);

create index if not exists resume_analyses_user_id_idx on public.resume_analyses(user_id);
create index if not exists resume_analyses_created_at_idx on public.resume_analyses(created_at desc);

alter table public.resume_analyses enable row level security;

create policy "Resume analyses are viewable by the owner"
  on public.resume_analyses for select
  using (auth.uid() = user_id);

create policy "Resume analyses are insertable by the owner"
  on public.resume_analyses for insert
  with check (auth.uid() = user_id);

create policy "Resume analyses are deletable by the owner"
  on public.resume_analyses for delete
  using (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 4. AI USAGE LOGS (cost control / abuse monitoring)
-- -------------------------------------------------------------
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  task text not null,
  provider text,
  model text,
  success boolean not null default true,
  error_kind text,
  latency_ms integer,
  created_at timestamptz not null default now()
);

-- Observability: retry + fallback telemetry (added by P1 hardening).
alter table public.ai_usage_logs add column if not exists attempts integer not null default 0;
alter table public.ai_usage_logs add column if not exists fallback_from text;
alter table public.ai_usage_logs add column if not exists fallback_to text;

-- Observability: token-cost telemetry (added by P3 — nullable, providers may not expose usage).
alter table public.ai_usage_logs add column if not exists prompt_tokens integer;
alter table public.ai_usage_logs add column if not exists completion_tokens integer;
alter table public.ai_usage_logs add column if not exists total_tokens integer;

create index if not exists ai_usage_logs_user_id_idx on public.ai_usage_logs(user_id);
create index if not exists ai_usage_logs_created_at_idx on public.ai_usage_logs(created_at desc);

alter table public.ai_usage_logs enable row level security;

create policy "AI usage logs are viewable by the owner"
  on public.ai_usage_logs for select
  using (auth.uid() = user_id);

create policy "AI usage logs are insertable by the owner"
  on public.ai_usage_logs for insert
  with check (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 5. PROVIDER HEALTH (durable telemetry, written by the AI router)
-- -------------------------------------------------------------
create table if not exists public.provider_health (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  rate_limited_count integer not null default 0,
  average_latency_ms integer,
  last_failure_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists provider_health_provider_idx on public.provider_health(provider);

alter table public.provider_health enable row level security;

-- Only trusted server contexts write provider health; owners can read their own
-- usage but provider telemetry is aggregate — restrict reads to nothing by default.
create policy "Provider health is not directly readable by users"
  on public.provider_health for select
  using (false);

-- -------------------------------------------------------------
-- updated_at trigger for subscriptions
-- -------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute procedure public.set_updated_at();
