# تعديل Caddyfile على السيرفر — استثناء صفحة المعلمين

## الطريقة 1: سكربت تلقائي (الأسهل)

### من Windows — ارفع السكربت

```powershell
scp d:\end\control\deploy\patch-caddy-public.sh root@72.62.178.181:/opt/control/deploy/
```

### على السيرفر

```bash
sudo bash /opt/control/deploy/patch-caddy-public.sh
```

---

## الطريقة 2: تعديل يدوي بـ nano

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak
sudo nano /etc/caddy/Caddyfile
```

### ابحث عن هذا (أو شبيه):

```caddy
	handle {
		basicauth {
			...
		}
		try_files {path} /index.html
		file_server
	}
```

### الصق **فوق** `handle {` الذي فيه `basicauth` مباشرة:

```caddy
	@public {
		path /teacher-lookup /teacher-lookup/*
		path /portal /portal/*
		path /assets/* /vite.svg /favicon.ico
		path /*.jpeg /*.jpg /*.png /*.ico /*.webp /*.svg
	}
	handle @public {
		try_files {path} /index.html
		file_server
	}
```

### النتيجة يجب أن تكون بهذا الترتيب:

```caddy
control0.northelite0.com {
	root * /opt/control/dist
	encode gzip zstd

	# API (إن وُجد)
	handle_path /api/omr/* { ... }
	handle_path /api/whatsapp/* { ... }

	@public { ... }
	handle @public { ... }

	handle {
		basicauth { ... }    ← لا تمس هذا
		try_files {path} /index.html
		file_server
	}
}
```

### احفظ وطبّق

في nano: `Ctrl+O` ثم Enter ثم `Ctrl+X`

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -sS -o /dev/null -w "teacher-lookup: %{http_code}\n" https://control0.northelite0.com/teacher-lookup
```

---

## استرجاع النسخة القديمة

```bash
sudo cp /etc/caddy/Caddyfile.bak /etc/caddy/Caddyfile
sudo systemctl reload caddy
```
