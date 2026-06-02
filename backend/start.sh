#!/bin/bash
set -e

# Create venv and install deps on first run
if [ ! -d ".venv" ]; then
  echo "Setting up virtual environment..."
  python3 -m venv .venv
  .venv/bin/python3 -m pip install --quiet --upgrade pip
  .venv/bin/python3 -m pip install --quiet -r requirements.txt
  echo "Ready."
fi

FLASK_DEBUG=1 .venv/bin/python3 app.py
