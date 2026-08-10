# PrepNexa — API Design

Two surfaces: **Route Handlers** (the primary JSON API, used by the interview
and resume clients) and **Server Actions** (form-centric mutations with
`revalidatePath`). Both share validation schemas, the rate limiter, the security
layer, and the cloud AI router.

## Auth (Server Actions)
| action | purpose |
| --- | --- |
| `loginAction(formData)` | email/password sign-in |
| `signupAction(formData)` | create account (Supabase Auth) |
| `forgotPasswordAction(formData)` | reset link |
| `updatePasswordAction(formData)` | set new password |
| `signOutAction()` | end session |

## Route Handlers

### POST /api/interview/start
Create an interview session.
- body: `{ jobRole?, jobDescription?, resumeText?, resumeFileName? }`
- validated by `startInterviewSchema`.
- Returns `201 { interviewId }`.

### POST /api/interview/opening
Generate & persist the opening question (idempotent — returns existing first question).
- body: `{ interviewId }`
- Returns `{ message, category, questionId }`.

### POST /api/interview/respond
Persist the candidate's answer, run analysis, return Alex's next question.
- body:
```jsonc
{
  "interviewId": "uuid",
  "answer": "string",            // transcript or typed text
  "previousMessages": [ { "role": "user|assistant", "content": "…", "category": "…", "isFollowUp": false } ],
  // optional per-answer telemetry (validated, clamped):
  "speech": {
    "transcript": "…",
    "audioDurationSec": 12.4,
    "wordsPerMinute": 145.2,
    "pauseCount": 3,
    "avgPauseSec": 1.1,
    "fillerWordCount": 5,
    "fillerDensity": 4.1,
    "fluencyScore": 0.74,
    "transcriptionSource": "web_speech"
  },
  "vision": {
    "durationSec": 11.8,
    "sampleCount": 236,
    "eyeContactPct": 82.0,
    "blinkCount": 9,
    "blinkRatePerMin": 45.8,
    "avgConfidence": 71.0,
    "confidenceSamples": 236,
    "headPitchAvg": 2.1,
    "headYawAvg": 3.4,
    "headRollAvg": -1.2,
    "smilePct": 41.0,
    "postureScore": 0.86
  }
}
```
- Behavior:
  1. Zod-validate; reject `answer` with prompt-injection guard.
  2. Persist answer onto the last asked question.
  3. Persist `speech_metrics` and `vision_metrics` (clamped + validated).
  4. **Semantic scoring** runs concurrently with next-question generation:
     `evaluateAnswer` blends pythonai embedding cosine with an LLM judgment
     (0.35·cosine + 0.65·LLM) and persists `score` + `feedback` on the answered
     question. Best-effort — never blocks or fails the main flow.
  5. Build conversation history, call the LLM provider with adaptive difficulty
     + no-repeat constraint.
  6. Persist the next question; if completion phrase → mark interview completed.
- Returns `{ message, category, isFollowUp, isComplete, questionId }`.

### POST /api/interview/feedback
Generate and persist the full feedback report.
- body: `{ interviewId, history: [{ role, content }] }`
- Behavior:
  - Loads the per-question `speech_metrics` + `vision_metrics` persisted during
    the interview (`loadInterviewTelemetry`) and passes them to the LLM so the
    report's confidence/eye-contact/body-language/speaking-speed scores derive
    from real data, not transcript tone alone.
  - **Sync path** (`FEEDBACK_QUEUE=off`, default): runs the LLM feedback pass →
    validate via `feedbackReportSchema` → persist `feedback_reports` + normalized
    columns on `interviews` → mark completed. Returns `{ feedback }`.
  - **Queued path** (`FEEDBACK_QUEUE=redis`): pushes the job (with telemetry) to a
    Redis list and returns `{ queued: true, jobId }` immediately. A worker polls
    `/api/feedback-worker`; the client polls `{ jobId }` via the status endpoint.
- Returns `{ feedback }` (sync) or `{ queued, jobId }` (queued).

### GET /api/interview/feedback/status?jobId=…
Poll whether a queued feedback job has finished.
- Auth required.
- Returns `{ done: boolean }`.

### GET /api/feedback-worker
Drain the Redis feedback queue. Not called by the browser — invoked by a cron
(Vercel Cron, PM2 `cron_restart`, or a container loop).
- Requires the `x-worker-secret` header matching `FEEDBACK_WORKER_SECRET`.
- Returns `{ processed }`.

### POST /api/analysis/transcribe
WAV upload → Faster Whisper transcript + speech metrics (proxies to pythonai).
- `multipart/form-data`: `audio` (WAV, ≤10MB).
- Returns `{ transcript, wordsPerMinute, pauseCount, avgPauseSec, fillerWordCount, fillerDensity, fluencyScore }`.

### POST /api/analysis/semantic
Embedding / semantic scoring (proxies to pythonai sentence-transformers).
- body: `{ question, answer, role?, resumeContext? }`
- Returns `{ cosine, semanticScore }` for the LLM to blend with reasoning.

### POST /api/upload-resume
PDF upload → parse + store (unchanged contract, hardened validation).

## Error Contract
- `400` validation / injection attempt
- `401` unauthenticated
- `403` resource belongs to another user / plan limit reached
- `404` not found
- `409` interview already ended
- `429` rate limited
- `500` provider / analysis failure (mapped to a friendly message; never raw provider errors)

## AI Router Interface (`lib/ai/ai-router.ts`)

The app never calls a provider SDK directly. Every AI request goes through
`createLLMProvider()` (`services/llm/provider.ts`), which adapts the legacy
`ILLMProvider` interface to the cloud router. The router:

1. Classifies the request by **task** (`interview_question`, `interview_feedback`,
   `semantic_scoring`, `resume_analysis`, `job_match`, `resume_improvement`).
2. Selects the best provider + model from `lib/ai/ai-config.ts` (Groq first for
   latency-sensitive text; Gemini first for long-context JSON), sorting candidate
   providers by explicit `priority` — never registration order.
3. Retries transient failures with **bounded** exponential backoff + jitter
   (`retry-manager.ts`), honoring `Retry-After` when the provider supplies it.
4. Fails over across providers (Groq → Gemini → Cloudflare → OpenRouter) and
   honors provider cooldowns (`provider-health.ts`). A `quota` error puts a
   provider on a longer cooldown (deprioritization); a success clears cooldown.
5. Applies a **per-user AI budget** guardrail (`checkAiBudget`,
   `AI_DAILY_BUDGET` / `AI_HOURLY_BUDGET`) when a `userId` is threaded through
   `RouteOptions` / `ChatOptions.userId`.
6. Logs usage to `ai_usage_logs` for cost control (`lib/usage.ts`).

When every provider fails, the router throws a stable
`AIError("response", "All AI providers are temporarily unavailable")` — the
internal reason is preserved for telemetry but never shown to the user.

Errors thrown are `AIError` (`lib/ai/ai-types.ts`) with kinds:
`unreachable | timeout | rate_limited | server_error | invalid_response | quota | config | response`.
The user-facing layer maps every AI error to a calm, friendly message
(`lib/ai/friendly-errors.ts`) — never exposing provider names or HTTP codes.

## Usage & plan enforcement
- Free users: **1 AI mock interview** and **3 resume checks**, enforced
  server-side in `lib/usage.ts` (DB-backed). New interviews after the free one
  return `403` with a friendly upgrade message.
- Premium (Pro, PKR 499/month) is verified only via the payment webhook
  (`lib/payments/webhook.ts`).

## Payments API (multi-provider, Safepay primary)
- `POST /api/payments/checkout` — authenticated; creates a checkout session via
  the configured provider and returns `{ checkoutUrl, sessionId, provider }`.
  Provider chosen from `PAYMENT_PROVIDER` env. Safepay uses the official Express
  Checkout flow (payment session → client passport token → hosted checkout URL).
- `POST /api/payments/webhook` — the ONLY place premium is activated. Provider
  inferred from `x-payment-provider` header (defaults to `PAYMENT_PROVIDER`).
  - **Safepay** verifies the `X-SFPY-SIGNATURE` header (HMAC-SHA512 of the
    JSON-stringified body with the endpoint shared secret). Only
    `payment.succeeded` events activate premium; the `tracker` (a plain string
    in `data`) is the transaction id, and the user is resolved from the
    `data.metadata.userId` we attach at session creation (with
    `data.customer_email` as a fallback).
  - **Stripe** verifies the `stripe-signature` header via the SDK.
  - **Manual** requires the `x-manual-secret` shared secret.
- Webhook processing is **idempotent**: every verified event is recorded in
  `payment_transactions` with a unique `(provider, transaction_id, event_type)`
  constraint. Replayed / duplicate deliveries are skipped, so a single payment
  can never grant more than one subscription period. (Apply
  `supabase/migration_safepay_payments.sql` for this table.)
- `payment_transactions` is an audit ledger of every processed event (status:
  succeeded / failed / pending / cancelled / expired).
