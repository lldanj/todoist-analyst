#!/usr/bin/env bash
# Removes the Todoist Analyst LaunchAgent installed by install.sh.

set -e

LABEL="com.todoist-analyst.server"
DEST="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
rm -f "$DEST"

echo "Removed $LABEL."
