// PM2 ecosystem file for production deployment on AWS EC2.
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: "interviewiq-ai",
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
      name: "interviewiq-pythonai",
      cwd: `${__dirname}/pythonai`,
      script: "uvicorn",
      args: "app.main:app --host 0.0.0.0 --port 8000 --workers 1",
      interpreter: "python3",
      autorestart: true,
      max_memory_restart: "4G",
      env: {
        PYTHONUNBUFFERED: "1",
      },
      time: true,
      watch: false,
    },
    {
      // Drains the Redis feedback queue every 5 minutes when FEEDBACK_QUEUE=redis.
      name: "interviewiq-feedback-drainer",
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
