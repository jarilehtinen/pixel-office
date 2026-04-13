#!/usr/bin/env bash
# Claude Code Notification hook
# Sends a waiting event when Claude is done and waiting for user response.

set -euo pipefail

PIXEL_OFFICE_URL="${PIXEL_OFFICE_URL:-http://localhost:8000}"
PROJECT="${PIXEL_OFFICE_PROJECT:-$(basename "$(pwd)")}"

# Get this session's character name
SESSION_DIR="/tmp/pixel-office-sessions"
CC_PID="$PPID"
SESSION_FILE="${SESSION_DIR}/pid-${CC_PID}"

if [ -f "$SESSION_FILE" ]; then
    ACTOR=$(cat "$SESSION_FILE")
else
    exit 0
fi

curl -s -X POST "${PIXEL_OFFICE_URL}/api/events" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d "$(jq -n \
        --arg actor "$ACTOR" \
        --arg project "$PROJECT" \
        --arg ts "$(date -u +%Y-%m-%dT%H:%M:%S+00:00)" \
        '{actor: $actor, project: $project, activity: "waiting", task: "", ts: $ts}'
    )" > /dev/null 2>&1 || true
