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

CAMPAIGN_FILE="$CAMPAIGN_FILE" npm run create:koddi-reservation
