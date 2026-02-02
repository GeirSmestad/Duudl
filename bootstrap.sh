#!/usr/bin/env bash
set -euo pipefail

# Idempotent bootstrap for Duudl on a shared server.
# - Installs dependencies into an app-local venv
# - Configures a dedicated systemd service (isolated port, isolated working dir)
# - Configures an nginx vhost for the Duudl domain
#
# Safety/Isolation principles:
# - Only touches files named for Duudl (service + nginx vhost) and never edits other apps' configs
# - Uses a dedicated port bound to 127.0.0.1
# - Keeps all python deps in /srv/duudl/.venv (no global pip installs)
# - Keeps data in /srv/duudl/data (not deleted by deploy)

DOMAIN="${DUUDL_DOMAIN:-duudl.twerkules.com}"
APP_DIR="${DUUDL_APP_DIR:-/srv/duudl}"
APP_USER="${DUUDL_APP_USER:-duudl}"
PORT="${DUUDL_PORT:-5011}"
SERVICE_NAME="${DUUDL_SERVICE_NAME:-duudl}"

PYTHON_BIN="${DUUDL_PYTHON_BIN:-python3}"
VENV_DIR="${DUUDL_VENV_DIR:-$APP_DIR/.venv}"
SECRET_FILE="${DUUDL_SECRET_FILE:-$APP_DIR/.secret_key}"
DB_PATH="${DUUDL_DB_PATH:-$APP_DIR/data/duudl.db}"

SYSTEMD_UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}.service"
NGINX_SITES_AVAILABLE_DIR="/etc/nginx/sites-available"
NGINX_SITES_ENABLED_DIR="/etc/nginx/sites-enabled"
NGINX_CONF_D_DIR="/etc/nginx/conf.d"

NGINX_SITE_AVAILABLE="${NGINX_SITES_AVAILABLE_DIR}/${DOMAIN}"
NGINX_SITE_ENABLED="${NGINX_SITES_ENABLED_DIR}/${DOMAIN}"
NGINX_CONF_D_FILE="${NGINX_CONF_D_DIR}/${DOMAIN}.conf"

echo "[duudl] bootstrap starting"
echo "[duudl] domain=$DOMAIN app_dir=$APP_DIR app_user=$APP_USER port=$PORT"

if [[ ! -d "$APP_DIR" ]]; then
  echo "[duudl] ERROR: app dir does not exist: $APP_DIR"
  echo "[duudl] (Did you deploy the repo there first?)"
  exit 1
fi

cd "$APP_DIR"

mkdir -p "$APP_DIR/data"

if [[ ! -d "$VENV_DIR" ]]; then
  echo "[duudl] creating venv: $VENV_DIR"
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

echo "[duudl] installing python deps"
"$VENV_DIR/bin/pip" install --upgrade pip >/dev/null
"$VENV_DIR/bin/pip" install -r requirements.txt

if [[ ! -f "$SECRET_FILE" ]]; then
  echo "[duudl] generating secret key: $SECRET_FILE"
  "$PYTHON_BIN" - <<'PY' > "$SECRET_FILE"
import secrets
print(secrets.token_urlsafe(48))
PY
  chmod 600 "$SECRET_FILE"
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[duudl] NOTE: not running as root; skipping systemd/nginx steps."
  echo "[duudl] Run this script as root (or via sudo) to configure the service and nginx."
  exit 0
fi

if ! id "$APP_USER" >/dev/null 2>&1; then
  echo "[duudl] creating user: $APP_USER"
  useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
fi

chown -R "$APP_USER":"$APP_USER" "$APP_DIR/data"
chown "$APP_USER":"$APP_USER" "$SECRET_FILE"

echo "[duudl] writing systemd unit: $SYSTEMD_UNIT_PATH"
cat > "$SYSTEMD_UNIT_PATH" <<EOF
[Unit]
Description=Duudl (duudl.twerkules.com)
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment=DUUDL_DB_PATH=$DB_PATH
Environment=DUUDL_SECRET_KEY_FILE=$SECRET_FILE
ExecStart=$VENV_DIR/bin/gunicorn --workers 2 --bind 127.0.0.1:$PORT backend.wsgi:app
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

if [[ -d "$NGINX_SITES_AVAILABLE_DIR" && -d "$NGINX_SITES_ENABLED_DIR" ]]; then
  echo "[duudl] writing nginx site: $NGINX_SITE_AVAILABLE"
  cat > "$NGINX_SITE_AVAILABLE" <<EOF
server {
  listen 80;
  server_name $DOMAIN;

  client_max_body_size 2m;

  location / {
    proxy_pass http://127.0.0.1:$PORT;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF

  if [[ ! -L "$NGINX_SITE_ENABLED" ]]; then
    ln -s "$NGINX_SITE_AVAILABLE" "$NGINX_SITE_ENABLED"
  fi
elif [[ -d "$NGINX_CONF_D_DIR" ]]; then
  echo "[duudl] writing nginx conf.d file: $NGINX_CONF_D_FILE"
  cat > "$NGINX_CONF_D_FILE" <<EOF
server {
  listen 80;
  server_name $DOMAIN;

  client_max_body_size 2m;

  location / {
    proxy_pass http://127.0.0.1:$PORT;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF
else
  echo "[duudl] ERROR: nginx config directories not found."
  echo "[duudl] Looked for:"
  echo "  - $NGINX_SITES_AVAILABLE_DIR and $NGINX_SITES_ENABLED_DIR"
  echo "  - $NGINX_CONF_D_DIR"
  exit 1
fi

nginx -t
systemctl reload nginx

echo "[duudl] bootstrap complete"

