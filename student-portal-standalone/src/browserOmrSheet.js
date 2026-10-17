import QRCode from 'qrcode';

// Pixel coordinates mirror generator_custom.py and omr_constants.py at 300 DPI.
export const OMR_LAYOUT = Object.freeze({
  width: 2481, height: 3507, margin: 150, marker: 80,
  headerX: 250, headerY: 452, headerWidth: 1701, rowHeight: 92,
  qrX: 1981, qrY: 460, qrSize: 350,
  questionY: 1044, optionSpacing: 140, bubbleRadius: 42,
  signatureY: 2953, principalY: 3075, footerY: 3319,
});

const defaults = {
  school_name: 'مدارس نخبة الشمال الأهلية والعالمية',
  exam_name: 'الاختبار المحاكي لاختبار نافس 2026 (اختبار مجمع)',
  year: 'العام الدراسي ١٤٤٧ هــ', principal: 'مدير المدرسة : محمد نصر الدين',
  footer: 'نظام التصحيح الآلي بمدارس نخبة الشمال الأهلية والعالمية',
};

const visible = (cfg, key) => cfg[key] == null || ![false, 0, '0', 'false', 'no', 'off'].includes(cfg[key]);

export function browserOmrQrPayload(student, batch) {
  const value = { id: String(student.national_id || student.id || ''), nq: Number(batch.num_questions), tpl: batch.template === 'nafs' ? 'nafs' : 'custom' };
  if (batch.exam_id) value.ex = String(batch.exam_id);
  return JSON.stringify(value);
}

export function browserOmrQuestionRows(count) {
  if (!Number.isInteger(count) || count < 1 || count > 60) throw new Error('عدد الأسئلة غير مدعوم للطباعة من المتصفح (من 1 إلى 60).');
  const half = Math.ceil(count / 2);
  const available = OMR_LAYOUT.signatureY - 40 - OMR_LAYOUT.questionY - 150;
  const spacing = half <= 1 ? 115 : Math.max(78, Math.min(115, Math.floor(available / (half - 1))));
  return Array.from({ length: count }, (_, index) => {
    const columnX = index < half ? 1270 : 150;
    const numberRight = columnX + 1060 - 10;
    return { number: index + 1, numberRight, y: OMR_LAYOUT.questionY + (index % half) * spacing,
      bubbles: Array.from({ length: 4 }, (_, option) => ({ x: numberRight - 120 - option * 140, radius: 42 })) };
  });
}

const makeCanvas = () => document.createElement('canvas');
const loadBrowserImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  const timer = setTimeout(() => reject(new Error('تعذر تحميل شعار القالب. حاول مرة أخرى.')), 15000);
  img.onload = () => { clearTimeout(timer); resolve(img); };
  img.onerror = () => { clearTimeout(timer); reject(new Error('تعذر تحميل شعار القالب.')); };
  img.src = src;
});

/** All personalized pixels and QR modules are drawn locally; no OMR HTTP call. */
export async function renderBrowserOmrSheet(student, batch, options = {}) {
  const rows = browserOmrQuestionRows(Number(batch.num_questions));
  const cfg = { ...defaults, ...(batch.template_config || {}) };
  const canvas = (options.createCanvas || makeCanvas)();
  const loadImage = options.loadImage || loadBrowserImage;
  canvas.width = OMR_LAYOUT.width;
  canvas.height = OMR_LAYOUT.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
  ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
  const family = '"Noto Naskh Arabic", Tahoma, Arial, sans-serif';

  function write(text, x, y, size = 55, align = 'right', maxWidth, bold = false) {
    ctx.font = `${bold ? 700 : 400} ${size}px ${family}`;
    ctx.textAlign = align;
    // Fit labels without moving any of the scanner geometry.
    while (maxWidth && ctx.measureText(String(text || '')).width > maxWidth && size > 22) {
      ctx.font = `${bold ? 700 : 400} ${--size}px ${family}`;
    }
    ctx.fillText(String(text || ''), x, y);
  }

  for (const x of [150, 2251]) for (const y of [150, 3277]) ctx.fillRect(x, y, 80, 80);
  ctx.strokeRect(150, 150, 2181, 290);
  write(cfg.school_name, 1240.5, 225, 60, 'center', 1350, true);
  write(cfg.exam_name, 1240.5, 300, 48, 'center', 1350);
  write(cfg.year, 1240.5, 375, 48, 'center', 1350);

  const customLogo = cfg.logoDataUrl;
  const schoolLogo = options.schoolLogo;
  const ministryLogo = options.ministryLogo;
  const logoCache = new Map();
  for (const [side, src] of [['right', customLogo || schoolLogo], ['left', customLogo || ministryLogo || schoolLogo]]) {
    if (!src) continue;
    if (customLogo && !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(customLogo)) throw new Error('صيغة شعار القالب غير مدعومة. استخدم صورة PNG أو JPG.');
    if (!logoCache.has(src)) logoCache.set(src, await loadImage(src));
    const logo = logoCache.get(src);
    const scale = Math.min(220 / logo.height, 265 / logo.width);
    const width = logo.width * scale; const height = logo.height * scale;
    ctx.drawImage(logo, side === 'right' ? 2181 - width : 300, 150 + (290 - height) / 2, width, height);
  }

  let headerY = 452;
  function cell(label, value, left, right) {
    write(`${label} ${value || ''}`, right - 40, headerY + 46, 58, 'right', right - left - 80);
  }
  function full(label, value) {
    ctx.strokeRect(250, headerY, 1701, 92); cell(label, value, 250, 1951); headerY += 92;
  }
  function split(right, left) {
    if (!right && !left) return;
    if (!right || !left) { full(...(right || left)); return; }
    ctx.strokeRect(250, headerY, 1701, 92);
    ctx.beginPath(); ctx.moveTo(1100.5, headerY); ctx.lineTo(1100.5, headerY + 92); ctx.stroke();
    cell(...right, 1100.5, 1951); cell(...left, 250, 1100.5); headerY += 92;
  }
  if (visible(cfg, 'show_name_row')) full('اسم الطالب:', student.name);
  split(visible(cfg, 'show_day_row') ? ['اليوم:', student.day] : null, visible(cfg, 'show_date_row') ? ['التاريخ:', student.date] : null);
  split(visible(cfg, 'show_subject_row') ? ['المادة:', cfg.header_subject_text || student.subject || batch.subject] : null, visible(cfg, 'show_class_row') ? ['الصف:', cfg.header_class_text || student.class_name] : null);
  split(visible(cfg, 'show_committee_row') ? ['رقم اللجنة:', student.committee_number] : null, visible(cfg, 'show_seat_row') ? ['رقم الجلوس:', student.seat_number] : null);

  const matrix = QRCode.create(browserOmrQrPayload(student, batch), { errorCorrectionLevel: 'M' }).modules;
  const moduleSize = 350 / (matrix.size + 2);
  ctx.fillStyle = '#fff'; ctx.fillRect(1981, 460, 350, 350); ctx.fillStyle = '#000';
  for (let y = 0; y < matrix.size; y++) for (let x = 0; x < matrix.size; x++) {
    if (!matrix.get(y, x)) continue;
    const left = Math.round((x + 1) * moduleSize); const top = Math.round((y + 1) * moduleSize);
    ctx.fillRect(1981 + left, 460 + top, Math.round((x + 2) * moduleSize) - left, Math.round((y + 2) * moduleSize) - top);
  }

  const subject = String(cfg.header_subject_text || batch.subject || '').toLowerCase();
  const labels = /english|انجليز|إنجليز/.test(subject) ? ['A', 'B', 'C', 'D'] : ['أ', 'ب', 'ج', 'د'];
  for (const row of rows.filter((item) => item.number === 1 || item.number === Math.ceil(rows.length / 2) + 1)) {
    row.bubbles.forEach((bubble, index) => write(labels[index], bubble.x, 968, 35, 'center'));
  }
  for (const row of rows) {
    write(`${row.number}.`, row.numberRight, row.y + 8, 35);
    ctx.lineWidth = 4;
    for (const bubble of row.bubbles) {
      ctx.beginPath(); ctx.arc(bubble.x, row.y, bubble.radius, 0, Math.PI * 2); ctx.stroke();
    }
  }

  ctx.lineWidth = 3; ctx.strokeRect(150, 2953, 2181, 100);
  write('توقيع اسم الطالب:', 2307, 2997, 55);
  ctx.font = `400 55px ${family}`;
  const lineRight = 2307 - ctx.measureText('توقيع اسم الطالب:').width - 24;
  ctx.beginPath(); ctx.moveTo(186, 3027); ctx.lineTo(lineRight, 3027); ctx.stroke();
  write(cfg.principal, 190, 3110, 55, 'left', 2100);
  write(cfg.footer, 1240.5, 3350, 55, 'center', 2181);
  return canvas;
}

export async function createBrowserOmrPdf(batch, options = {}) {
  const { jsPDF } = await import('jspdf');
  if (typeof document !== 'undefined' && document.fonts) {
    await Promise.all([document.fonts.load('400 55px "Noto Naskh Arabic"'), document.fonts.load('700 60px "Noto Naskh Arabic"')]);
  }
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  for (let index = 0; index < batch.students.length; index++) {
    const sheet = await renderBrowserOmrSheet(batch.students[index], batch, options);
    if (index) pdf.addPage();
    pdf.addImage(sheet.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, 210, 297);
    sheet.width = sheet.height = 0;
    options.onSheet?.(index + 1, batch.students.length);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return pdf.output('arraybuffer');
}
