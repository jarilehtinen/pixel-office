#!/usr/bin/env bash
# Claude Code Stop hook
# Sends an idle event when the Claude session ends.
#
# Installation (~/.claude/settings.json):
# {
#   "hooks": {
#     "Stop": [
#       {
#         "matcher": "",
#         "hooks": [
#           {
#             "type": "command",
#             "command": "/path/to/pixel-office/hooks/stop.sh"
#           }
#         ]
#       }
#     ]
#   }
# }

set -euo pipefail

PIXEL_OFFICE_URL="${PIXEL_OFFICE_URL:-http://localhost:8000}"
PROJECT="${PIXEL_OFFICE_PROJECT:-$(basename "$(pwd)")}"

# Get this session's character name
SESSION_DIR="/tmp/pixel-office-sessions"
CC_PID="$PPID"
SESSION_FILE="${SESSION_DIR}/pid-${CC_PID}"

if [ -f "$SESSION_FILE" ]; then
    ACTOR=$(cat "$SESSION_FILE")
    rm -f "$SESSION_FILE"
else
    # No session file — skip sending event (likely a subagent)
    exit 0
fi

curl -s -X POST "${PIXEL_OFFICE_URL}/api/events" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d "$(jq -n \
        --arg actor "$ACTOR" \
        --arg project "$PROJECT" \
        --arg ts "$(date -u +%Y-%m-%dT%H:%M:%S+00:00)" \
        '{actor: $actor, project: $project, activity: "idle", task: "session ended", ts: $ts}'
    )" > /dev/null 2>&1 || true
