# InterviewIQ AI — Implementation Roadmap

Delivered **feature-by-feature** so existing functionality is never broken.
Each phase ends with a typecheck/build + manual smoke test.

## Phase 1 — Local AI foundation (LLM layer)
Replace Gemini with a self-hosted Ollama abstraction.
- [x] `lib/env.ts` boot-time env validation.
- [x] `services/llm/types.ts` — `ILLMProvider`, `ChatOptions`, `EmbeddingsResult`.
- [x] `services/llm/provider.ts` — `createLLMProvider()` (env-driven, default `qwen3:8b`).
- [x] `services/llm/ollama/*` — `OllamaClient` (HTTP), `OllamaProvider`, embedding provider.
- [x] `services/llm/prompts/*` — interviewer, feedback, resume prompt builders (tuned for Qwen3, no markdown JSON).
- [x] Delete `services/gemini.ts`; rewire `services/interview.ts` + feedback to provider.
- **Smoke:** interview flows end-to-end against Ollama; graceful "Ollama unavailable" message.

## Phase 2 — Full feedback report
- [x] `types/feedback.ts` + `feedbackReportSchema` (all 8 scores, strengths, weaknesses, STAR, hiring rec, roadmap).
- [x] Update `supabase/schema.sql` + `types/database.ts` (interviews scores, speech_metrics, vision_metrics, feedback_reports).
- [x] `services/llm/prompts/feedback.ts` robust JSON parsing.
- [x] `lib/feedback.ts` `parseFeedbackJson` hardened for Qwen3 output.
- **Smoke:** feedback returns complete validated report.

## Phase 3 — In-browser computer vision
- [x] Add `@mediapipe/tasks-vision`.
- [x] `lib/vision/landmark-indices.ts`, `lib/vision/metrics.ts` (EAR/MAR/gaze/head-pose/confidence — reference math, rewritten), `lib/vision/aggregation.ts`.
- [x] `hooks/use-vision-metrics.ts` — Face + Pose Landmarker loop → per-second samples → session aggregates.
- [x] `components/vision/` — permission gate + live confidence/eye-contact indicator.
- **Smoke:** CV runs locally (WebGL); no video leaves browser; metrics persist per question.

## Phase 4 — Speech analysis + voice architecture
- [x] `pythonai/` FastAPI service: Faster Whisper transcribe + speech metrics; embeddings endpoint; Dockerfile.
- [x] `hooks/use-audio-recorder.ts` (WAV capture per answer).
- [x] `hooks/use-speech-synthesis.ts` — generalize TTS behind an interface (Kokoro-ready).
- [x] `api/analysis/*` proxies + validation schemas.
- **Smoke:** recorded answer → transcript + metrics → persisted.

## Phase 5 — Interview UI integration
- [x] Wire vision + audio into `interview-chat` / `chat-input`; attach metrics to respond.
- [x] Render live feedback during interview; permission flows; graceful fallbacks.
- **Smoke:** full live interview produces a complete, scored report.

## Phase 6 — Results UI + reports
- [x] `components/results/*` — radar chart, all score rows, STAR, hiring rec, roadmap.
- [x] Update `lib/pdf-report.ts` (text + HTML) with new dimensions.

## Phase 7 — Dashboard analytics
- [x] Weekly/monthly trends, confidence trajectory, resume history in dashboard.

## Phase 8 — Hardening + deployment
- [x] Redis-backed rate limiter seam, queue seam for feedback.
- [x] Env validation wiring, CSP for WASM, injection guard tuning.
- [x] `Dockerfile`, `docker-compose.yml` (Next + pythonai + Ollama), PM2 pythonai config, nginx.conf update.
- [x] `README.md` rewrite (Ollama setup, no cloud keys), `.env.example` update.
- [ ] Final typecheck + build + end-to-end verification.

## Phase 9 — Coding interviews (future seam)
Architecture already accommodates; UI ships later (Monaco, code execution, AI review).