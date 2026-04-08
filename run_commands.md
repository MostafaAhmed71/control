# أوامر تشغيل المشروع

## 1. تشغيل محرك الأوراق (OMR Engine)
لتشغيل خادم `omr_engine`، افتح موجه الأوامر (Terminal) أو PowerShell وانتقل إلى مسار المحرك، ثم قم بتفعيل البيئة الافتراضية (venv) وتشغيل ملف `main.py` باستخدام الأوامر التالية:

```powershell
cd "G:\New folder\control\control\omr_engine"
.\venv\Scripts\python.exe main.py
```
*(هذا سيقوم بتشغيل خادم FastAPI الخاص بمحرك OMR على المنفذ 8000)*

## 2. تشغيل واجهة المشروع (البرنامج الرئيسي)
لتشغيل المشروع الكامل (واجهة React/Vite مع تطبيق Electron)، افتح موجه أوامر **جديد** وانتقل إلى المسار الرئيسي للمشروع وقم بتنفيذ الأمر الخاص ببدء التشغيل:

```powershell
cd "G:\New folder\control\control"
npm run dev
```

*(أو إذا أردت تشغيل بيئة Electron بشكل مباشر بعد Vite يمكنك استخدام: `npm run dev:electron`)*
