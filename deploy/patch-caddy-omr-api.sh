#!/bin/bash
# يفتح /api/omr و /api/whatsapp بدون basicauth (قبل handle { basicauth })
# التشغيل على السيرفر:
#   sudo bash /opt/control/deploy/patch-caddy-omr-api.sh

set -e

CADDY="${CADDYFILE:-/etc/caddy/Caddyfile}"

if [ ! -f "$CADDY" ]; then
  echo "خطأ: لا يوجد $CADDY"
  exit 1
fi

if grep -q 'handle_path /api/omr/\*' "$CADDY"; then
  echo "✓ handle_path /api/omr موجود مسبقاً"
  caddy validate --config "$CADDY"
  systemctl reload caddy
  curl -sS -w "\n  engine-info: %{http_code}\n" -o /tmp/omr-info.json https://control0.northelite0.com/api/omr/engine-info || true
  head -c 200 /tmp/omr-info.json 2>/dev/null; echo
  exit 0
fi

BACKUP="${CADDY}.bak.$(date +%Y%m%d%H%M%S)"
cp "$CADDY" "$BACKUP"
echo "نسخة احتياطية: $BACKUP"

API_BLOCK='	handle_path /api/omr/* {
		reverse_proxy 127.0.0.1:8000
	}
	handle_path /api/whatsapp/* {
		reverse_proxy 127.0.0.1:3001
	}

'

python3 - "$CADDY" "$API_BLOCK" <<'PY'
import sys

path = sys.argv[1]
snippet = sys.argv[2]

with open(path, encoding="utf-8") as f:
    lines = f.readlines()

def is_handle_open(line):
    s = line.strip()
    return s == "handle {" or s.startswith("handle {")

insert_at = None
for i, line in enumerate(lines):
    if not is_handle_open(line):
        continue
    window = "".join(lines[i : i + 30])
    if "basicauth" in window:
        insert_at = i
        break
    if insert_at is None and "try_files" in window:
        insert_at = i

if insert_at is None:
    for i, line in enumerate(lines):
        if "@public" in line:
            for j in range(i, len(lines)):
                if lines[j].strip() == "}" and "handle @public" in "".join(lines[i:j+1]):
                    insert_at = j + 1
                    break
            break

if insert_at is None:
    print("خطأ: لم أجد مكاناً للإدراج — أضف يدوياً (deploy/Caddyfile.example)")
    sys.exit(1)

lines.insert(insert_at, snippet)
with open(path, "w", encoding="utf-8") as f:
    f.writelines(lines)

print(f"✓ أُدرجت مسارات API قبل السطر {insert_at + 1}")
PY

echo "==> التحقق..."
caddy validate --config "$CADDY"
systemctl reload caddy
echo "✓ تم reload caddy"
echo ""
curl -sS -w "\nHTTP: %{http_code}\n" https://control0.northelite0.com/api/omr/engine-info
