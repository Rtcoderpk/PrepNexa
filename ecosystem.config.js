// PM2 ecosystem file for production deployment on a single host.
// The app is cloud-based (Supabase + cloud AI APIs); no local AI services.
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: "prepnexa",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
      time: true,
      watch: false,
    },
    {
      // Drains the Redis feedback queue every 5 minutes when FEEDBACK_QUEUE=redis.
      name: "prepnexa-feedback-drainer",
      script: `${__dirname}/scripts/drain-feedback.js`,
      interpreter: "node",
      autorestart: false,
      cron_restart: "*/5 * * * *",
      env: {
        APP_URL: process.env.APP_URL ?? "http://127.0.0.1:3000",
        FEEDBACK_WORKER_SECRET: process.env.FEEDBACK_WORKER_SECRET ?? "",
      },
      time: true,
    },
  ],
};