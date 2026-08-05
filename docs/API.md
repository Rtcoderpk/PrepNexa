# InterviewIQ AI — API Design

Two surfaces: **Route Handlers** (the primary JSON API, used by the interview
client) and **Server Actions** (form-centric mutations with `revalidatePath`).
Both share validation schemas, the rate limiter, the security layer, and the LLM
provider.

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
- `403` resource belongs to another user
- `404` not found
- `409` interview already ended
- `429` rate limited
- `500` provider / analysis failure
- `503` Ollama unreachable (clear setup message, never silent cloud fallback)

## LLM Provider Interface (`services/llm/types.ts`)
```ts
interface EmbeddingResult {
  embedding: number[];
  model: string;
}

interface ILLMProvider {
  chat(options: ChatOptions): Promise<string>;           // non-streaming
  stream?(options: ChatOptions): AsyncIterable<string>;  // streaming (future)
  embed(text: string): Promise<EmbeddingResult>;
  ping(): Promise<boolean>;                              // health check
}

class LLMError extends Error {
  kind: "unreachable" | "timeout" | "response" | "config";
}
```
`createLLMProvider()` returns `OllamaProvider` (env-driven model, default
`qwen3:8b`). `createEmbeddingProvider()` returns an embedding-only provider
(default `nomic-embed-text`). Future engines (`VllmProvider`, `LmStudioProvider`)
implement the same interface; only the factory changes. When Ollama is
unreachable, calls throw `LLMError(kind: "unreachable")` — there is deliberately
no silent cloud fallback.
