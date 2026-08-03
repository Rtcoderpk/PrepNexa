# InterviewIQ AI

A production-ready, full-stack AI mock interview platform. Practice real interviews with **Alex**, an AI interviewer that feels like a senior hiring manager at Google, Microsoft, or Amazon.

## Features

- **Authentication** — email/password signup, login, forgot password, session persistence, protected routes via middleware
- **Dashboard** — previous interviews, average score, completion stats, improvement graph, recent activity
- **Setup** — pick a job role or paste a job description, optionally upload a resume (PDF parsed via `pdf-parse`, stored in Supabase Storage + DB)
- **Live Interview** — ChatGPT-like chat with animated bubbles, timestamps, typing indicator, auto-scroll
- **Voice** — answer with speech recognition (Web Speech API) and hear Alex speak via speech synthesis (graceful fallback if unsupported)
- **AI Interviewer Alex** — powered by Google Gemini 2.5 Flash, remembers context, asks 5 progressive questions across introduction/technical/behavioral/scenario/problem-solving, one follow-up on weak answers, never repeats questions
- **Feedback** — score /10 with a circular progress ring, summary, strength cards, improvement cards, per-question notes, downloadable report (HTML → print to PDF), shareable results

## Tech Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Framer Motion · Lucide Icons · React Hook Form · Zod · TanStack Query · Recharts · Supabase (Auth + PostgreSQL + Storage) · Google Gemini 2.5 Flash · pdf-parse

## Getting Started

### 1. Prerequisites

- Node.js 20+
- A Supabase project (free tier is fine)
- A Google Gemini API key (https://aistudio.google.com)

### 2. Install

```bash
npm install
```

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
GEMINI_API_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Database

Open the Supabase SQL Editor and run the entire contents of [`supabase/schema.sql`](./supabase/schema.sql). This creates the `profiles`, `resumes` storage bucket, `resume_files`, `interviews`, and `interview_questions` tables, plus all Row Level Security policies.

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run typecheck` | TypeScript type check |

## API Routes

| Route | Method | Description |
| --- | --- | --- |
| `/api/interview/start` | POST | Create a new interview session |
| `/api/interview/opening` | POST | Generate & persist the opening question |
| `/api/interview/respond` | POST | Send an answer, get Alex's next question |
| `/api/interview/feedback` | POST | Generate the feedback report |
| `/api/upload-resume` | POST | Upload + parse a resume PDF |

Server Actions are used for auth, interview start, resume upload, and feedback wherever appropriate. The Gemini API key is only ever read server-side.

## Security

- Rate limiting on auth, resume upload, interview start, respond, and feedback endpoints
- Row Level Security on all tables; storage policies scoped to the owner
- Server-side Zod validation on every input
- Prompt injection protection on candidate answers
- Input sanitization, secure headers (CSP-friendly), strict environment variable handling
- Gemini API key never exposed to the client

## Deployment (AWS EC2 + PM2 + Nginx + SSL)

1. Push this repo to GitHub and clone it on your EC2 instance.
2. Install Node.js 20+:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
3. Install PM2 globally: `sudo npm i -g pm2`
4. Build and start:
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
7. Set your production environment variables in `.env.local` (or via a process manager) and rebuild.

## Project Structure

```
app/          # App Router pages + API routes
components/   # UI + feature components (auth, dashboard, interview, results, setup)
actions/      # Server Actions
hooks/        # Speech recognition & synthesis hooks
lib/          # supabase clients, validation, security, rate limit, utils
services/     # Gemini, interview logic, resume parsing
supabase/     # SQL schema + RLS policies
types/        # TypeScript types
```
