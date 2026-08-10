# PrepNexa — Folder Structure

Enterprise, feature-based structure. Business logic lives in `services/`,
data access in `lib/`, server actions in `actions/`, providers behind
`lib/ai/` (the cloud AI router seam).

```
├── app/                          # Next.js App Router
│   ├── (auth)/                   # public auth pages
│   │   ├── login/
│   │   ├── signup/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── (marketing)/              # public SEO landing pages (no auth gate)
│   │   ├── ai-mock-interview/
│   │   ├── free-ats-resume-checker/
│   │   ├── ai-resume-analyzer/
│   │   ├── cv-analyzer/
│   │   ├── resume-score-checker/
│   │   ├── interview-practice/
│   │   ├── interview-questions/          # hub + role/category pages
│   │   ├── resume-tips/
│   │   ├── career-resources/
│   │   ├── pricing/
│   │   ├── blog/ + blog/[slug]/
│   │   ├── about/ contact/ privacy/ terms/ cookie-policy/
│   │   └── layout.tsx             # marketing header/footer
│   ├── (dashboard)/              # authenticated app shell
│   │   ├── dashboard/
│   │   ├── history/
│   │   ├── setup/
│   │   └── interview/[id]/
│   │       ├── page.tsx          # live interview
│   │       └── results/page.tsx  # comprehensive feedback
│   ├── api/                      # Route Handlers (the primary API)
│   │   ├── interview/ (start, opening, respond, feedback, feedback/status)
│   │   ├── resume/ (analyze, analyze-upload, job-match, parse)
│   │   ├── payments/ (checkout, webhook, manual-confirm, status)
│   │   ├── analysis/ (transcribe, semantic — optional pythonai proxy)
│   │   ├── feedback-worker/
│   │   └── upload-resume/
│   ├── sitemap.ts                # dynamic public sitemap
│   ├── robots.ts                 # robots.txt (public allow / private block)
│   ├── layout.tsx                # root metadata (PrepNexa brand)
│   └── page.tsx                  # SEO homepage
│
├── components/
│   ├── ui/                      # shadcn/ui primitives
│   ├── auth/                    # auth forms + shell
│   ├── brand/                   # PrepNexa logo
│   ├── layout/                  # dashboard shell, theme toggle
│   ├── marketing/               # site header/footer, CTA, role-questions, JSON-LD
│   ├── ads/                     # AdSlot (free users; disabled for Pro)
│   ├── payments/                # checkout button
│   ├── resume/                  # resume analyzer + job match UIs
│   ├── setup/                   # setup form, resume upload
│   ├── interview/               # chat, input, message bubble
│   ├── vision/                  # CV UI
│   └── results/                 # feedback report UI
│
├── services/                    # business logic
│   ├── llm/                     # ← ILLMProvider adapter + prompts
│   │   ├── types.ts             # ILLMProvider, ChatOptions, EmbeddingsResult
│   │   ├── provider.ts          # createLLMProvider() → cloud AI router
│   │   └── prompts/             # interviewer, feedback, resume builders
│   ├── interview.ts             # interview orchestration (questions, completion)
│   ├── feedback.ts              # feedback generation + persistence
│   ├── resume.ts                # PDF parse + storage
│   ├── resume-analysis.ts       # ATS analysis, improvements, job match
│   ├── semantic-eval.ts         # LLM answer scoring
│   └── speech-metrics.ts        # transcript analysis helpers
│
├── actions/                     # Server Actions (forms)
│   ├── auth.ts
│   ├── interview.ts             # usage-gated interview start
│   ├── respond.ts
│   ├── feedback.ts
│   ├── resume.ts
│   └── checkout.ts              # create payment session
│
├── lib/                         # utilities + data access
│   ├── ai/                      # ← cloud AI router
│   │   ├── ai-types.ts          # AIError, AICapabilities, ChatOptions
│   │   ├── ai-config.ts         # providers + per-task model routing
│   │   ├── ai-router.ts         # selection, retry, failover
│   │   ├── retry-manager.ts
│   │   ├── provider-health.ts   # cooldowns + telemetry
│   │   ├── usage-manager.ts     # in-memory counters + dedup
│   │   ├── friendly-errors.ts   # user-safe error copy
│   │   └── providers/           # groq, gemini, cloudflare, openrouter
│   ├── payments/                # provider-independent payments
│   │   ├── provider.ts          # checkout session seam
│   │   ├── webhook.ts           # server-side verification
│   │   └── subscription.ts      # DB persistence + entitlement
│   ├── supabase/                # server/middleware/client/admin clients
│   ├── env.ts                   # boot-time env validation (server-only keys)
│   ├── usage.ts                 # server-side usage + entitlement enforcement
│   ├── pricing.ts               # central plan + pricing config
│   ├── constants.ts             # site name/URL
│   ├── rate-limit.ts            # pluggable store (memory/redis)
│   ├── redis.ts
│   ├── security.ts
│   ├── validations.ts
│   ├── feedback.ts
│   ├── dashboard.ts
│   ├── history.ts
│   ├── results.ts
│   ├── pdf-report.ts
│   └── utils.ts
│
├── content/
│   └── blog/index.ts            # blog post registry (hand-written)
│
├── hooks/                       # Web Speech, TTS, MediaPipe CV, audio recorder
├── lib/vision/                  # browser CV math (EAR, MAR, gaze, posture)
│
├── pythonai/                    # OPTIONAL self-hosted speech/semantic service
│
├── supabase/
│   ├── schema.sql               # core schema + RLS
│   ├── migration_missing_tables.sql
│   └── migration_prepnexa.sql   # usage/subscriptions/resume_analyses/ai_usage_logs
│
├── types/
│   ├── database.ts              # Supabase DB types (hand-maintained)
│   ├── interview.ts
│   └── feedback.ts
│
├── middleware.ts
├── next.config.mjs
├── ecosystem.config.js          # PM2 (Next app + feedback drainer)
├── docker-compose.yml           # optional: just the Next.js container
├── Dockerfile
├── nginx.conf
└── README.md
```
