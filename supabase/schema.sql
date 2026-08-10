-- =============================================================
-- PrepNexa - Database Schema
-- Run this in the Supabase SQL Editor.
-- =============================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- PROFILES
-- -------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', null),
    coalesce(new.raw_user_meta_data->>'avatar_url', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;

create policy "Profiles are viewable by the owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are updatable by the owner"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Profiles are insertable by the owner"
  on public.profiles for insert
  with check (auth.uid() = id);

-- -------------------------------------------------------------
-- RESUME FILES
-- -------------------------------------------------------------
create table public.resume_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size integer not null,
  extracted_text text,
  created_at timestamptz not null default now()
);

alter table public.resume_files enable row level security;

create policy "Resume files are viewable by the owner"
  on public.resume_files for select
  using (auth.uid() = user_id);

create policy "Resume files are insertable by the owner"
  on public.resume_files for insert
  with check (auth.uid() = user_id);

create policy "Resume files are updatable by the owner"
  on public.resume_files for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Resume files are deletable by the owner"
  on public.resume_files for delete
  using (auth.uid() = user_id);

-- -------------------------------------------------------------
-- INTERVIEWS
-- -------------------------------------------------------------
create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_role text,
  job_description text,
  type text not null default 'behavioral'
    check (type in ('behavioral', 'coding')),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed')),
  overall_score integer,
  summary text,
  strengths text[] default '{}',
  weaknesses text[] default '{}',
  areas_to_improve text[] default '{}',
  star_evaluation text,
  hiring_recommendation text,
  improvement_roadmap text,
  technical_score integer,
  communication_score integer,
  confidence_score integer,
  grammar_score integer,
  speaking_speed_score integer,
  eye_contact_score integer,
  body_language_score integer,
  resume_file_id uuid references public.resume_files(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index interviews_user_id_idx on public.interviews(user_id);
create index interviews_created_at_idx on public.interviews(created_at desc);

alter table public.interviews enable row level security;

create policy "Interviews are viewable by the owner"
  on public.interviews for select
  using (auth.uid() = user_id);

create policy "Interviews are insertable by the owner"
  on public.interviews for insert
  with check (auth.uid() = user_id);

create policy "Interviews are updatable by the owner"
  on public.interviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Interviews are deletable by the owner"
  on public.interviews for delete
  using (auth.uid() = user_id);

-- -------------------------------------------------------------
-- INTERVIEW QUESTIONS
-- -------------------------------------------------------------
create table public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  question text not null,
  answer text,
  difficulty integer not null default 1
    check (difficulty between 1 and 3),
  score integer,
  feedback text,
  is_follow_up boolean not null default false,
  created_at timestamptz not null default now()
);

create index interview_questions_interview_id_idx on public.interview_questions(interview_id);
create index interview_questions_user_id_idx on public.interview_questions(user_id);

alter table public.interview_questions enable row level security;

create policy "Interview questions are viewable by the owner"
  on public.interview_questions for select
  using (auth.uid() = user_id);

create policy "Interview questions are insertable by the owner"
  on public.interview_questions for insert
  with check (auth.uid() = user_id);

create policy "Interview questions are updatable by the owner"
  on public.interview_questions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Interview questions are deletable by the owner"
  on public.interview_questions for delete
  using (auth.uid() = user_id);

-- -------------------------------------------------------------
-- STORAGE BUCKET
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create policy "Resume files are viewable by the owner"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Resume files are uploadable by the owner"
  on storage.objects for insert
  with check (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Resume files are deletable by the owner"
  on storage.objects for delete
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- -------------------------------------------------------------
-- UPDATED_AT TRIGGER (interviews, profiles)
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

drop trigger if exists interviews_set_updated_at on public.interviews;
create trigger interviews_set_updated_at
  before update on public.interviews
  for each row execute procedure public.set_updated_at();

-- -------------------------------------------------------------
-- SPEECH METRICS (one row per answered question)
-- -------------------------------------------------------------
create table public.speech_metrics (
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

create index speech_metrics_question_id_idx on public.speech_metrics(question_id);

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
-- VISION METRICS (one row per answered question)
-- -------------------------------------------------------------
create table public.vision_metrics (
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

create index vision_metrics_question_id_idx on public.vision_metrics(question_id);

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
-- FEEDBACK REPORTS (full structured report, JSONB)
-- -------------------------------------------------------------
create table public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null unique references public.interviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index feedback_reports_user_id_idx on public.feedback_reports(user_id);

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
