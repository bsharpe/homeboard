#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_USER="${SUDO_USER:-$USER}"
RUN_HOME="$(eval echo "~${RUN_USER}")"

echo "==> Installing Homeboard from ${APP_DIR} for user ${RUN_USER}"

# 1. Ensure Node.js 20+ is installed
if ! command -v node >/dev/null 2>&1; then
  echo "==> Node.js not found. Installing Node.js 22 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

NODE_BIN="$(command -v node)"
echo "==> Using Node.js: ${NODE_BIN} ($(node -v))"

# 2. Install dependencies and build production bundle
echo "==> Building Homeboard..."
cd "$APP_DIR"
npm ci
npm run build

# 3. Install systemd service
echo "==> Installing systemd service (homeboard.service)..."
SERVICE_TMP="$(mktemp)"
sed \
  -e "s|__USER__|${RUN_USER}|g" \
  -e "s|__APP_DIR__|${APP_DIR}|g" \
  -e "s|__NODE_BIN__|${NODE_BIN}|g" \
  "${APP_DIR}/pi/homeboard.service" > "$SERVICE_TMP"

sudo cp "$SERVICE_TMP" /etc/systemd/system/homeboard.service
rm -f "$SERVICE_TMP"

sudo systemctl daemon-reload
sudo systemctl enable homeboard.service
sudo systemctl restart homeboard.service

# 4. Make kiosk launcher executable and register autostart
chmod +x "${APP_DIR}/pi/kiosk.sh"

# Desktop autostart (works on X11/LXDE and many Wayland desktops)
mkdir -p "${RUN_HOME}/.config/autostart"
cat > "${RUN_HOME}/.config/autostart/homeboard-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Homeboard Kiosk
Exec=${APP_DIR}/pi/kiosk.sh
X-GNOME-Autostart-enabled=true
EOF

# Raspberry Pi OS Bookworm/Trixie Wayland (labwc) autostart
if [[ -d "${RUN_HOME}/.config/labwc" ]] || command -v labwc >/dev/null 2>&1; then
  mkdir -p "${RUN_HOME}/.config/labwc"
  LABWC_AUTOSTART="${RUN_HOME}/.config/labwc/autostart"
  if ! grep -Fq "${APP_DIR}/pi/kiosk.sh" "$LABWC_AUTOSTART" 2>/dev/null; then
    echo "${APP_DIR}/pi/kiosk.sh &" >> "$LABWC_AUTOSTART"
  fi
fi

IP_ADDR="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo ""
echo "==> Homeboard installed and running!"
echo "    Board URL:    http://${IP_ADDR:-localhost}:3000"
echo "    Settings URL: http://${IP_ADDR:-localhost}:3000/settings"
echo ""
echo "    Reboot your Raspberry Pi to launch full-screen kiosk mode automatically:"
echo "    sudo reboot"
