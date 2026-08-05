# InterviewIQ AI — Folder Structure

Enterprise, feature-based structure. Business logic lives in `services/`,
data access in `lib/`, server actions in `actions/`, providers behind
`services/llm/` (seam for future inference engines).

```
├── app/                          # Next.js App Router
│   ├── (auth)/                   # public auth pages
│   │   ├── login/
│   │   ├── signup/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── (dashboard)/              # authenticated app shell
│   │   ├── dashboard/
│   │   ├── history/
│   │   ├── setup/
│   │   └── interview/[id]/
│   │       ├── page.tsx          # live interview
│   │       └── results/page.tsx  # comprehensive feedback
│   ├── api/                      # Route Handlers (the primary API)
│   │   ├── interview/
│   │   │   ├── start/route.ts
│   │   │   ├── opening/route.ts
│   │   │   ├── respond/route.ts
│   │   │   └── feedback/route.ts
│   │   ├── analysis/
│   │   │   ├── speech/route.ts       # WAV → transcript + speech metrics
│   │   │   └── semantic/route.ts     # embeddings / semantic scoring
│   │   └── upload-resume/route.ts
│   ├── error.tsx
│   ├── not-found.tsx
│   ├── layout.tsx
│   ├── providers.tsx
│   └── globals.css
│
├── components/
│   ├── ui/                      # shadcn/ui primitives (unchanged)
│   ├── auth/                    # auth forms + shell
│   ├── layout/                  # dashboard shell, theme toggle
│   ├── setup/                   # setup form, resume upload
│   ├── interview/               # chat, input, message bubble
│   ├── vision/                  # CV UI (live metrics, permission gate)
│   └── results/                 # feedback report UI
│
├── services/                    # business logic (Clean-ish layering)
│   ├── llm/                     # ← the AI seam
│   │   ├── types.ts             # ILLMProvider, Message, ChatOptions, EmbeddingsResult
│   │   ├── provider.ts          # createLLMProvider() factory (env-driven)
│   │   ├── ollama/              # OllamaProvider + HTTP client
│   │   │   ├── ollama-provider.ts
│   │   │   ├── ollama-client.ts
│   │   │   └── ollama-embedding-provider.ts
│   │   ├── prompts/             # prompt builders (interviewer, feedback, resume)
│   │   │   ├── interviewer.ts
│   │   │   ├── feedback.ts
│   │   │   └── resume.ts
│   ├── interview.ts             # interview orchestration (questions, completion)
│   ├── feedback.ts              # feedback generation + persistence
│   ├── resume.ts                # PDF parse + storage
│   └── speech-metrics.ts        # transcript analysis helpers (used by pythonai)
│
├── actions/                     # Server Actions (forms)
│   ├── auth.ts
│   ├── interview.ts
│   ├── respond.ts
│   ├── feedback.ts
│   └── resume.ts
│
├── lib/                         # framework-adjacent utilities + data access
│   ├── supabase/                # server/middleware/client clients
│   ├── env.ts                   # boot-time env validation
│   ├── rate-limit.ts            # pluggable store (memory/redis)
│   ├── redis.ts                 # redis client factory
│   ├── security.ts              # injection guard + sanitize
│   ├── validations.ts           # zod schemas (incl. metrics)
│   ├── feedback.ts              # parseFeedbackJson + validation
│   ├── dashboard.ts
│   ├── history.ts
│   ├── results.ts
│   ├── pdf-report.ts
│   └── utils.ts
│
├── hooks/
│   ├── use-speech-recognition.ts    # Web Speech API fallback
│   ├── use-speech-synthesis.ts      # browser TTS (Kokoro-ready)
│   ├── use-vision-metrics.ts        # MediaPipe CV (face + pose)
│   └── use-audio-recorder.ts        # WAV capture per answer
│
├── lib/vision/                  # browser CV math (reference math, rewritten)
│   ├── landmark-indices.ts
│   ├── metrics.ts               # EAR, MAR, gaze, head pose, confidence
│   └── aggregation.ts           # per-second samples → session aggregates
│
├── pythonai/                    # separate Python AI service
│   ├── app/
│   │   ├── main.py              # FastAPI entry
│   │   ├── schemas.py
│   │   ├── config.py
│   │   └── routers/
│   │       ├── transcribe.py    # Faster Whisper
│   │       ├── speech_metrics.py
│   │       └── embeddings.py    # sentence-transformers
│   ├── requirements.txt
│   └── Dockerfile
│
├── supabase/
│   └── schema.sql               # full schema + RLS
│
├── types/
│   ├── database.ts              # Supabase DB types (hand-maintained)
│   ├── interview.ts             # domain types
│   └── feedback.ts              # feedback report types
│
├── middleware.ts
├── next.config.mjs
├── ecosystem.config.js          # PM2 (Next app)
├── ecosystem-pythonai.config.js # PM2 (pythonai)
├── docker-compose.yml
├── Dockerfile
├── nginx.conf
└── README.md
```
