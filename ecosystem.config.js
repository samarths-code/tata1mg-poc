module.exports = {
  apps: [
    {
      name: "1mg-backend",
      cwd: "./backend",
      script: ".venv/bin/python3",
      args: "app.py",
      interpreter: "none",
      env: {
        PORT: 5001,
        FLASK_DEBUG: 0,
      },
      watch: false,
      autorestart: true,
      log_file: "./backend/logs/pm2-combined.log",
      out_file: "./backend/logs/pm2-out.log",
      error_file: "./backend/logs/pm2-err.log",
      time: true,
    },
  ],
};
