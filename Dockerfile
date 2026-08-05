# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# InterviewIQ AI — Next.js app container (standalone output).
# The pythonai + Ollama services run as their own containers (see
# docker-compose.yml) — this image only hosts the Next.js application.
# ---------------------------------------------------------------------------

# All dependencies (incl. dev — TypeScript, Tailwind, PostCSS are build-time).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Production-only dependencies for the standalone server runtime.
FROM node:22-alpine AS deps-prod
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
