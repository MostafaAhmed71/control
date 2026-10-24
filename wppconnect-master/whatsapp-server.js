/**
 * WhatsApp Results Server
 * يُرسل نتائج الطلاب عبر واتساب باستخدام WPPConnect
 * 
 * تشغيل: node whatsapp-server.js
 */

import wppconnect from '@wppconnect-team/wppconnect';
import express from 'express';
import cors from 'cors';
import { createCanvas } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3001;
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

let wppClient = null;
let sessionStatus = 'disconnected'; // disconnected | connecting | qr | connected
let latestQRBase64 = '';
let latestPairingCode = '';
let pairingPhone = '';
let isStarting = false;

const SESSION_TOKEN_DIR = path.join(__dirname, 'tokens', 'control-school');

/** مسارات Chrome / Chromium (Windows + Linux/VPS) */
function resolveChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/snap/chromium/current/usr/lib/chromium-browser/chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ].filter(Boolean);

  if (process.platform !== 'win32') {
    try {
      const snapRoot = '/snap/chromium';
      if (fs.existsSync(snapRoot)) {
        for (const ver of fs.readdirSync(snapRoot)) {
          const p = path.join(snapRoot, ver, 'usr/lib/chromium-browser/chrome');
          if (fs.existsSync(p)) candidates.push(p);
        }
      }
    } catch {
      /* ignore */
    }
  }

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** إيقاف Chromium العالق بعد logout أو تعطل الجلسة (شائع على VPS) */
async function killSessionBrowsers() {
  const tokenNeedle = SESSION_TOKEN_DIR.replace(/\\/g, '/');
  if (process.platform === 'win32') {
    try {
      await execAsync(`taskkill /F /IM chrome.exe /T 2>nul`);
      await execAsync(`taskkill /F /IM msedge.exe /T 2>nul`);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await execAsync(`pkill -f "${tokenNeedle}" 2>/dev/null || true`);
    await execAsync('pkill -f "control-school" 2>/dev/null || true');
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 800));
}

/* ─────────── WhatsApp Session ─────────── */
async function startWhatsApp(phoneNumber = null) {
  if (isStarting) {
    console.log('⏳ تهيئة واتساب قيد التنفيذ already — تخطي');
    return wppClient;
  }
  isStarting = true;

  console.log(phoneNumber ? `🟡 جاري تهيئة واتساب للربط بالرقم: ${phoneNumber}...` : '🟡 جاري تهيئة واتساب (QR)...');
  sessionStatus = 'connecting';
  pairingPhone = phoneNumber;
  latestPairingCode = '';

  try {
    const chromePath = resolveChromeExecutable();
    if (!chromePath) {
      throw new Error(
        'لم يُعثر على Google Chrome أو Edge. ثبّت Chrome أو شغّل: npm run install-browser'
      );
    }
    console.log('🌐 المتصفح:', chromePath);

    const client = await wppconnect.create({
      session: 'control-school',
      catchQR: (base64Qr, asciiQR) => {
        sessionStatus = 'qr';
        latestQRBase64 = base64Qr;
        latestPairingCode = '';
        console.log('🔳 QR Code جاهز');
      },
      phoneNumber: pairingPhone || undefined,
      catchLinkCode: (code) => {
        sessionStatus = 'qr'; // Use the same status for consistency
        latestPairingCode = code;
        latestQRBase64 = ''; // Clear QR if we are using code
        console.log('🔢 Pairing Code:', code);
      },
      statusFind: (statusSession) => {
        console.log('📱 حالة واتساب:', statusSession);
        if (statusSession === 'isLogged' || statusSession === 'qrReadSuccess' || statusSession === 'inChat') {
          sessionStatus = 'connected';
          latestQRBase64 = '';
          latestPairingCode = '';
        }
      },
      headless: true,
      useChrome: true,
      puppeteerOptions: { executablePath: chromePath },
      logQR: false,
      autoClose: 0,
      protocolTimeout: 120000,
      browserArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-extensions'
      ]
    });

    wppClient = client;
    sessionStatus = 'connected';
    console.log('✅ تم الاتصال بواتساب بنجاح!');
    return client;
  } catch (err) {
    sessionStatus = 'disconnected';
    console.error('❌ فشل الاتصال:', err.message);
    throw err;
  } finally {
    isStarting = false;
  }
}

/** تسجيل خروج، مسح الجلسة المحفوظة، وإعادة التشغيل (اختياري برقم للربط بالكود) */
async function logoutAndRestart({ phone = null, delayMs = 1200 } = {}) {
  console.log(phone ? `🔴 تسجيل خروج — إعادة الربط بالرقم: ${phone}` : '🔴 تسجيل خروج — جلسة جديدة (QR)...');

  if (wppClient) {
    try { await wppClient.logout(); } catch (e) { /* قد يكون مغلقاً */ }
    try { await wppClient.close(); } catch (e) { /* ignore */ }
    wppClient = null;
  }

  await killSessionBrowsers();

  sessionStatus = 'disconnected';
  latestQRBase64 = '';
  latestPairingCode = '';
  pairingPhone = phone || '';
  isStarting = false;

  if (fs.existsSync(SESSION_TOKEN_DIR)) {
    try {
      fs.rmSync(SESSION_TOKEN_DIR, { recursive: true, force: true });
    } catch (e) {
      console.warn('⚠️ تعذّر حذف مجلد الجلسة:', e.message);
    }
  }

  await new Promise((r) => setTimeout(r, delayMs));
  startWhatsApp(phone || null).catch((e) => console.error('❌ بدء QR بعد logout:', e.message));
}

/* ─────────── Result Image Generator ─────────── */
function generateResultImage(result) {
  const W = 800, H = 500;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  const passed = parseFloat(result.percentage) >= 50;
  grad.addColorStop(0, passed ? '#0f4c75' : '#6b0f0f');
  grad.addColorStop(1, passed ? '#1b262c' : '#1a0000');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // White card
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  roundRect(ctx, 40, 40, W - 80, H - 80, 20);
  ctx.restore();

  // School header
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('نتيجة الاختبار', W / 2, 90);

  // Exam title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Arial';
  ctx.fillText(result.examTitle || 'اختبار OMR', W / 2, 125);

  // Student name
  ctx.font = 'bold 30px Arial';
  ctx.fillStyle = '#ffe082';
  ctx.fillText(result.studentName || 'الطالب', W / 2, 185);

  // Grade badge
  const scoreText = `${result.score} / ${result.total}`;
  const pctText = `${result.percentage}%`;
  const badgeColor = passed ? '#00c853' : '#f44336';

  ctx.beginPath();
  ctx.arc(W / 2, 290, 80, 0, Math.PI * 2);
  ctx.fillStyle = badgeColor;
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Arial';
  ctx.fillText(scoreText, W / 2, 283);
  ctx.font = 'bold 20px Arial';
  ctx.fillText(pctText, W / 2, 313);

  // Status
  ctx.font = 'bold 26px Arial';
  ctx.fillStyle = passed ? '#a5d6a7' : '#ef9a9a';
  ctx.fillText(passed ? '✓ ناجح' : '✗ راسب', W / 2, 400);

  // Date
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '14px Arial';
  ctx.fillText(new Date(result.timestamp || Date.now()).toLocaleDateString('ar-SA'), W / 2, 445);

  return canvas.toBuffer('image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

/* ─────────── Format WhatsApp Number ─────────── */
function formatPhone(phone) {
  let p = phone.toString().replace(/\D/g, '');
  // إذا بدأ بـ 05 (سعودي) → أضف 966
  if (p.startsWith('05')) p = '966' + p.slice(1);
  // إذا بدأ بـ 5 → أضف 966
  if (p.startsWith('5') && p.length === 9) p = '966' + p;
  // تأكد من إضافة @c.us
  return p.includes('@c.us') ? p : `${p}@c.us`;
}

/* ─────────── API Endpoints ─────────── */

// الحالة الحالية للاتصال
app.get('/status', (req, res) => {
  res.json({ status: sessionStatus, connected: sessionStatus === 'connected' });
});
// عرض QR Code كبيانات JSON للواجهات
app.get('/qr-json', (req, res) => {
  res.json({
    status: sessionStatus,
    qr: latestQRBase64,
    pairingCode: latestPairingCode,
    connected: sessionStatus === 'connected'
  });
});
// عرض QR Code حي ومتجدد
app.get('/qr', (req, res) => {
  if (sessionStatus === 'connected') {
    return res.send(`
      <html dir="rtl" style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
        <h2 style="color: green;">✅ الواتساب متصل الآن!</h2>
        <p>الخدمة جاهزة للإرسال. يمكنك إرسال النتائج من صفحة التصحيح.</p>
        <script>setTimeout(() => location.reload(), 30000);</script>
      </html>
    `);
  }

  if (latestQRBase64 && sessionStatus !== 'disconnected') {
    return res.send(`
      <html dir="rtl" style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
        <h2>امسح الـ QR Code لتفعيل الإرسال</h2>
        <p style="color: gray;">سيتم تحديث الكود تلقائياً كل دقيقة لتجنب انتهاء صلاحيته</p>
        <img src="${latestQRBase64}" width="280" height="280" style="border: 1px solid #ccc; padding: 15px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);" />
        <script>
          // التحديث التلقائي للحصول على أحدث QR
          setTimeout(() => location.reload(), 60000);
        </script>
      </html>
    `);
  }

  res.send(`
    <html dir="rtl" style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
      <h2 style="color: orange;">⏳ جاري إعداد الواتساب وتوليد الرمز...</h2>
      <p>انتظر بضع ثوانٍ</p>
      <script>setTimeout(() => location.reload(), 3000);</script>
    </html>
  `);
});

// الربط عبر رقم الجوال (Pairing Code)
app.post('/pair-phone', async (req, res) => {
  let { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'رقم الجوال مطلوب' });

  try {
    console.log(`📱 طلب ربط برقم الجوال: ${phone}`);
    
    // تنظيف وتنسيق الرقم
    let cleanPhone = phone.toString().replace(/\D/g, '');
    if (cleanPhone.startsWith('05')) cleanPhone = '966' + cleanPhone.slice(1);
    else if (cleanPhone.startsWith('5') && cleanPhone.length === 9) cleanPhone = '966' + cleanPhone;
    
    await logoutAndRestart({ phone: cleanPhone });
    res.json({ success: true, message: 'جاري توليد كود الربط...' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تسجيل الخروج وتبديل الحساب (JSON — للواجهة)
app.post('/logout', async (req, res) => {
  try {
    await logoutAndRestart();
    res.json({ success: true, message: 'تم تسجيل الخروج. امسح QR أو أدخل رقماً جديداً.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إعادة تعيين الاتصال (مطابق لـ POST /logout)
app.post('/reset', async (req, res) => {
  try {
    await logoutAndRestart();
    res.json({ success: true, message: 'تم إعادة التعيين، جاري التشغيل...' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تسجيل الخروج (نسخة HTML للمتصفح المباشر)
app.get('/logout', async (req, res) => {
  try {
    res.send(`
      <html dir="rtl" style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
        <h2 style="color: red;">👋 تم تسجيل الخروج بنجاح ومسح البيانات القديمة!</h2>
        <p>سيتم تحويلك الآن لمسح الرمز الجديد...</p>
        <script>setTimeout(() => location.href = '/qr', 3000);</script>
      </html>
    `);
    await logoutAndRestart({ delayMs: 1000 });
  } catch (err) {
    res.status(500).send('خطأ في تسجيل الخروج: ' + err.message);
  }
});

// إرسال نتيجة طالب واحد
app.post('/send-result', async (req, res) => {
  const { phone, result } = req.body;

  if (!phone)   return res.status(400).json({ error: 'رقم الجوال مطلوب' });
  if (!result)  return res.status(400).json({ error: 'بيانات النتيجة مطلوبة' });
  if (!wppClient || sessionStatus !== 'connected')
    return res.status(503).json({ error: 'واتساب غير متصل — افتح /qr وامسح الكود' });

  try {
    const phoneFormatted = formatPhone(phone);
    
    // رسالة نصية أولاً
    const passed = parseFloat(result.percentage) >= 50;
    const msg = `📊 *نتيجة الاختبار*\n` +
                `👤 *الطالب:* ${result.studentName}\n` +
                `📝 *الاختبار:* ${result.examTitle || 'OMR'}\n` +
                `✏️ *الدرجة:* ${result.score} من ${result.total}\n` +
                `📈 *النسبة:* ${result.percentage}%\n` +
                `${passed ? '✅ *النتيجة: ناجح*' : '❌ *النتيجة: راسب*'}`;

    await wppClient.sendText(phoneFormatted, msg);

    // إرسال الصورة
    const imgBuffer = generateResultImage(result);
    const base64Img = `data:image/png;base64,${imgBuffer.toString('base64')}`;
    await wppClient.sendImageFromBase64(phoneFormatted, base64Img, 'result.png', `نتيجة ${result.studentName}`);

    console.log(`✅ أُرسلت نتيجة ${result.studentName} إلى ${phone}`);
    res.json({ success: true, message: `تم الإرسال إلى ${phone}` });

  } catch (err) {
    console.error('❌ خطأ في الإرسال:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// إرسال دفعة لعدة طلاب
app.post('/send-bulk', async (req, res) => {
  const { results } = req.body; // [{ phone, result }]
  if (!Array.isArray(results) || results.length === 0)
    return res.status(400).json({ error: 'القائمة فارغة' });
  if (!wppClient || sessionStatus !== 'connected')
    return res.status(503).json({ error: 'واتساب غير متصل' });

  const report = [];
  for (const item of results) {
    if (!item.phone || !item.result) {
      report.push({ name: item.result?.studentName || '?', status: 'skip', reason: 'لا يوجد رقم' });
      continue;
    }
    try {
      const phoneFormatted = formatPhone(item.phone);
      const passed = parseFloat(item.result.percentage) >= 50;
      const msg = `📊 *نتيجة الاختبار*\n` +
                  `👤 *الطالب:* ${item.result.studentName}\n` +
                  `📝 *الاختبار:* ${item.result.examTitle || 'OMR'}\n` +
                  `✏️ *الدرجة:* ${item.result.score} من ${item.result.total}\n` +
                  `📈 *النسبة:* ${item.result.percentage}%\n` +
                  `${passed ? '✅ ناجح' : '❌ راسب'}`;

      await wppClient.sendText(phoneFormatted, msg);
      const imgBuffer = generateResultImage(item.result);
      const base64Img = `data:image/png;base64,${imgBuffer.toString('base64')}`;
      await wppClient.sendImageFromBase64(phoneFormatted, base64Img, 'result.png', `نتيجة ${item.result.studentName}`);

      report.push({ name: item.result.studentName, phone: item.phone, status: 'sent' });
      // تأخير بين كل إرسال
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      report.push({ name: item.result?.studentName, phone: item.phone, status: 'error', reason: err.message });
    }
  }

  const sent = report.filter(r => r.status === 'sent').length;
  res.json({ success: true, sent, total: results.length, report });
});

// إرسال صورة مجهزة مسبقاً (Base64) - مفيد لبطاقات اللجان وغيرها
app.post('/send-image', async (req, res) => {
  const { phone, imageBase64, caption } = req.body;
  if (!phone || !imageBase64) return res.status(400).json({ error: 'البيانات ناقصة (رقم الجوال أو الصورة)' });
  if (!wppClient || sessionStatus !== 'connected')
    return res.status(503).json({ error: 'واتساب غير متصل' });

  try {
    const phoneFormatted = formatPhone(phone);
    await wppClient.sendImageFromBase64(phoneFormatted, imageBase64, 'card.png', caption || '');
    res.json({ success: true, message: `تم إرسال الصورة لـ ${phone}` });
  } catch (err) {
    console.error('❌ خطأ في الإرسال:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────── Start ─────────── */
const server = app.listen(PORT, () => {
  console.log(`\n🚀 WhatsApp Server يعمل على http://localhost:${PORT}`);
  console.log(`📱 للاتصال: افتح http://localhost:${PORT}/qr وامسح QR Code`);
  console.log(`📊 للحالة:  GET  http://localhost:${PORT}/status`);
  console.log(`📤 للإرسال: POST http://localhost:${PORT}/send-result\n`);
  startWhatsApp().catch(console.error);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n⚠️ المنفذ ${PORT} مستخدم بالفعل — خادم واتساب يعمل من نسخة أخرى.\n` +
        `   • لا تشغّل npm start مرة ثانية؛ استخدم التطبيق مباشرة.\n` +
        `   • Linux: fuser -k ${PORT}/tcp && pm2 restart wppconnect\n` +
        `   • Windows: Get-NetTCPConnection -LocalPort ${PORT} | % { Stop-Process -Id $_.OwningProcess -Force }\n`
    );
    process.exit(1);
  }
  throw err;
});

