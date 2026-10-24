/** إعدادات الإرسال الجماعي — يمكن تعديلها من الواجهة */
export const DEFAULT_WA_BULK_CONFIG = {
  messageDelaySec: 10,
  batchSize: 50,
  batchPauseSec: 60,
};

/** مهلة انتظار استجابة خادم واتساب (بالمللي ثانية) */
export const WA_SEND_TIMEOUT_MS = 90_000;

/** النص الافتراضي المرفق مع الصورة في واتساب */
export const DEFAULT_WA_CAPTION = `عزيزي ولي الأمر :

السلام عليكم ورحمة الله وبركاته

يسرّنا تشريفكم بحضور حفل تخرج طلاب الصف المتوسط صباح الغد - حيث سيبدأ الحفل في تمام الساعة ٩ صباحًا - بمشيئة الله تعالى ، ونتطلع لمشاركتكم وإضفاء حضوركم الكريم. نأمل منكم تأكيد الحضور عبر الرابط المرفق .
https://hajz.northelite0.com/

أخوكم مدير المدرسة
محمد نصر الدين`;

const MAX_IMAGE_EDGE = 1600;
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;
const JPEG_QUALITY = 0.82;

export function estimateBulkDurationSec(count, config = DEFAULT_WA_BULK_CONFIG) {
  if (count <= 1) return 0;
  const gaps = count - 1;
  const batchPauses = Math.floor(gaps / config.batchSize);
  return gaps * config.messageDelaySec + batchPauses * config.batchPauseSec;
}

export function formatBulkDurationHint(count, config = DEFAULT_WA_BULK_CONFIG) {
  const sec = estimateBulkDurationSec(count, config);
  if (sec <= 0) return '';
  const min = Math.ceil(sec / 60);
  return min <= 1 ? 'أقل من دقيقة تقريباً' : `~${min} دقيقة تقريباً`;
}

export function bulkSendConfirmMessage(count, config = DEFAULT_WA_BULK_CONFIG) {
  const durationHint = formatBulkDurationHint(count, config);
  return (
    `إرسال الصورة عبر واتساب إلى ${count} طالب؟\n\n` +
    `• انتظار ${config.messageDelaySec} ثوانٍ بين كل رسالة والأخرى\n` +
    `• توقف ${config.batchPauseSec} ثانية كل ${config.batchSize} رسالة\n` +
    (durationHint ? `• الوقت المتوقع: ${durationHint}\n` : '') +
    `\nلا تغلق الصفحة أثناء الإرسال.`
  );
}

export function getBulkProgressMessage(progress, config = DEFAULT_WA_BULK_CONFIG) {
  if (!progress) return '';
  const { current, total, phase, secondsLeft, label } = progress;
  if (phase === 'sending') {
    return `جاري الإرسال ${current} من ${total}${label ? ` — ${label}` : ''}`;
  }
  if (phase === 'batch_pause') {
    return `توقف مؤقت بعد ${current} رسالة — متبقٍ ${secondsLeft} ثانية`;
  }
  return `انتظار ${config.messageDelaySec} ثوانٍ قبل الرسالة التالية — متبقٍ ${secondsLeft} ثانية`;
}

export async function waitBulkSendGap(messageIndex, total, setBulkProgress, config) {
  if (messageIndex >= total - 1) return;
  const sentSoFar = messageIndex + 1;
  const isBatchEnd = sentSoFar % config.batchSize === 0;
  const waitSec = isBatchEnd ? config.batchPauseSec : config.messageDelaySec;
  const phase = isBatchEnd ? 'batch_pause' : 'waiting';

  for (let s = waitSec; s > 0; s--) {
    setBulkProgress((prev) => (prev ? { ...prev, phase, secondsLeft: s } : prev));
    await new Promise((r) => setTimeout(r, 1000));
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('تعذّر تحميل الصورة'));
    img.src = src;
  });
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('تعذّر قراءة الملف'));
    reader.readAsDataURL(file);
  });
}

/** تصغير الصورة الكبيرة قبل الإرسال لتسريع الرفع وتقليل التعليق */
export async function prepareImageForWhatsApp(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const base64Part = String(dataUrl).split(',')[1] || '';
  const approxBytes = Math.ceil(base64Part.length * 0.75);
  const needsResize = approxBytes > MAX_IMAGE_BYTES || file.type === 'image/png';

  if (!needsResize) return dataUrl;

  const img = await loadImage(dataUrl);
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;
  const maxEdge = Math.max(width, height);

  if (maxEdge > MAX_IMAGE_EDGE) {
    const ratio = MAX_IMAGE_EDGE / maxEdge;
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

function formatFetchError(err, waBase) {
  if (err?.name === 'AbortError') {
    return 'انتهت مهلة الإرسال (90 ثانية). تحقق من ربط واتساب على الخادم أو صِغ حجم الصورة.';
  }
  const msg = String(err?.message || '');
  if (/failed to fetch|network|load failed/i.test(msg)) {
    return `تعذّر الوصول لخادم واتساب (${waBase}). تأكد من VITE_WHATSAPP_API_BASE وتشغيل الخادم.`;
  }
  return msg || 'فشل الإرسال';
}

export async function sendWhatsAppImage({ waBase, phone, imageBase64, caption }) {
  const base = String(waBase || '').replace(/\/$/, '');
  if (!base) throw new Error('عنوان خادم واتساب غير مضبوط.');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WA_SEND_TIMEOUT_MS);

  try {
    const res = await fetch(`${base}/send-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, imageBase64, caption: caption || '' }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `فشل الإرسال (HTTP ${res.status})`);
    }
    return data;
  } catch (err) {
    throw new Error(formatFetchError(err, base));
  } finally {
    clearTimeout(timeoutId);
  }
}

export function buildPersonalCaption(template, student) {
  return String(template || '')
    .replace(/\{name\}/g, student.name || '')
    .replace(/\{grade\}/g, student.grade || '')
    .replace(/\{committee\}/g, student.committee || '—')
    .replace(/\{seatNumber\}/g, student.seatNumber ?? student.seat_number ?? '—');
}
