# PrepNexa — Software Architecture Document

## 1. Overview

PrepNexa is a production-grade, **cloud-based** AI career preparation SaaS:
AI mock interviews + a free ATS resume checker + resume analysis + job
description matching. Candidates practice live interviews with an AI
interviewer ("Alex") and receive multi-dimensional feedback covering technical
skill, communication, confidence, speech, eye contact, and body language.

The most important architectural constraint: **the app runs entirely on cloud
AI APIs** (Groq, Gemini, Cloudflare Workers AI, OpenRouter) with automatic
failover. There is **no local AI server, no Ollama, no Qwen, no GPU, and no
model downloads** — users only need a browser. Computer vision runs entirely
**in-browser** via MediaPipe Tasks (WebGL); raw camera frames never leave the
device. Speech transcription is optional (Web Speech API by default, an
optional self-hosted pythonai service for Faster Whisper).

## 2. Goals / Non-Goals

### Goals
- Cloud AI only — multiple legitimate providers behind a single router.
- Provider abstraction so models/providers can change without touching business logic.
- Automatic failover, retries with backoff, provider health tracking, and graceful degradation.
- Server-side usage enforcement (1 free interview, 3 free resume checks, Premium).
- Real-time confidence, eye contact, gaze, blink, head pose, and posture analysis running in-browser (privacy-friendly, zero server cost).
- Multi-dimensional, production-ready feedback and reporting.
- SaaS-grade scalability: stateless API, Docker, Redis-ready, queue-ready.
- SEO-first public marketing site (landing pages, sitemap, robots, JSON-LD).
- Security: server-side API keys, RLS, rate limiting, input validation, prompt-injection protection, env validation.

### Non-Goals (explicitly out of scope for this pass)
- Coding-interview execution (Monaco editor, code execution, AI code review).
- Local/self-hosted inference of any kind.
- Server-side video streaming for CV — deliberately excluded for privacy/scalability.

## 3. Architectural Decisions (ADR summary)

### ADR-1: In-browser MediaPipe for all real-time CV
**Decision:** Face Landmarker + Pose Landmarker run in the browser via
`@mediapipe/tasks-vision` (WebGL). Only *processed metrics* (per-second samples
aggregated into eye contact %, blink rate, average confidence, posture summary)
are POSTed to the backend. Vision results are presented only as interview
presentation indicators — never as judgments of honesty, personality, or
employability.

### ADR-2: Cloud AI router behind an `ILLMProvider` interface
**Decision:** A provider interface (`ILLMProvider`, `services/llm/types.ts`)
with a single production adapter that routes every call through
`lib/ai/ai-router.ts`. The router:
- classifies each request by task (`interview_question`, `interview_feedback`,
  `semantic_scoring`, `resume_analysis`, `job_match`, `resume_improvement`);
- picks the best provider/model from `lib/ai/ai-config.ts` (Groq first for
  latency-sensitive text, Gemini first for long-context JSON-heavy feedback);
- sorts candidate providers by explicit `priority` (Groq → Gemini → Cloudflare
  → OpenRouter), never by registration order;
- retries transient failures with **bounded** exponential backoff + jitter
  (`retry-manager.ts`), honoring `Retry-After` when supplied;
- fails over across providers; honors provider cooldowns (`provider-health.ts`);
  a `quota` error puts a provider on a longer cooldown (deprioritization) and a
  success clears cooldown (recovery);
- applies a **per-user AI budget** guardrail (`lib/usage.ts:checkAiBudget`,
  `AI_DAILY_BUDGET` / `AI_HOURLY_BUDGET`) to cap a single user's consumption;
- guarantees in-flight dedup state is released via `try/finally` even on error;
- surfaces a stable "All AI providers are temporarily unavailable" error when
  every provider fails (internal reason preserved for telemetry), and never
  exposes raw provider errors or API keys (see `friendly-errors.ts`).

Providers live in `lib/ai/providers/*` (groq, gemini, cloudflare, openrouter).
Keys are read server-side only via `lib/env.ts`; Gemini URLs are never logged
with the embedded API key (see `redactedUrl`).

### ADR-3: Next.js Route Handlers are the primary API; Server Actions for forms
Server Actions for auth/setup/upload (native form semantics, revalidation),
Route Handlers for interview/respond/feedback/resume (clean client contract,
works with streaming).

### ADR-4: Optional Python AI service, not a dependency
`pythonai/` (FastAPI: Faster Whisper transcription + sentence-transformer
semantic scoring) is **optional** and degrades gracefully. The app works without
it (Web Speech API + LLM-only semantic scoring). No local AI is required.

### ADR-5: LLM-only answer evaluation
Per-answer semantic scoring uses a cloud LLM judgment of technical correctness,
completeness, and clarity. Embedding-based cosine scoring is optional via
pythonai. Evaluation never blocks or breaks the interview flow.

### ADR-6: Server-side usage + entitlement
Plan limits (1 free interview, 3 free resume checks, Premium) are enforced in
`lib/usage.ts` against the database via an RLS-bypassing admin client. Client
state (localStorage/cookies) is never trusted for enforcement. Payment success
is verified only via `lib/payments/webhook.ts`.

### ADR-7: Multi-provider payments (Safepay primary)
Payments go through a provider seam (`lib/payments/provider.ts`) — business logic
never calls a gateway SDK directly. **Safepay** is the primary provider (Pakistani
+ international card payments, PKR 499/month), implemented with the official
`@sfpy/node-core` SDK in `lib/payments/safepay.ts` (Express Checkout flow).
Stripe and manual modes remain for parity. JazzCash / easypaisa are future
additive providers behind the same interface.
- Checkout is created server-side; the frontend only redirects to the hosted URL.
- Webhook verification is provider-specific (Safepay HMAC-SHA512 via
  `X-SFPY-SIGNATURE`; Stripe SDK; manual shared secret). Only verified webhooks
  activate premium — the browser can never unlock it.
- Webhooks are **idempotent**: events are recorded in `payment_transactions`
  (unique per `provider, transaction_id, event_type`); duplicates/replays are
  skipped so a payment grants at most one subscription period. Subscriptions
  renew manually each month (a new checkout advances `expiry_date` by 30 days);
  `lib/usage.ts` enforces expiry server-side.

## 4. System Diagram

```
┌────────────────────────────┐          ┌──────────────────────────────────────────┐
│   Browser (Next.js app)    │          │              Cloud (Vercel / host)        │
│                            │          │                                          │
│  MediaPipe Tasks (WebGL)   │          │   ┌────────────────────────────────────┐  │
│  Face + Pose Landmarker    │  metrics │   │ Next.js 15 (Route Handlers,        │  │
│  EAR/MAR/gaze/headpose     │ ───────► │   │ Server Actions)                    │  │
│  + blink + posture + conf  │          │   │  ILLMProvider ─► Cloud AI router   │  │
│                            │          │   └───────────────┬────────────────────┘  │
│  Web Speech API (fallback) │          │                   │ HTTP                  │
│  Web Audio capture (WAV)   │          │   ┌───────────────▼────────────────────┐  │
│  Browser TTS               │          │   │ Cloud AI providers                │  │
└────────────┬───────────────┘          │   │  Groq → Gemini → Cloudflare → OR   │  │
             │  audio blob / transcript │   └───────────────┬────────────────────┘  │
             └──────────────────────────►                  │                        │
                                                            │                        │
                                    Supabase Postgres + Storage ◄─── (RLS enforced)  │
                                    subscriptions / usage / resume_analyses          │
```

## 5. Component Responsibilities

| Component | Responsibility |
| --- | --- |
| **Next.js App** | Auth (Supabase), interview orchestration, feedback, resume analysis, dashboard, UI, all business logic. |
| **Cloud AI router** (`lib/ai/`) | Task classification, provider/model selection, retry + failover, health tracking, usage logging. |
| **ILLMProvider adapter** | Uniform chat contract; the only seam to inference providers. |
| **In-browser CV** | Face/pose metrics; emits per-second samples and session aggregates. |
| **pythonai (FastAPI, optional)** | Faster Whisper transcription + speech metrics; sentence-transformer embedding endpoint. |
| **Supabase** | Auth, Postgres (RLS), Storage (resumes), usage/plan/subscription state. |
| **Payments** (`lib/payments/`) | Provider-independent checkout; webhook-verified premium activation. |

## 6. Data Flow — Live Interview

1. Candidate starts from `/setup` (role, job description, or resume).
2. `startInterviewAction` → `createInterview` → `interviews` row (`in_progress`),
   after a server-side usage check (`lib/usage.ts`).
3. `InterviewChat` hydrates existing questions or calls `/api/interview/opening`.
   - Opening generated via the AI router (`buildInterviewerSystemPrompt`).
4. Candidate answers (type, mic, or Web Speech). In parallel, the browser CV
   hook records vision metrics; mic records an audio blob per answer.
5. On send, the client:
   - attaches the final transcript + per-answer audio blob to the respond call;
   - `/api/interview/respond` persists the answer + telemetry FIRST (session
     protection — an AI failure never loses an answer), then generates the next
     question through the router (adaptive difficulty, no repeats), with an
     optional concurrent semantic-scoring pass.
6. Loop until Alex emits the completion phrase.
7. `/api/interview/feedback` generates the full report via the router, persists
   scores, marks interview `completed`.
8. `/interview/[id]/results` renders the report (+ free-interview conversion CTA
   for free users); `/dashboard` aggregates trends and usage.

## 7. Scalability

- **Stateless Next.js instances** behind PM2/Vercel/EC2 autoscaling. All state is
  in Postgres/Redis; no in-memory session requirement.
- **Rate limiter** is pluggable: in-memory map for single instance, Redis-backed
  store (`ioredis`) for horizontal scaling.
- **CV is free** (browser-side) → the dominant cost is cloud AI inference. AI
  requests are minimized (no AI for UI/DB/deterministic work), and a feedback
  queue seam (Redis list in `lib/feedback-queue.ts`) defers slow report
  generation off the request path when `FEEDBACK_QUEUE=redis`.
- **Provider health + cooldowns** prevent wasted calls to failing providers.

## 8. Security

- Cloud AI keys are read **server-side only** (`lib/env.ts`); never shipped to the browser.
- Row Level Security on all tables (owner-scoped select/insert/update/delete).
- Storage policies scoped to `auth.uid()` path prefix.
- Server-side Zod validation on every boundary.
- Prompt-injection guard on candidate answers.
- Environment variable validation at boot — the app refuses to run with missing/invalid config.
- Secure headers: CSP (MediaPipe WASM from pinned CDN), HSTS, X-Frame-Options,
  Referrer-Policy, Permissions-Policy (camera/mic restricted to `(self)`).
- Payment success verified only server-side via signed webhook.
- Rate limiting on auth, upload, interview, feedback, and analysis endpoints.

## 9. Future-proofing (Coding Interviews)

Coding interviews are a later feature. The architecture already accommodates them:

- `interviews.type` column distinguishes `behavioral` vs `coding`.
- `interview_questions` gains optional `code`, `language`, `test_cases`.
- A `code_execution` seam (sandboxed runner) and `code_review` LLM pass plug into
  the existing router and queue infrastructure.
