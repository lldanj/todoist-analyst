#!/usr/bin/env bash
# Installs a macOS LaunchAgent that runs the Todoist Analyst server in the
# background, starting at login and restarting it if it ever dies.

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.todoist-analyst.server"
DEST="$HOME/Library/LaunchAgents/$LABEL.plist"

mkdir -p "$HOME/Library/LaunchAgents"
sed "s|__PROJECT_DIR__|$DIR|" "$DIR/launchd/$LABEL.plist" > "$DEST"

launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$DEST"
launchctl enable "gui/$(id -u)/$LABEL"

echo "Installed and started $LABEL."
echo "Dashboard will now always be running at http://localhost:8000"
