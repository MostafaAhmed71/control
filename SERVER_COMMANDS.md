# أوامر السيرفر والنشر — مرجع سريع

استبدل `USER` و`SERVER_IP` ومسارات الخدمات حسب إعدادك الفعلي على السيرفر.

---

## متغيرات مقترحة (في جلسة الطرفية على Linux)

```bash
export APP_DIR="/opt/control"
export GIT_BRANCH="main"
```

---

## الدخول إلى السيرفر (SSH)

```bash
ssh USER@SERVER_IP
```

بمفتاح:

```bash
ssh -i ~/.ssh/id_ed25519 USER@SERVER_IP
```

---

## الانتقال إلى مجلد المشروع

```bash
cd "$APP_DIR"
pwd
```

---

## جلب التحديثات (Git)

```bash
cd "$APP_DIR"
git fetch origin
git status
git pull origin "$GIT_BRANCH"
```

عند تعارض مع تعديلات محلية:

```bash
git stash push -m "قبل السحب"
git pull origin "$GIT_BRANCH"
git stash pop
```

---

## بناء الواجهة ونشر الملفات الثابتة

على السيرفر:

```bash
cd "$APP_DIR"
npm ci
npm run build
```

نسخ `dist` (مثال — غيّر الوجهة):

```bash
sudo rsync -av --delete dist/ /var/www/control/dist/
```

---

## إعادة تشغيل الخدمات (systemd)

تحقق من أسماء الخدمات عندك:

```bash
systemctl list-units --type=service | grep -Ei 'caddy|omr|whatsapp'
```

Caddy:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

أو إعادة تشغيل كاملة:

```bash
sudo systemctl restart caddy
```

أمثلة لتطبيقات (غيّر الاسم حسب الخادم):

```bash
sudo systemctl restart omr-api.service
sudo systemctl restart whatsapp-api.service
```

الحالة والسجلات:

```bash
sudo systemctl status caddy
sudo journalctl -u caddy -f --no-pager
sudo journalctl -u omr-api.service -n 100 --no-pager
```

---

## تغيير كلمة مرور الوصول (Basic Auth مع Caddy و htpasswd)

```bash
sudo apt-get update && sudo apt-get install -y apache2-utils
sudo htpasswd /etc/caddy/.htpasswd اسم_المستخدم
sudo systemctl reload caddy
```

افتح ملف `Caddyfile` وتأكد من مسار ملف `htpasswd` في إعداد `basicauth`.

---

## أوامر تشخيص مفيدة

```bash
df -h
free -h
sudo ss -tlnp | grep -E '443|80|8000|3001'
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/docs
```

---

## من Windows (PowerShell) — رفع `dist` بعد البناء محلياً

```powershell
cd G:\end\control
npm run build
scp -r .\dist\* USER@SERVER_IP:/opt/control/dist/
```

تنفيذ أمر على السيرفر من جهازك:

```powershell
ssh USER@SERVER_IP "cd /opt/control && git pull && sudo systemctl reload caddy"
```

---

## قائمة تحقق بعد التحديث

1. الدخول إلى مجلد المشروع على السيرفر
2. `git pull`
3. بناء الواجهة أو رفع `dist`
4. `reload` أو `restart` لـ Caddy والخدمات التابعة
5. فتح الموقع واختبار API إن وُجد
