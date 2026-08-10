# PrepNexa — Database Design

Supabase PostgreSQL. All tables enable Row Level Security and are scoped to the
owning `auth.uid()`. Full DDL lives in `supabase/schema.sql` — this document is
the design reference.

## ER Overview

```
auth.users
   │
   ├── profiles          1:1   (full_name, avatar_url, ...)
   ├── resume_files      N:1   (extracted_text, storage_path, ...)
   │     └── interviews  N:1   (job_role, status, scores, STAR, roadmap, ...)
   │           └── interview_questions   N:1
   │                 └── speech_metrics  N:1   (per answer)
   │                 └── vision_metrics  N:1   (per answer)
   └── feedback_reports  N:1   (detailed structured feedback per interview)
```

## Tables

### profiles
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | = auth.users.id, cascade |
| full_name | text | set from raw_user_meta_data on signup |
| avatar_url | text | |
| created_at / updated_at | timestamptz | |

Trigger `handle_new_user()` auto-creates a row on signup.

### resume_files
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | gen_random_uuid() |
| user_id | uuid FK | cascade |
| storage_path | text | `${user_id}/<uuid>.pdf` in `resumes` bucket |
| file_name | text | original file name |
| file_size | int | bytes |
| extracted_text | text | parsed PDF text (≤15k chars) |
| created_at | timestamptz | |

### interviews
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK | cascade |
| job_role | text | e.g. "Senior Frontend Engineer" |
| job_description | text | pasted JD |
| type | text | `behavioral` (default); future `coding` |
| status | text | `in_progress` / `completed` |
| resume_file_id | uuid FK | nullable, set null on delete |
| — feedback summary — | | |
| overall_score | integer | 0–10 |
| summary | text | 2–4 sentence summary |
| strengths | text[] | |
| weaknesses | text[] | (new; distinct from strengths) |
| areas_to_improve | text[] | kept for backward compatibility |
| star_evaluation | text | STAR breakdown of the best answer |
| hiring_recommendation | text | e.g. "Strong hire" / "No hire" |
| improvement_roadmap | text | personalized action plan |
| — multi-dimensional scores (0–10) — | | |
| technical_score | integer | |
| communication_score | integer | |
| confidence_score | integer | blended CV + speech + LLM |
| grammar_score | integer | |
| speaking_speed_score | integer | |
| eye_contact_score | integer | from CV aggregates |
| body_language_score | integer | from CV aggregates |
| created_at / completed_at | timestamptz | |

Indexes: `(user_id)`, `(created_at desc)`. `updated_at` auto-trigger.

### interview_questions
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| interview_id | uuid FK | cascade |
| user_id | uuid FK | denormalized for easy RLS + queries |
| category | text | introduction/technical/behavioral/scenario/problem_solving |
| question | text | |
| answer | text | candidate's answer (transcript or typed) |
| difficulty | integer | 1–3 (adaptive) — new |
| score | integer | 0–10 |
| feedback | text | |
| is_follow_up | boolean | |
| created_at | timestamptz | |

Indexes: `(interview_id)`, `(user_id)`.

### speech_metrics (new — one row per answered question)
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| question_id | uuid FK | cascade |
| transcript | text | Faster Whisper output (or Web Speech fallback) |
| audio_duration_sec | numeric | |
| words_per_minute | numeric | |
| pause_count | int | detected pauses |
| avg_pause_sec | numeric | |
| filler_word_count | int | um/uh/you know/like… |
| filler_density | numeric | fillers per 100 words |
| fluency_score | numeric | 0–1 composite |
| transcription_source | text | `faster_whisper` / `web_speech` |
| created_at | timestamptz | |

### vision_metrics (new — one row per answered question)
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| question_id | uuid FK | cascade |
| duration_sec | numeric | analyzed window |
| sample_count | int | # of CV frames used |
| eye_contact_pct | numeric | % frames gaze≈centered |
| blink_count | int | |
| blink_rate_per_min | numeric | |
| avg_confidence | numeric | 0–100 |
| confidence_samples | int | |
| head_pitch_avg / head_yaw_avg / head_roll_avg | numeric | degrees |
| smile_pct | numeric | % frames MAR above threshold |
| posture_score | numeric | 0–1 from pose landmarks |
| created_at | timestamptz | |

### feedback_reports (new — full structured report, JSONB)
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| interview_id | uuid FK | cascade, unique |
| user_id | uuid FK | cascade |
| data | jsonb | complete LLM feedback payload (validated) |
| created_at | timestamptz | |

`data` matches the typed `InterviewFeedbackReport` in `types/feedback.ts` and is
validated by `feedbackReportSchema` in `lib/validations.ts` before persistence.
Keeping the raw payload in JSONB preserves fields while the normalized columns
above power dashboards/trends.

### payment_transactions (new — idempotent webhook ledger, Safepay + multi-provider)
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK | nullable, cascade |
| provider | text | safepay / stripe / manual / ... |
| transaction_id | text | e.g. Safepay `tracker.token` |
| event_type | text | e.g. `payment.succeeded` |
| status | text | succeeded / failed / pending / cancelled / expired |
| amount | integer | lowest denomination |
| currency | text | e.g. PKR |
| payload | jsonb | raw webhook payload (audit) |
| processed_at | timestamptz | |
| created_at | timestamptz | |

Every verified webhook event is recorded once. The unique constraint on
`(provider, transaction_id, event_type)` makes webhook processing idempotent:
replayed / duplicate deliveries are skipped so a single payment grants at most
one subscription period. Added by `supabase/migration_safepay_payments.sql`.

## RLS Policy Matrix

All policies use `auth.uid() = <user_id>`.

| table | select | insert | update | delete |
| --- | --- | --- | --- | --- |
| profiles | owner | owner | owner | — |
| resume_files | owner | owner | owner | owner |
| interviews | owner | owner | owner | owner |
| interview_questions | owner | owner | owner | owner |
| speech_metrics | via question→interview owner (join) | owner | owner | — |
| vision_metrics | via question→interview owner (join) | owner | owner | — |
| feedback_reports | owner | owner | owner | — |

**Note on join-scoped RLS:** `speech_metrics`/`vision_metrics` do not store
`user_id`; policies join through `interview_questions → interviews` to the
auth user. This keeps the tables normalized while remaining secure.

## Storage

Bucket `resumes` (private):
- Object path `{user_id}/{uuid}.pdf`
- Select/insert/delete policies check `auth.uid()::text = (storage.foldername(name))[1]`.

## Indexing & Migration Notes

- `interviews(created_at desc)` supports dashboard trends.
- `interviews(user_id)` + `interview_questions(interview_id)` cover all history queries.
- `feedback_reports(interview_id)` unique index.
- Migrations are idempotent (`create if not exists`, `on conflict do nothing`,
  `alter table ... add column if not exists`) so `supabase/schema.sql` can be
  re-run safely.

### Migration run order (live project)

Apply in the Supabase SQL Editor in this order:

1. `supabase/schema.sql` — base schema.
2. `supabase/migration_prepnexa.sql` — plan + usage layer
   (`profiles` columns, `subscriptions`, `resume_analyses`, `ai_usage_logs`,
   `provider_health`).
3. `supabase/migration_missing_tables.sql` — **only needed when upgrading a live
   project** from the pre-PrepNexa schema: adds `interviews` score columns plus
   `speech_metrics` / `vision_metrics` / `feedback_reports` if absent.
4. `supabase/migration_safepay_payments.sql` — `payment_transactions` ledger.

Note: `provider_health` is written by the AI router (`lib/ai/provider-health.ts`
persists in-memory snapshots via `lib/usage.ts`). Usage limits are enforced via
`profiles` + `subscriptions`; there is no `usage_limits` table.
