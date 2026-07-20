module.exports = {
  apps: [
    {
      name: "tata1mg-backend",
      script: ".venv/bin/python3",
      args: "app.py",
      cwd: __dirname,

      watch: ["app.py"],
      ignore_watch: [".venv", "__pycache__", "*.pyc", ".env", "*.log", "logs"],

      env: {
        FLASK_DEBUG: "1",
        PORT: "5001",
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
