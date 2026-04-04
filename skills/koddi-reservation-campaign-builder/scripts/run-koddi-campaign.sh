#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 /absolute/path/to/campaign.json"
  exit 1
fi

CAMPAIGN_FILE="$1"
if [ ! -f "$CAMPAIGN_FILE" ]; then
  echo "Campaign file not found: $CAMPAIGN_FILE"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

KILL_PREVIOUS_AUTOMATION_BROWSERS="${KILL_PREVIOUS_AUTOMATION_BROWSERS:-1}"
PROFILE_DIR="${PLAYWRIGHT_PROFILE_DIR:-.playwright-koddi-profile}"
PROFILE_PREFIX="$ROOT_DIR/${PROFILE_DIR%%-fresh-*}"
PROFILE_FAMILY_PREFIX="$ROOT_DIR/.playwright-koddi-profile"

# By default, clean up prior automation browser processes created by this skill
# across its Playwright profile family. This avoids touching the user's normal
# Chrome profile and catches stale windows from older scratch profile names.
if [ "$KILL_PREVIOUS_AUTOMATION_BROWSERS" = "1" ]; then
  if command -v pkill >/dev/null 2>&1; then
    pkill -f -- "$PROFILE_FAMILY_PREFIX" >/dev/null 2>&1 || true
    pkill -f -- "$PROFILE_PREFIX" >/dev/null 2>&1 || true
  fi
  # Fallback for environments where pkill/pgrep matching is unreliable.
  if command -v ps >/dev/null 2>&1; then
    while IFS= read -r pid; do
      [ -n "$pid" ] || continue
      [ "$pid" = "$$" ] && continue
      kill "$pid" >/dev/null 2>&1 || true
    done < <(
      ps -ax -o pid= -o command= \
        | awk -v needle_family="$PROFILE_FAMILY_PREFIX" -v needle_profile="$PROFILE_PREFIX" '
            index($0, needle_family) > 0 || index($0, needle_profile) > 0 { print $1 }
          '
    )
  fi
fi

CAMPAIGN_FILE="$CAMPAIGN_FILE" npm run create:koddi-reservation
