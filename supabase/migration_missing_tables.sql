-- =============================================================
-- PrepNexa — Incremental migration for live Supabase project
-- =============================================================
-- Run this ENTIRE block in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- It is idempotent: safe to re-run.
--
-- Applies the schema additions that exist in schema.sql but are missing
-- from the live project:
--   1. interviews: +10 columns (weaknesses, STAR, hiring rec, roadmap, 7 scores)
--   2. speech_metrics table + index + RLS policies
--   3. vision_metrics table + index + RLS policies
--   4. feedback_reports table + index + RLS policies
-- =============================================================

-- -------------------------------------------------------------
-- 1. INTERVIEWS — add missing columns
-- -------------------------------------------------------------
alter table public.interviews add column if not exists weaknesses text[] default '{}';
alter table public.interviews add column if not exists star_evaluation text;
alter table public.interviews add column if not exists hiring_recommendation text;
alter table public.interviews add column if not exists improvement_roadmap text;
alter table public.interviews add column if not exists technical_score integer;
alter table public.interviews add column if not exists communication_score integer;
alter table public.interviews add column if not exists confidence_score integer;
alter table public.interviews add column if not exists grammar_score integer;
alter table public.interviews add column if not exists speaking_speed_score integer;
alter table public.interviews add column if not exists eye_contact_score integer;
alter table public.interviews add column if not exists body_language_score integer;

-- -------------------------------------------------------------
-- 2. SPEECH METRICS (one row per answered question)
-- -------------------------------------------------------------
create table if not exists public.speech_metrics (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null unique references public.interview_questions(id) on delete cascade,
  transcript text,
  audio_duration_sec numeric,
  words_per_minute numeric,
  pause_count integer,
  avg_pause_sec numeric,
  filler_word_count integer,
  filler_density numeric,
  fluency_score numeric check (fluency_score between 0 and 1),
  transcription_source text not null default 'web_speech'
    check (transcription_source in ('faster_whisper', 'web_speech')),
  created_at timestamptz not null default now()
);

create index if not exists speech_metrics_question_id_idx on public.speech_metrics(question_id);

alter table public.speech_metrics enable row level security;

create policy "Speech metrics are viewable by the interview owner"
  on public.speech_metrics for select
  using (
    exists (
      select 1
      from public.interview_questions q
      join public.interviews i on i.id = q.interview_id
      where q.id = speech_metrics.question_id
        and i.user_id = auth.uid()
    )
  );

create policy "Speech metrics are insertable by the interview owner"
  on public.speech_metrics for insert
  with check (
    exists (
      select 1
      from public.interview_questions q
      join public.interviews i on i.id = q.interview_id
      where q.id = speech_metrics.question_id
        and i.user_id = auth.uid()
    )
  );

create policy "Speech metrics are updatable by the interview owner"
  on public.speech_metrics for update
  using (
    exists (
      select 1
      from public.interview_questions q
      join public.interviews i on i.id = q.interview_id
      where q.id = speech_metrics.question_id
        and i.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.interview_questions q
      join public.interviews i on i.id = q.interview_id
      where q.id = speech_metrics.question_id
        and i.user_id = auth.uid()
    )
  );

-- -------------------------------------------------------------
-- 3. VISION METRICS (one row per answered question)
-- -------------------------------------------------------------
create table if not exists public.vision_metrics (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null unique references public.interview_questions(id) on delete cascade,
  duration_sec numeric,
  sample_count integer,
  eye_contact_pct numeric,
  blink_count integer,
  blink_rate_per_min numeric,
  avg_confidence numeric,
  confidence_samples integer,
  head_pitch_avg numeric,
  head_yaw_avg numeric,
  head_roll_avg numeric,
  smile_pct numeric,
  posture_score numeric check (posture_score between 0 and 1),
  created_at timestamptz not null default now()
);

create index if not exists vision_metrics_question_id_idx on public.vision_metrics(question_id);

alter table public.vision_metrics enable row level security;

create policy "Vision metrics are viewable by the interview owner"
  on public.vision_metrics for select
  using (
    exists (
      select 1
      from public.interview_questions q
      join public.interviews i on i.id = q.interview_id
      where q.id = vision_metrics.question_id
        and i.user_id = auth.uid()
    )
  );

create policy "Vision metrics are insertable by the interview owner"
  on public.vision_metrics for insert
  with check (
    exists (
      select 1
      from public.interview_questions q
      join public.interviews i on i.id = q.interview_id
      where q.id = vision_metrics.question_id
        and i.user_id = auth.uid()
    )
  );

create policy "Vision metrics are updatable by the interview owner"
  on public.vision_metrics for update
  using (
    exists (
      select 1
      from public.interview_questions q
      join public.interviews i on i.id = q.interview_id
      where q.id = vision_metrics.question_id
        and i.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.interview_questions q
      join public.interviews i on i.id = q.interview_id
      where q.id = vision_metrics.question_id
        and i.user_id = auth.uid()
    )
  );

-- -------------------------------------------------------------
-- 4. FEEDBACK REPORTS (full structured report, JSONB)
-- -------------------------------------------------------------
create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null unique references public.interviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists feedback_reports_user_id_idx on public.feedback_reports(user_id);

alter table public.feedback_reports enable row level security;

create policy "Feedback reports are viewable by the owner"
  on public.feedback_reports for select
  using (auth.uid() = user_id);

create policy "Feedback reports are insertable by the owner"
  on public.feedback_reports for insert
  with check (auth.uid() = user_id);

create policy "Feedback reports are deletable by the owner"
  on public.feedback_reports for delete
  using (auth.uid() = user_id);
