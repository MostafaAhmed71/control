# استعلام المعلمين — نسخة مستقلة

صفحة واحدة للبحث بالاسم (الأول أو الأول+الثاني) وعرض **رقم الجلوس** و**رقم اللجنة** و**مقر اللجنة**.

تتصل بنفس Supabase الخاص بمنصة الكنترول — **بدون** كلمة مرور Caddy.

---

## 1) الإعداد محلياً

```powershell
cd d:\end\control\teacher-lookup-standalone
copy .env.example .env
```

عدّل `.env` — انسخ `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` من `student-portal-standalone\.env` أو من مشروع Supabase.

```powershell
npm install
npm run dev
```

---

## 2) البناء للرفع

```powershell
npm run build
```

الملفات الجاهزة في مجلد `dist/`.

---

## 3) الرفع على دومين جديد (VPS)

مثال: `teacher.northelite0.com`

### رفع الملفات

```powershell
scp -r .\dist\* root@SERVER:/opt/teacher-lookup/dist/
```

### على السيرفر — Caddy (بدون basic auth)

```bash
sudo mkdir -p /opt/teacher-lookup/dist
sudo chown -R caddy:caddy /opt/teacher-lookup/dist
```

أضف في `/etc/caddy/Caddyfile`:

```caddy
teacher.northelite0.com {
    root * /opt/teacher-lookup/dist
    encode gzip zstd
    try_files {path} /index.html
    file_server
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---

## 4) DNS

سجّل A record للدومين الجديد → IP السيرفر (`72.62.178.181`).

---

## ملاحظات

- لا حاجة لتعديل Caddy على `control0.northelite0.com`.
- البيانات تُقرأ من جداول: `students`, `committees`, `locations`, `settings`.
- تأكد أن RLS في Supabase يسمح بالقراءة بمفتاح `anon` لهذه الجداول (كما في بوابة الطالب).
