# InterviewIQ AI

A production-ready, full-stack AI mock interview platform. Practice real interviews with **Alex**, an AI interviewer that feels like a senior hiring manager at Google, Microsoft, or Amazon. The entire AI stack runs **self-hosted** — no cloud LLM keys.

## Features

- **Authentication** — email/password signup, login, forgot password, session persistence, protected routes via middleware
- **Dashboard** — average score, completion stats, score trend, **skill radar**, **confidence trajectory**, **weekly/monthly practice volume**, resume history
- **Setup** — pick a job role or paste a job description, optionally upload a resume (PDF parsed via `pdf-parse`, stored in Supabase Storage + DB)
- **Live Interview** — ChatGPT-like chat with animated bubbles, timestamps, typing indicator, auto-scroll
- **Voice** — answer with your mic (Faster Whisper transcription via the pythonai service) and hear Alex speak (speech synthesis)
- **Computer Vision** — live camera confidence + eye-contact analysis runs entirely in the browser (MediaPipe WASM); no video ever leaves the device
- **AI Interviewer Alex** — powered by **Ollama (default `qwen3:8b`)**, remembers context, asks 5 progressive questions across introduction/technical/behavioral/scenario/problem-solving, one follow-up on weak answers, never repeats questions
- **Feedback** — full 8-dimension report: score ring, skill breakdown, strengths/improvements, STAR evaluation, hiring recommendation, improvement roadmap, per-question notes, downloadable PDF, shareable results

## Tech Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Framer Motion · Lucide Icons · React Hook Form · Zod · TanStack Query · Recharts · Supabase (Auth + PostgreSQL + Storage) · **Ollama** (local LLM + embeddings) · **pythonai** (FastAPI + Faster Whisper + sentence-transformers) · MediaPipe (in-browser vision) · Redis (optional: rate limiting + feedback queue)

## Getting Started

### 1. Prerequisites

- Node.js 20+ (22 LTS recommended)
- A Supabase project (free tier is fine)
- **Ollama** running locally (see below) — or use `docker-compose` which runs everything

### 2. Install

```bash
npm install
```

### 3. Ollama (local LLM)

Install from https://ollama.com, then pull the models:

```bash
ollama pull qwen3:8b
ollama pull nomic-embed-text
```

Start the server (usually auto-starts as a service):

```bash
ollama serve
```

> The interviewer falls back to a graceful "Ollama unavailable" message if the server isn't reachable, so the app still boots without it.

### 4. pythonai (speech + semantic analysis)

```bash
cd pythonai
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

First run downloads the Faster Whisper + embedding models (a few hundred MB). The interview works without it (falls back to Web Speech API) but voice/vision scoring needs it.

### 5. Environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b
PYTHONAI_URL=http://localhost:8000
```

### 6. Database

Open the Supabase SQL Editor and run the entire contents of [`supabase/schema.sql`](./supabase/schema.sql). This creates `profiles`, `resumes`, `interviews`, `interview_questions`, `speech_metrics`, `vision_metrics`, `feedback_reports`, plus all Row Level Security policies.

### 7. Run

```bash
npm run dev
```

Open http://localhost:3000

## Run Everything With Docker (recommended)

A single `docker-compose.yml` orchestrates the full stack: Next.js, pythonai, Ollama (with models pulled on boot), and Redis.

```bash
cp .env.example .env.local   # fill in Supabase values
docker compose up -d --build
```

Services:

| Service  | Port  | Purpose                                        |
| -------- | ----- | ---------------------------------------------- |
| next     | 3000  | Next.js app                                    |
| pythonai | 8000  | Faster Whisper + semantic scoring              |
| ollama   | 11434 | Local LLM + embeddings                         |
| redis    | 6379  | Shared rate limiting + feedback queue          |

The compose file sets `RATE_LIMIT_STORE=redis` and `FEEDBACK_QUEUE=redis` automatically, so multi-instance scaling works out of the box.

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
typecheck, lint, Vitest suite, production build, and the pythonai pytest suite
(pure functions only — no heavy ML deps, so it stays fast).

## API Routes

| Route | Method | Description |
| --- | --- | --- |
| `/api/interview/start` | POST | Create a new interview session |
| `/api/interview/opening` | POST | Generate & persist the opening question |
| `/api/interview/respond` | POST | Send an answer, get Alex's next question |
| `/api/interview/feedback` | POST | Generate the feedback report (inline, or enqueued with `FEEDBACK_QUEUE=redis`) |
| `/api/feedback-worker` | GET | Drain the feedback queue (cron; requires `FEEDBACK_WORKER_SECRET`) |
| `/api/analysis/transcribe` | POST | Proxy to pythonai transcription |
| `/api/analysis/semantic` | POST | Proxy to pythonai semantic scoring |
| `/api/upload-resume` | POST | Upload + parse a resume PDF |

Server Actions handle auth, interview start, resume upload, and feedback. Secrets are only ever read server-side.

## Security

- Rate limiting on auth, resume upload, interview start, respond, and feedback endpoints (memory or Redis store)
- Row Level Security on all tables; storage policies scoped to the owner
- Server-side Zod validation on every input
- Prompt injection protection on candidate answers
- Input sanitization, secure headers + CSP (MediaPipe WASM allowed), strict environment variable handling
- MediaPipe models load from a pinned CDN version; vision runs entirely client-side

## Deployment

### Option A — Docker Compose (single host)

```bash
docker compose up -d --build
```

Put Nginx in front (see below) for TLS.

### Option B — AWS EC2 + PM2 + Nginx + SSL

1. Push this repo to GitHub and clone it on your EC2 instance.
2. Install Node.js 22, Ollama, and Python 3.12 (or use the `pythonai/` venv).
3. Install PM2 globally: `sudo npm i -g pm2`
4. Build and start (starts both Next.js and pythonai):

   ```bash
   npm install
   npm run build
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

5. Install Nginx and copy `nginx.conf` (adjust `server_name`), then:

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

6. Get a Let's Encrypt certificate:

   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d interviewiq.example.com
   ```

7. Set your production environment variables in `.env.local` (or via the process manager) and rebuild.

> With `FEEDBACK_QUEUE=redis`, the feedback report is generated asynchronously by a worker. The ecosystem file starts a `interviewiq-feedback-drainer` cron app that hits `/api/feedback-worker` every 5 minutes. (On Vercel, `vercel.json` defines the same cron.)

## Project Structure

```
app/          # App Router pages + API routes
components/   # UI + feature components (auth, dashboard, interview, results, setup, vision)
actions/      # Server Actions
hooks/        # Speech recognition/synthesis, audio recorder, vision metrics
lib/          # supabase clients, validation, security, rate limit, env, vision math, queue
services/     # LLM (Ollama) providers/prompts, interview logic, feedback, resume parsing
pythonai/     # FastAPI service (Faster Whisper transcription + semantic scoring)
supabase/     # SQL schema + RLS policies
types/        # TypeScript types
```
