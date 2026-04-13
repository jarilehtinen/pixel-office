#!/usr/bin/env bash
# Claude Code PostToolUse hook
# Sends an activity event to the Pixel Office backend.
#
# Installation (~/.claude/settings.json):
# {
#   "hooks": {
#     "PostToolUse": [
#       {
#         "matcher": "",
#         "hooks": [
#           {
#             "type": "command",
#             "command": "/path/to/pixel-office/hooks/post-tool-use.sh"
#           }
#         ]
#       }
#     ]
#   }
# }

set -euo pipefail

PIXEL_OFFICE_URL="${PIXEL_OFFICE_URL:-http://localhost:8000}"
PROJECT="${PIXEL_OFFICE_PROJECT:-$(basename "$(pwd)")}"

# Session identification: each Claude Code process gets its own character name
SESSION_DIR="/tmp/pixel-office-sessions"
mkdir -p "$SESSION_DIR"

# Clean up sessions older than 24h
find "$SESSION_DIR" -name "pid-*" -mtime +0 -delete 2>/dev/null || true

# Claude Code process PID (hook's parent)
CC_PID="$PPID"
SESSION_FILE="${SESSION_DIR}/pid-${CC_PID}"

if [ -f "$SESSION_FILE" ]; then
    ACTOR=$(cat "$SESSION_FILE")
else
    # Character names (overridable: PIXEL_OFFICE_NAMES="Alice,Bob,Carol")
    IFS=',' read -ra NAMES <<< "${PIXEL_OFFICE_NAMES:-Markku,Liisa,Ilkka,Matti,Päivi,Anneli}"
    USED=""
    for f in "$SESSION_DIR"/pid-*; do
        [ -f "$f" ] && USED="$USED|$(cat "$f")"
    done
    ACTOR=""
    for name in "${NAMES[@]}"; do
        if [[ "$USED" != *"|$name"* ]]; then
            ACTOR="$name"
            break
        fi
    done
    # If all names are taken, use PID
    ACTOR="${ACTOR:-agent-${CC_PID}}"
    echo "$ACTOR" > "$SESSION_FILE"
fi

# Read hook input from stdin (JSON)
INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || true)

if [ -z "$TOOL_NAME" ]; then
    exit 0
fi

# Map tool -> activity
case "$TOOL_NAME" in
    Edit|Write|MultiEdit)
        ACTIVITY="coding"
        ;;
    Read|Glob|Grep)
        ACTIVITY="review"
        ;;
    Bash)
        # Check command more closely
        COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)
        case "$COMMAND" in
            *pest*|*phpunit*|"php artisan test"*|*"vendor/bin/pest"*|*"vendor/bin/phpunit"*|npm\ test*|npx\ jest*|npx\ vitest*)
                ACTIVITY="testing"
                ;;
            *)
                ACTIVITY="coding"
                ;;
        esac
        ;;
    Agent|TodoWrite|TaskCreate|TaskUpdate|EnterPlanMode)
        ACTIVITY="planning"
        ;;
    AskUserQuestion)
        ACTIVITY="waiting"
        ;;
    *)
        ACTIVITY="coding"
        ;;
esac

# Task description — human-readable text
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
FILE_BASE=""
if [ -n "$FILE_PATH" ]; then
    FILE_BASE=$(basename "$FILE_PATH")
fi

case "$TOOL_NAME" in
    Edit|MultiEdit)
        TASK="muokkaan ${FILE_BASE:-tiedostoa}"
        ;;
    Write)
        TASK="kirjoitan ${FILE_BASE:-tiedostoa}"
        ;;
    Read)
        TASK="luen ${FILE_BASE:-tiedostoa}"
        ;;
    Glob)
        PATTERN=$(echo "$INPUT" | jq -r '.tool_input.pattern // empty' 2>/dev/null || true)
        TASK="etsin tiedostoja${PATTERN:+ ($PATTERN)}"
        ;;
    Grep)
        PATTERN=$(echo "$INPUT" | jq -r '.tool_input.pattern // empty' 2>/dev/null || true)
        TASK="etsin${PATTERN:+: $PATTERN}"
        ;;
    Bash)
        COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)
        DESC=$(echo "$INPUT" | jq -r '.tool_input.description // empty' 2>/dev/null || true)
        if [ -n "$DESC" ]; then
            TASK="$DESC"
        else
            # Identify command
            case "$COMMAND" in
                git\ commit*) TASK="committaan muutokset" ;;
                git\ push*)   TASK="pushaan remoteen" ;;
                git\ pull*)   TASK="pullaan remotesta" ;;
                git\ diff*)   TASK="vertailen muutoksia" ;;
                git\ log*)    TASK="katson historiaa" ;;
                git\ status*) TASK="tarkistan git-tilan" ;;
                git\ *)       TASK="git-operaatio" ;;
                php\ artisan\ test*|*pest*|*phpunit*) TASK="ajan testejä" ;;
                php\ artisan\ migrate*) TASK="ajan migraation" ;;
                php\ artisan*) TASK="artisan-komento" ;;
                composer\ *)  TASK="composer-operaatio" ;;
                npm\ *)       TASK="npm-operaatio" ;;
                curl\ *)      TASK="teen HTTP-pyynnön" ;;
                ssh\ *)       TASK="yhdistän etänä" ;;
                *)            TASK="suoritan komentoa" ;;
            esac
        fi
        ;;
    Agent)
        DESC=$(echo "$INPUT" | jq -r '.tool_input.description // empty' 2>/dev/null || true)
        TASK="${DESC:-suunnittelen}"
        ;;
    AskUserQuestion)
        QUESTION=$(echo "$INPUT" | jq -r '.tool_input.question // empty' 2>/dev/null || true)
        TASK="${QUESTION:-odotan vastausta}"
        ;;
    TaskCreate|TaskUpdate|TodoWrite)
        TASK="organisoin tehtäviä"
        ;;
    EnterPlanMode)
        TASK="suunnittelen toteutusta"
        ;;
    *)
        TASK="$TOOL_NAME"
        ;;
esac

# Send event
curl -s -X POST "${PIXEL_OFFICE_URL}/api/events" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d "$(jq -n \
        --arg actor "$ACTOR" \
        --arg project "$PROJECT" \
        --arg activity "$ACTIVITY" \
        --arg task "$TASK" \
        --arg ts "$(date -u +%Y-%m-%dT%H:%M:%S+00:00)" \
        '{actor: $actor, project: $project, activity: $activity, task: $task, ts: $ts}'
    )" > /dev/null 2>&1 || true
