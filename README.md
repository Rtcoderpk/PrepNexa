# PrepNexa — AI Mock Interviews & Free ATS Resume Checker

PrepNexa is a production-grade AI career preparation SaaS. Practice realistic
AI mock interviews, analyze your resume, check ATS compatibility, match your CV
to job descriptions, and improve your chances of getting hired.

> **AI Career Preparation, Built Around You.**

The entire AI stack runs on **cloud AI APIs** — there is no local AI server, no
Ollama, no Qwen, no GPU, and no model downloads. Everything works with at least
one cloud AI provider key.

## Features

- **Authentication** — email/password signup, login, forgot password, session persistence, protected routes via middleware
- **Dashboard** — average score, completion stats, score trend, skill radar, confidence trajectory, weekly/monthly practice volume, resume history, free/premium usage
- **Setup** — pick a job role or paste a job description, optionally upload a resume (PDF parsed via `pdf-parse`, stored in Supabase Storage + DB)
- **Live Interview** — ChatGPT-like chat with animated bubbles, timestamps, typing indicator, auto-scroll
- **Voice** — answer with your mic and hear the interviewer speak (browser Web Speech + speech synthesis; optional pythonai Faster Whisper transcription)
- **Computer Vision** — live camera confidence + eye-contact analysis runs entirely in the browser (MediaPipe WASM); no video ever leaves the device
- **AI Interviewer** — powered by a multi-provider cloud AI router (Groq → Gemini → Cloudflare → OpenRouter with automatic failover), remembers context, asks 5 progressive questions, one follow-up on weak answers, never repeats questions
- **Feedback** — full 8-dimension report: score ring, skill breakdown, strengths/improvements, STAR evaluation, hiring recommendation, improvement roadmap, per-question notes, downloadable PDF, shareable results
- **Free ATS Resume Checker** — analyze a resume for ATS compatibility, quality, structure, keywords, action verbs, and measurable achievements
- **Resume Analyzer** — AI resume analysis with improvement recommendations that stay faithful to your actual resume
- **Job Description Matching** — paste a JD, get a match score, missing keywords, and recommended changes
- **Plans** — Free (1 AI interview + 3 resume checks) vs **PrepNexa Pro (PKR 499/month)**
- **Ads** — free users see ad slots; Pro is ad-free

## Tech Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Framer Motion · Lucide Icons · React Hook Form · Zod · TanStack Query · Recharts · Supabase (Auth + PostgreSQL + Storage) · **Cloud AI router** (Groq · Gemini · Cloudflare · OpenRouter) · MediaPipe (in-browser vision) · Redis (optional: rate limiting + feedback queue)

## Getting Started

### 1. Prerequisites

- Node.js 20+ (22 LTS recommended)
- A Supabase project (free tier is fine)
- At least one cloud AI provider key: Groq (primary), Gemini (secondary), Cloudflare Workers AI (tertiary), or OpenRouter (fallback). Free tiers are fine.

### 2. Install

```bash
npm install
```

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in your values. At minimum:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cloud AI — server-side only, never exposed to the browser
GROQ_API_KEY=...
GEMINI_API_KEY=...
```

### 4. Database

Open the Supabase SQL Editor and run the contents of the migration files in
order:

1. [`supabase/schema.sql`](./supabase/schema.sql) — base schema
   (`profiles`, `resume_files`, `interviews`, `interview_questions`,
   `speech_metrics`, `vision_metrics`, `feedback_reports`).
2. [`supabase/migration_prepnexa.sql`](./supabase/migration_prepnexa.sql) —
   plan + usage layer: `profiles` columns, `subscriptions`, `resume_analyses`,
   `ai_usage_logs`, `provider_health`.
3. [`supabase/migration_missing_tables.sql`](./supabase/migration_missing_tables.sql) —
   for a **live project upgraded from an earlier version**: adds the
   `interviews` score columns and the `speech_metrics` / `vision_metrics` /
   `feedback_reports` tables if they aren't present.
4. [`supabase/migration_safepay_payments.sql`](./supabase/migration_safepay_payments.sql) —
   multi-provider payments (Safepay primary): the idempotent
   `payment_transactions` ledger.

All migrations are idempotent — safe to re-run. Safepay merchant credentials
come from your verified Safepay account (see `.env.example`).

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000

## Optional: self-hosted pythonai (speech + semantic analysis)

The interview works without pythonai (it falls back to the Web Speech API).
If you want Faster Whisper transcription and embedding-based semantic scoring:

```bash
cd pythonai
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run typecheck` | TypeScript type check |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm test` | Vitest unit tests |
| `npm run test:python` | pytest for the pythonai service |

## CI/CD

A [GitHub Actions workflow](./.github/workflows/ci.yml) runs on every push/PR:
typecheck, lint, Vitest suite, production build, and the pythonai pytest suite.

## API Routes

| Route | Method | Description |
| --- | --- | --- |
| `/api/interview/start` | POST | Create a new interview session |
| `/api/interview/opening` | POST | Generate & persist the opening question |
| `/api/interview/respond` | POST | Send an answer, get the next question |
| `/api/interview/feedback` | POST | Generate the feedback report (inline, or enqueued with `FEEDBACK_QUEUE=redis`) |
| `/api/feedback-worker` | GET | Drain the feedback queue (cron; requires `FEEDBACK_WORKER_SECRET`) |
| `/api/resume/analyze-upload` | POST | Upload a PDF resume, analyze ATS + quality + improvements (quota-gated) |
| `/api/resume/job-match` | POST | Match a resume against a job description (Pro) |
| `/api/resume/parse` | POST | Extract text from a resume PDF (server-side) |
| `/api/analysis/transcribe` | POST | Proxy to pythonai transcription |
| `/api/upload-resume` | POST | Upload + parse a resume PDF |

Server Actions handle auth, interview start, resume upload, and feedback.
Secrets are only ever read server-side.

## Security

- Cloud AI keys are read **server-side only** — never in the browser
- Rate limiting on auth, resume upload, interview start, respond, and feedback endpoints (memory or Redis store)
- Row Level Security on all tables; storage policies scoped to the owner
- Server-side Zod validation on every input
- Prompt injection protection on candidate answers
- Input sanitization, secure headers + CSP (MediaPipe WASM allowed), strict environment variable handling
- MediaPipe models load from a pinned CDN version; vision runs entirely client-side

## Deployment

### Option A — Vercel

Link the repo to Vercel, set your environment variables (`NEXT_PUBLIC_SUPABASE_*`,
`GROQ_API_KEY`, `GEMINI_API_KEY`, etc.), and deploy. `vercel.json` configures
headers and a feedback-worker cron. No local AI services required.

### Option B — Docker (single host)

```bash
cp .env.example .env.local   # fill in Supabase + AI provider values
docker compose up -d --build
```

### Option C — AWS EC2 + PM2 + Nginx + SSL

1. Push this repo to GitHub and clone it on your EC2 instance.
2. Install Node.js 22.
3. Install PM2 globally: `sudo npm i -g pm2`
4. Build and start:

   ```bash
   npm install
   npm run build
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

5. Install Nginx and copy `nginx.conf` (adjust `server_name`).
6. Get a Let's Encrypt certificate and set your production env vars.

## Project Structure

```
app/          # App Router pages + API routes
components/   # UI + feature components (auth, dashboard, interview, results, setup, vision, resume)
actions/      # Server Actions
hooks/        # Speech recognition/synthesis, audio recorder, vision metrics
lib/          # supabase clients, validation, security, rate limit, env, vision math, queue, AI router, usage, payments
services/     # cloud AI provider adapter, prompts, interview logic, feedback, resume parsing
pythonai/     # optional FastAPI service (Faster Whisper transcription + semantic scoring)
supabase/     # SQL schema + RLS policies
types/        # TypeScript types
```
