#!/usr/bin/env bash
# Starts a local static server for Todoist Analyst and opens it in your browser.

set -e

PORT=8000
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
URL="http://localhost:${PORT}"

cd "$DIR"

# Open the browser after a short delay so the server has time to start.
(
  sleep 1
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1
  elif command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1
  fi
) &

echo "Starting Todoist Analyst at $URL (press Ctrl+C to stop)"
python3 -m http.server "$PORT"
