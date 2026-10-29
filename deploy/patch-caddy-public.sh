#!/bin/bash
# يُشغَّل على السيرفر:
#   sudo bash /opt/control/deploy/patch-caddy-public.sh
#
# يضيف استثناء /teacher-lookup و /portal و /assets من basicauth
# دون حذف إعداداتك الحالية (basicauth يبقى كما هو).

set -e

CADDY="${CADDYFILE:-/etc/caddy/Caddyfile}"

if [ ! -f "$CADDY" ]; then
  echo "خطأ: لا يوجد $CADDY"
  exit 1
fi

if grep -q '@public' "$CADDY"; then
  echo "✓ @public موجود مسبقاً في $CADDY"
  caddy validate --config "$CADDY"
  systemctl reload caddy
  echo "✓ تم reload caddy"
  exit 0
fi

BACKUP="${CADDY}.bak.$(date +%Y%m%d%H%M%S)"
cp "$CADDY" "$BACKUP"
echo "نسخة احتياطية: $BACKUP"

PUBLIC_BLOCK='	@public {
		path /teacher-lookup /teacher-lookup/*
		path /portal /portal/*
		path /certificates /certificates/*
		path /assets/* /vite.svg /favicon.ico
		path /*.jpeg /*.jpg /*.png /*.ico /*.webp /*.svg
	}
	handle @public {
		try_files {path} /index.html
		file_server
	}

'

# إدراج قبل أول handle { يحتوي basicauth، أو قبل أول handle { عام
insert_line() {
  python3 - "$CADDY" "$PUBLIC_BLOCK" <<'PY'
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
    if i > 0 and "handle_path" in lines[i - 1]:
        continue
    window = "".join(lines[i : i + 30])
    if "basicauth" in window:
        insert_at = i
        break
    if insert_at is None:
        insert_at = i

if insert_at is None:
    print("خطأ: لم أجد handle { في Caddyfile — عدّل الملف يدوياً (انظر deploy/CADDY-EDIT.md)")
    sys.exit(1)

lines.insert(insert_at, snippet)
with open(path, "w", encoding="utf-8") as f:
    f.writelines(lines)

print(f"✓ أُدرج @public قبل السطر {insert_at + 1}")
PY
}

if command -v python3 >/dev/null 2>&1; then
  insert_line
else
  echo "python3 غير متوفر — استخدم nano يدوياً (deploy/CADDY-EDIT.md)"
  mv "$BACKUP" "$CADDY"
  exit 1
fi

echo "==> التحقق..."
caddy validate --config "$CADDY"
systemctl reload caddy
echo "✓ تم reload caddy"
echo ""
echo "اختبار:"
curl -sS -o /dev/null -w "  teacher-lookup: %{http_code}\n" https://control0.northelite0.com/teacher-lookup || true
curl -sS -o /dev/null -w "  home:           %{http_code}\n" https://control0.northelite0.com/ || true
echo ""
echo "المتوقع: teacher-lookup=200  و  home=401"
