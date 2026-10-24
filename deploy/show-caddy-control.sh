#!/bin/bash
# عرض إعداد control0 في Caddyfile للتشخيص
# sudo bash /opt/control/deploy/show-caddy-control.sh

CADDY="${CADDYFILE:-/etc/caddy/Caddyfile}"
echo "=== $CADDY ==="
grep -n "control0\|northelite\|basicauth\|handle\|api/omr\|/opt/control" "$CADDY" || true
echo ""
echo "=== أول 80 سطر من الملف ==="
head -80 "$CADDY"
