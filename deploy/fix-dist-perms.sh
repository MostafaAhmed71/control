#!/bin/bash
# تشغيل على السيرفر: sudo bash /opt/control/deploy/fix-dist-perms.sh
set -e
DIST="${DIST:-/opt/control/dist}"

echo "==> dist: $DIST"
if [ ! -f "$DIST/index.html" ]; then
  echo "خطأ: لا يوجد $DIST/index.html — ارفع dist أولاً"
  exit 1
fi

chown -R caddy:caddy "$DIST"
find "$DIST" -type d -exec chmod 755 {} \;
find "$DIST" -type f -exec chmod 644 {} \;

echo "==> index.html"
ls -la "$DIST/index.html"
echo "==> assets (أول 5 ملفات)"
ls -la "$DIST/assets/" 2>/dev/null | head -6 || echo "مجلد assets غير موجود!"

if command -v caddy >/dev/null 2>&1; then
  caddy validate --config /etc/caddy/Caddyfile
  systemctl reload caddy
  echo "==> تم reload caddy"
fi

echo "تم."
