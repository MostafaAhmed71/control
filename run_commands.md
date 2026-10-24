# أوامر تشغيل المشروع

### تشغيل سريع بنقرة واحدة:
يمكنك تشغيل كل من المحرك والواجهة معاً عبر الملف:
- **`start-all.bat`** (يقوم بتشغيل محرك OMR في نافذة مستقلة والواجهة الأمامية في النافذة الحالية).
- ولإيقاف أي خدمات معلقة على المنافذ: **`stop-all.bat`**.

أو يمكنك تشغيلهما يدوياً كما هو موضح أدناه:


## 1. محرك الأوراق (OMR Engine)

يفتح FastAPI على المنفذ **8000**.

```powershell
cd "G:\mostafa2027\end\control\omr_engine"
.\venv312\Scripts\python.exe main.py
```

تحقق: افتح [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### أول مرة (إن لم يوجد `venv312`)

استخدم **`py`** وليس `python` — على Windows قد يشير `python` إلى Microsoft Store.

```powershell
cd "F:\mostafa2027\end\control\omr_engine"
py -3.12 -m venv venv312
.\venv312\Scripts\python.exe -m pip install -r requirements.txt
.\venv312\Scripts\python.exe main.py
```

---

## 2. الواجهة (البرنامج الرئيسي)

من مجلد المشروع، بعد تشغيل المحرك:

```powershell
cd "G:\mostafa2027\end\control"
npm install
npm run dev
```

Vite يفتح الواجهة على [http://localhost:5173](http://localhost:5173) ويحوّل طلبات `/api/omr` إلى المحرك على المنفذ 8000.

لتشغيل الواجهة داخل Electron:

```powershell
cd "G:\mostafa2027\end\control"
npm run dev:electron
```
