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
import { fileURLToPath } from 'url';

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

/* ─────────── WhatsApp Session ─────────── */
async function startWhatsApp(phoneNumber = null) {
  console.log(phoneNumber ? `🟡 جاري تهيئة واتساب للربط بالرقم: ${phoneNumber}...` : '🟡 جاري تهيئة واتساب (QR)...');
  sessionStatus = 'connecting';
  pairingPhone = phoneNumber;
  latestPairingCode = '';

  try {
    // محاولة تحديد مسار الكروميوم المدمج في نسخة الإنتاج
    const isProd = process.env.NODE_ENV === 'production' || !fs.existsSync(path.join(__dirname, 'node_modules'));
    
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
      useChrome: false, // سنعتمد على الكروميوم المدمج لضمان الاستقرار 100%
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
  }
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
        <p style="color: gray;">سيتم تحديث الكود تلقائياً كل 5 ثوانٍ لتجنب انتهاء صلاحيته</p>
        <img src="${latestQRBase64}" width="280" height="280" style="border: 1px solid #ccc; padding: 15px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);" />
        <script>
          // التحديث التلقائي للحصول على أحدث QR
          setTimeout(() => location.reload(), 5000);
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
    
    // إعادة تعيين الجلسة الحالية
    if (wppClient) {
      try { await wppClient.logout(); } catch(e) {}
      try { await wppClient.close(); } catch(e) {}
      wppClient = null;
    }
    sessionStatus = 'disconnected';
    
    const tokenPath = path.join(__dirname, 'tokens', 'control-school');
    if (fs.existsSync(tokenPath)) {
      fs.rmSync(tokenPath, { recursive: true, force: true });
    }

    res.json({ success: true, message: 'جاري توليد كود الربط...' });
    
    // تشغيل المحرك مع الرقم
    setTimeout(() => startWhatsApp(cleanPhone), 500);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تسجيل الخروج ومسح الجلسة القديمة والبدء من جديد (نسخة JSON للواجهة)
app.post('/reset', async (req, res) => {
  try {
    console.log('🔴 إعادة تعيين الجلسة بطلب من المستخدم...');
    if (wppClient) {
      try { await wppClient.logout(); } catch(e) {}
      try { await wppClient.close(); } catch(e) {}
      wppClient = null;
    }
    sessionStatus = 'disconnected';
    
    const tokenPath = path.join(__dirname, 'tokens', 'control-school');
    if (fs.existsSync(tokenPath)) {
      fs.rmSync(tokenPath, { recursive: true, force: true });
    }

    res.json({ success: true, message: 'تم إعادة التعيين، جاري التشغيل...' });
    
    // إعادة التشغيل فوراً (بدون رقم جوال ليعود للـ QR)
    setTimeout(() => startWhatsApp(), 500);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تسجيل الخروج ومسح الحساب القديم (نسخة HTML)
app.get('/logout', async (req, res) => {
  try {
    if (wppClient) {
      await wppClient.logout();
      await wppClient.close();
      wppClient = null;
    }
    sessionStatus = 'disconnected';
    
    // مسح مجلد التخزين
    const tokenPath = path.join(__dirname, 'tokens', 'control-school');
    if (fs.existsSync(tokenPath)) {
      fs.rmSync(tokenPath, { recursive: true, force: true });
    }

    res.send(`
      <html dir="rtl" style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
        <h2 style="color: red;">👋 تم تسجيل الخروج بنجاح ومسح البيانات القديمة!</h2>
        <p>سيتم تحويلك الآن لمسح الرمز الجديد...</p>
        <script>setTimeout(() => location.href = '/qr', 3000);</script>
      </html>
    `);

    // إعادة تشغيل المحرك لبدء جلسة نظيفة
    setTimeout(() => startWhatsApp(), 1000);

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
app.listen(PORT, () => {
  console.log(`\n🚀 WhatsApp Server يعمل على http://localhost:${PORT}`);
  console.log(`📱 للاتصال: افتح http://localhost:${PORT}/qr وامسح QR Code`);
  console.log(`📊 للحالة:  GET  http://localhost:${PORT}/status`);
  console.log(`📤 للإرسال: POST http://localhost:${PORT}/send-result\n`);
});

// بدء واتساب تلقائياً
startWhatsApp().catch(console.error);
