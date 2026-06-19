module.exports = {
  apps: [
    {
      name: "tata1mg-backend",
      script: "backend/.venv/bin/gunicorn",
      args: "-b 0.0.0.0:6001 backend.app:app",
      interpreter: "none",
      cwd: __dirname,

      watch: false,

      env: {
        FLASK_DEBUG: "0",
      },

      error_file: "logs/err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,

      autorestart: true,
      max_restarts: 10,
      min_uptime: "5s",
      restart_delay: 1000,
    },
  ],
};
