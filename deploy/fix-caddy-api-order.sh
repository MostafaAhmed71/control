#!/bin/bash
# يضع /api/omr قبل basicauth — يدعم أشكال Caddyfile مختلفة
# sudo bash /opt/control/deploy/fix-caddy-api-order.sh

set -e
CADDY="${CADDYFILE:-/etc/caddy/Caddyfile}"

if [ ! -f "$CADDY" ]; then
  echo "خطأ: لا يوجد $CADDY"
  exit 1
fi

echo "==> بنية Caddyfile الحالية (أسطر مهمة):"
grep -n "control0\|northelite\|basicauth\|basic_auth\|handle\|api/omr\|root \*" "$CADDY" | head -40 || true
echo ""

BACKUP="${CADDY}.bak.$(date +%Y%m%d%H%M%S)"
cp "$CADDY" "$BACKUP"
echo "نسخة احتياطية: $BACKUP"

python3 - "$CADDY" <<'PY'
import re
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    lines = f.readlines()

API_SNIPPET = [
    "\thandle_path /api/omr/* {\n",
    "\t\treverse_proxy 127.0.0.1:8000\n",
    "\t}\n",
    "\thandle_path /api/whatsapp/* {\n",
    "\t\treverse_proxy 127.0.0.1:3001\n",
    "\t}\n",
    "\n",
]

# احذف كتل api القديمة
out = []
skip = 0
for line in lines:
    if skip > 0:
        skip -= 1
        continue
    if "handle_path /api/omr/*" in line or "handle_path /api/whatsapp/*" in line:
        # تخطّ كتلة { ... }
        depth = 0
        skip_block = True
        continue
    out.append(line)
lines = out
# إزالة أدق للكتل
text = "".join(lines)
text = re.sub(
    r"\thandle_path /api/omr/\* \{[^\}]*\}\s*",
    "",
    text,
    flags=re.DOTALL,
)
text = re.sub(
    r"\thandle_path /api/whatsapp/\* \{[^\}]*\}\s*",
    "",
    text,
    flags=re.DOTALL,
)
lines = text.splitlines(keepends=True)

def site_block_range(lines):
    """أول بلوك control0 أو northelite0 مع dist."""
    start = None
    for i, line in enumerate(lines):
        if re.search(r"control0\.|northelite0\.com", line) and "{" in line:
            start = i
            break
    if start is None:
        for i, line in enumerate(lines):
            if "/opt/control/dist" in line or "control/dist" in line:
                # ارجع لأقرب site block
                for j in range(i, -1, -1):
                    if lines[j].strip().endswith("{"):
                        start = j
                        break
                break
    if start is None:
        return None, None
    depth = 0
    for i in range(start, len(lines)):
        depth += lines[i].count("{") - lines[i].count("}")
        if depth == 0 and i > start:
            return start, i
    return start, len(lines) - 1

def find_insert_line(lines, s, e):
    """قبل basicauth أو قبل أول handle عام أو بعد encode/root."""
    for i in range(s + 1, e + 1):
        low = lines[i].lower()
        if "basicauth" in low or "basic_auth" in low:
            return i
    for i in range(s + 1, e + 1):
        st = lines[i].strip()
        if st == "handle {" or st.startswith("handle {"):
            return i
    for i in range(s + 1, e + 1):
        if "encode " in lines[i] or "root *" in lines[i]:
            # بعد سطر encode/root
            return i + 1
    return s + 1

s, e = site_block_range(lines)
if s is None:
    print("خطأ: لم أجد بلوك control0 /opt/control/dist في Caddyfile")
    print("اعرض الملف: sudo cat /etc/caddy/Caddyfile")
    sys.exit(1)

insert_at = find_insert_line(lines, s, e)
for line in reversed(API_SNIPPET):
    lines.insert(insert_at, line)

with open(path, "w", encoding="utf-8") as f:
    f.writelines(lines)

print(f"✓ site block: سطر {s + 1}–{e + 1}")
print(f"✓ أُدرجت API قبل السطر {insert_at + 1}")
PY

echo "==> التحقق..."
caddy validate --config "$CADDY"
systemctl reload caddy
echo ""
echo "اختبار:"
curl -sS -w "\nHTTP: %{http_code}\n" https://control0.northelite0.com/api/omr/engine-info
