# PrepNexa — Implementation Roadmap

Delivered **feature-by-feature** so existing functionality is never broken.
Each phase ends with a typecheck/build + manual smoke test.

## Phase 1 — Cloud AI foundation (AI router layer)
Migrate from local Ollama/Qwen to a multi-provider cloud AI router.
- [x] `lib/ai/ai-types.ts` — `AIError`, `AICapabilities`, `ChatOptions` (task-typed).
- [x] `lib/ai/ai-config.ts` — provider list + per-task model routing (Groq/Gemini/Cloudflare/OpenRouter).
- [x] `lib/ai/providers/*` — groq, gemini, cloudflare, openrouter HTTP clients.
- [x] `lib/ai/ai-router.ts` — provider selection, retries with backoff, failover.
- [x] `lib/ai/retry-manager.ts`, `provider-health.ts` (cooldowns), `usage-manager.ts` (dedup/counters).
- [x] `lib/ai/friendly-errors.ts` — user-safe error copy; no raw provider errors.
- [x] `services/llm/provider.ts` — `createLLMProvider()` now adapts the cloud router.
- [x] Remove `services/llm/ollama/*` entirely; remove `OLLAMA_*` env vars.
- **Smoke:** interviews + feedback route through cloud AI with automatic failover.

## Phase 2 — Full feedback report
- [x] `types/feedback.ts` + `feedbackReportSchema` (all 8 scores, strengths, weaknesses, STAR, hiring rec, roadmap).
- [x] `supabase/schema.sql` + `types/database.ts` (interviews scores, speech_metrics, vision_metrics, feedback_reports).
- [x] `services/llm/prompts/feedback.ts` robust JSON parsing.

## Phase 3 — In-browser computer vision
- [x] `@mediapipe/tasks-vision` — Face + Pose Landmarker, entirely in-browser.
- [x] `lib/vision/*` (EAR/MAR/gaze/head-pose/confidence) + `hooks/use-vision-metrics.ts`.
- [x] `components/vision/` — permission gate + live confidence/eye-contact indicator.
- Vision results presented only as interview presentation indicators.

## Phase 4 — Speech analysis + voice architecture
- [x] `pythonai/` FastAPI service (OPTIONAL — Faster Whisper transcribe + speech metrics + embeddings).
- [x] `hooks/use-audio-recorder.ts`, `hooks/use-speech-synthesis.ts`, `api/analysis/*` proxies.
- The interview works without pythonai (Web Speech API fallback).

## Phase 5 — Interview UI integration
- [x] Wire vision + audio into `interview-chat`; attach metrics to respond.
- [x] Session protection: answers are persisted BEFORE the AI request; failures never lose progress.
- [x] Friendly error copy during interviews.

## Phase 6 — Results UI + reports
- [x] `components/results/*` — radar chart, all score rows, STAR, hiring rec, roadmap.
- [x] `lib/pdf-report.ts` (text + HTML), branded PrepNexa.

## Phase 7 — Dashboard analytics + usage
- [x] Weekly/monthly trends, confidence trajectory, resume history.
- [x] `UsageSummary` banner — free/premium, interview used, resume checks remaining.
- [x] Ads for free users only (`AdSlot`); ad-free for Pro.

## Phase 8 — Resume analyzer + ATS checker
- [x] `services/resume-analysis.ts` — ATS score, quality score, improvements, bullet rewrites, job match.
- [x] `/free-ats-resume-checker`, `/ai-resume-analyzer`, `/cv-analyzer`, `/resume-score-checker`.
- [x] Server-side quota: 3 free checks; Premium unlimited (fair-use).

## Phase 9 — Plans, payments + conversion
- [x] `lib/pricing.ts` — central config (Free vs Pro, PKR 499/month).
- [x] `lib/payments/*` — provider-independent checkout + webhook-verified activation.
- [x] `/pricing` page; `ProCtaCard` after free interview/resume limits.

## Phase 10 — SEO + public site
- [x] SEO landing pages (interviews, resume, questions by role/category, tips, resources, legal).
- [x] `sitemap.ts` (public only), `robots.ts` (private paths blocked + noindex), JSON-LD (Organization/WebApplication/Offer/Article/FAQ).
- [x] `/blog` + hand-written articles with CTAs.
- [x] Brand migration: InterviewIQ → **PrepNexa** everywhere.

## Phase 11 — Hardening + deployment
- [x] Server-side API keys; env validation; RLS; rate limiting; injection guard.
- [x] `Dockerfile` (Next only), `docker-compose.yml` (no Ollama), PM2 config, nginx.conf.
- [x] `README.md` rewrite (cloud-only, no local AI), `.env.example` update.
- [x] Unit test suite (Vitest + pytest) — speech metrics, vision metrics, semantic scoring, dashboard bucketing, feedback JSON parsing, telemetry clamps.
- [x] GitHub Actions CI (typecheck + lint + tests + build on push/PR).
- [x] Typecheck + lint + build clean.

## Phase 12 — Coding interviews (future seam)
Architecture already accommodates; UI ships later (Monaco, code execution, AI review).
