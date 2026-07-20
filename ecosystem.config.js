module.exports = {
  apps: [
    {
      name: "tata1mg-backend",
      script: ".venv/bin/gunicorn",
      args: "--bind 0.0.0.0:6001 --access-logfile - --error-logfile - backend.app:app",
      interpreter: "none",
      cwd: __dirname,

      watch: false,

      env: {
        FLASK_DEBUG: "0",
      },

      output: "/dev/null",
      error: "/dev/null",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: false,

      autorestart: true,
      max_restarts: 10,
      min_uptime: "5s",
      restart_delay: 1000,
    },
  ],
};