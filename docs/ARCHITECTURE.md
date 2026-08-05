# InterviewIQ AI — Software Architecture Document

## 1. Overview

InterviewIQ AI is a production-grade, **fully self-hosted** AI mock interview SaaS.
Candidates practice live interviews with an AI interviewer ("Alex") and receive
multi-dimensional feedback covering technical skill, communication, confidence,
speech, eye contact, and body language.

The most important architectural constraint is: **zero dependence on any paid
cloud LLM**. All inference runs locally through Ollama (default model `qwen3:8b`).
Computer vision runs entirely **in-browser** via MediaPipe Tasks (WebGL); raw
camera frames never leave the user's device. Speech transcription runs on a
separate self-hosted Python service (Faster Whisper). The only infrastructure
cost is the operator's own server.

## 2. Goals / Non-Goals

### Goals
- Fully self-hosted AI (Ollama + Qwen3), no API keys, no cloud LLM dependency.
- Provider abstraction so models/inference engines can change without touching business logic.
- Real-time confidence, eye contact, gaze, blink, head pose, and posture analysis running in-browser (privacy-friendly, zero server cost, horizontal scaling).
- Speech analysis via Faster Whisper on a dedicated Python service.
- Multi-dimensional, production-ready feedback and reporting.
- SaaS-grade scalability: stateless API, Docker, Redis-ready, queue-ready.
- Security: RLS, rate limiting, input validation, prompt-injection protection, env validation.

### Non-Goals (explicitly out of scope for this pass)
- Coding-interview execution (Monaco editor, code execution, AI code review) — architecture leaves a clean seam, UI ships later.
- Paid cloud LLM fallback — deliberately excluded by design decision.
- Server-side video streaming for CV — deliberately excluded for privacy/scalability.

## 3. Architectural Decisions (ADR summary)

### ADR-1: In-browser MediaPipe for all real-time CV
**Decision:** Face Landmarker + Pose Landmarker run in the browser via
`@mediapipe/tasks-vision` (WebGL). Only *processed metrics* (per-second samples
aggregated into eye contact %, blink rate, average confidence, posture summary)
are POSTed to the backend.

**Why better than the reference repository:** the reference streams every camera
frame to a Flask/OpenCV server (`cap.read()` loops, `cv2.imshow`, file-based
temp state). That costs CPU per concurrent user, adds network latency, and uploads
faces to the server — a privacy and scaling liability. Browser MediaPipe is
instant, free, and computes nothing server-side. The **math** (EAR, MAR, gaze,
head pose, confidence aggregation) is reused from the reference and rewritten for
MediaPipe Tasks JS.

### ADR-2: Ollama-only AI behind an `ILLMProvider` interface
**Decision:** A provider interface (`ILLMProvider`) with a single production
implementation (`OllamaProvider`). Default model `qwen3:8b`, overridable via
`OLLAMA_MODEL`. Embeddings via Ollama (`nomic-embed-text`).

**Why:** The requirement is a fully self-hosted architecture. The interface lets
us later add `VllmProvider`, `LmStudioProvider`, etc. without changing business
logic. There is **no cloud fallback** — if Ollama is unreachable the app shows a
clear setup message rather than silently downgrading to a paid API.

### ADR-3: Next.js Route Handlers are the primary API; Server Actions for forms
The existing split is sound and retained: Server Actions for auth/setup/upload
(native form semantics, revalidation), Route Handlers for interview/respond/feedback
(clean client contract, works with streaming). New metrics endpoints follow the
Route Handler pattern.

### ADR-4: Dedicated Python AI service, not a Flask monolith
**Decision:** A single FastAPI service (`pythonai/`) with two responsibilities:
(1) Faster Whisper transcription + speech metrics, (2) sentence-transformer
semantic embeddings endpoint. Communicated over HTTP; deployed as its own
container/process behind PM2.

**Why better than the reference:** the reference has multiple independent Flask
apps, hardcoded Windows ffmpeg paths, Hugging Face cloud Inference API, and
debug-only code. We build one modular service with a typed HTTP contract, Docker
support, and no client-specific assumptions.

### ADR-5: Hybrid semantic + LLM answer evaluation
Cosine similarity alone is insufficient (reference uses it alone). We combine:
1. Embedding cosine against a structured "expected signal" derived from the
   question + role + resume.
2. LLM reasoning pass scoring technical correctness, completeness, clarity, STAR.
Final score is a weighted blend, dominated by the LLM but anchored by embeddings.

## 4. System Diagram

```
┌────────────────────────────┐          ┌─────────────────────────────────────┐
│   Browser (Next.js app)    │          │             AWS EC2 (self-hosted)   │
│                            │          │                                     │
│  MediaPipe Tasks (WebGL)   │          │   ┌──────────────────────────────┐  │
│  Face + Pose Landmarker    │          │   │ Next.js 15 (Route Handlers,  │  │
│  EAR/MAR/gaze/headpose     │  metrics │   │ Server Actions)              │  │
│  + blink + posture + conf  │ ───────► │   │  ILLMProvider ─► OllamaProvider│ │
│                            │          │   └────────────┬─────────────────┘  │
│  Web Speech API (fallback) │          │                │ HTTP                │
│  Web Audio capture (WAV)   │          │   ┌────────────▼─────────────────┐  │
│  Browser TTS (Kokoro-ready)│          │   │ pythonai (FastAPI)           │  │
│                            │          │   │  Faster Whisper + metrics    │  │
└────────────┬───────────────┘          │   │  sentence-transformers (emb)  │  │
             │  audio blob / transcript │   └────────────┬─────────────────┘  │
             └──────────────────────────►               │                     │
                                                        │ Ollama HTTP API     │
                                                        │  qwen3:8b           │
                                                        │  nomic-embed-text   │
                                                        └──────────┬──────────┘
                                                                   │
                                   Supabase Postgres + Storage ◄──┘ (RLS enforced)
```

## 5. Component Responsibilities

| Component | Responsibility |
| --- | --- |
| **Next.js App** | Auth (Supabase), interview orchestration, feedback, dashboard, UI, all business logic. |
| **LLM Provider** | Uniform chat/embedding contract; only seam to inference engines. |
| **Ollama** | Local LLM (`qwen3:8b`) and local embeddings (`nomic-embed-text`). |
| **In-browser CV** | Face/pose metrics; emits per-second samples and session aggregates. |
| **pythonai (FastAPI)** | Faster Whisper transcription + speech metrics; sentence-transformer embedding endpoint. |
| **Supabase** | Auth, Postgres (RLS), Storage (resumes). |

## 6. Data Flow — Live Interview

1. Candidate starts from `/setup` (role, job description, or resume).
2. `startInterviewAction` → `createInterview` → `interviews` row (`in_progress`).
3. `InterviewChat` hydrates existing questions or calls `/api/interview/opening`.
   - Opening generated by `OllamaProvider.generateInterviewerResponse`.
4. Candidate answers (type, mic, or Web Speech). In parallel, the browser CV
   hook continuously records vision metrics; mic records an audio blob per answer.
5. On send, the client:
   - attaches the final transcript + per-answer audio blob to the respond call;
   - `/api/interview/respond` persists the answer, asks Faster Whisper for the
     transcript + speech metrics (if audio present), and runs the CV metrics
     through validation before persisting them per question.
   - `OllamaProvider` generates the next question (adaptive difficulty, no repeats).
6. Loop until Alex emits the completion phrase.
7. `/api/interview/feedback` generates the full report, persists scores, marks
   interview `completed`.
8. `/interview/[id]/results` renders the comprehensive report; `/dashboard`
   aggregates trends.

## 7. Scalability

- **Stateless Next.js instances** behind PM2 cluster/EC2 autoscaling. All state is
  in Postgres/Redis; no in-memory session requirement.
- **Rate limiter** is pluggable: in-memory map for single instance, Redis-backed
  store (`ioredis`) for horizontal scaling (seam already present in `lib/rate-limit.ts`).
- **CV is free** (browser-side) → the dominant cost is Ollama inference and
  Whisper transcription. A **queue** seam (BullMQ/Redis) exists for feedback
  generation so slow LLM calls don't hold request workers.
- **Embeddings cached**: repeated resume/JD embeddings are cached by content hash.

## 8. Security

- Row Level Security on all tables (owner-scoped select/insert/update/delete).
- Storage policies scoped to `auth.uid()` path prefix.
- Server-side Zod validation on every boundary (including new metrics payloads).
- Prompt-injection guard on candidate answers (existing patterns retained + tuned
  for local LLMs).
- Environment variable validation at boot (`lib/env.ts`) — the app refuses to run
  with missing/invalid config.
- Secure headers: CSP (with `wasm-unsafe-eval` for MediaPipe), HSTS, X-Frame-Options,
  Referrer-Policy, Permissions-Policy (camera/mic now allowed on interview route only).
- Rate limiting on auth, upload, opening, respond, feedback, and new analysis endpoints.

## 9. Future-proofing (Coding Interviews)

Coding interviews are a later feature. The architecture already accommodates them:

- `interviews.type` column distinguishes `behavioral` vs `coding`.
- `interview_questions` gains optional `code`, `language`, `test_cases`.
- A `code_execution` seam (sandboxed runner) and `code_review` LLM pass plug into
  the existing `ILLMProvider` and queue infrastructure.
