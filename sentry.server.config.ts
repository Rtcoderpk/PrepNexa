import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? "development",
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 1.0,
  debug: false,
});
