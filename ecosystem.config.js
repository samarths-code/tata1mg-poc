module.exports = {
    apps: [
      {
        name: "tata1mg-backend",
        script: ".venv/bin/gunicorn",
        args: "app:app --bind 0.0.0.0:5001 --workers 2 --threads 4 --worker-class gthread --timeout 60 --access-logfile - --error-logfile -",
        interpreter: "none",
        cwd: __dirname,

        // no `watch` in production — that's what kept triggering the
        // "Restarting with watchdog" reloads you saw in the logs
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
