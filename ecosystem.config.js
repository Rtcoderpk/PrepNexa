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
  ],
};
