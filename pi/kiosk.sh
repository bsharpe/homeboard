#!/usr/bin/env bash
set -euo pipefail

BOARD_URL="${HOMEBOARD_URL:-http://localhost:3000}"

# Wait until Homeboard server responds (up to 60s)
for _ in $(seq 1 60); do
  if curl -fsS "${BOARD_URL}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Disable screen blanking on X11 if applicable
if [[ -n "${DISPLAY:-}" ]] && command -v xset >/dev/null 2>&1; then
  xset s off || true
  xset -dpms || true
  xset s noblank || true
fi

# Hide mouse cursor on X11 if unclutter is installed
if [[ -n "${DISPLAY:-}" ]] && command -v unclutter >/dev/null 2>&1; then
  unclutter -idle 2 -root &
fi

# Detect Chromium binary on Raspberry Pi OS
CHROMIUM_BIN=""
for candidate in chromium chromium-browser google-chrome; do
  if command -v "$candidate" >/dev/null 2>&1; then
    CHROMIUM_BIN="$(command -v "$candidate")"
    break
  fi
done

if [[ -z "$CHROMIUM_BIN" ]]; then
  echo "Error: Chromium not found. Install it with: sudo apt install -y chromium" >&2
  exit 1
fi

# Clear Chromium crash flags so it never shows "Restore pages?" after power loss
PREFS_FILE="$HOME/.config/chromium/Default/Preferences"
if [[ -f "$PREFS_FILE" ]]; then
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "$PREFS_FILE" || true
  sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "$PREFS_FILE" || true
fi

exec "$CHROMIUM_BIN" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=TranslateUI \
  --no-first-run \
  --fast \
  --fast-start \
  --overscroll-history-navigation=0 \
  --check-for-update-interval=31536000 \
  "$BOARD_URL"
