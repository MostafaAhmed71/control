import JSZip from 'jszip';

const identity = (value) => String(value ?? '').trim().replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/^0+/, '');
const text = (value) => String(value ?? '').trim();
const safeName = (value) => text(value).replace(/[<>:"/\\|?*]/g, '_').slice(0, 130);

// The unnamed custom option is the control app's standard customizable NAFS sheet.
const defaultCustomConfig = {
  school_name: 'مدارس نخبة الشمال الأهلية والعالمية',
  exam_name: 'الأختبار المحاكي لاختبار نافس 2026 (اختبار مجمع)',
  year: 'العام الدراسي ١٤٤٧ هــ',
  principal: 'مدير المدرسة : محمد نصر الدين',
  footer: 'نظام التصحيح الآلي بمدارس نخبة الشمال الأهلية والعالمية',
  show_name_row: true, show_day_row: true, show_date_row: true,
  show_class_row: true, show_subject_row: true, show_seat_row: true,
  show_committee_row: true, header_class_text: '', header_subject_text: '', logoDataUrl: '',
};

export function sameRetakeStudent(a, b) {
  if (a.nationalId && b.nationalId) return identity(a.nationalId) === identity(b.nationalId);
  if (a.studentId && b.studentId) return identity(a.studentId) === identity(b.studentId);
  return Boolean(a.seatNumber && b.seatNumber && identity(a.seatNumber) === identity(b.seatNumber) && text(a.studentGrade) === text(b.studentGrade));
}

/** Validate every match before generating personalized, blank OMR sheets. */
export function prepareRetakeBatches(requests, exams, students, settings = {}) {
  const batches = new Map();
  const seen = new Set();
  for (const request of requests.filter((item) => item.status === 'confirmed')) {
    const label = `${request.studentName || 'الطالب'} — ${request.examTitle || 'الاختبار'}`;
    const matchingExams = exams.filter((exam) => request.examId
      ? text(exam.id) === text(request.examId)
      : text(exam.title) === text(request.examTitle) && [exam.grade, ...(exam.grades || [])].some((grade) => text(grade) === text(request.studentGrade)));
    if (matchingExams.length !== 1) throw new Error(`تعذر تحديد الاختبار بدقة: ${label}`);
    const exam = matchingExams[0];
    // National ID takes priority; never silently switch to a different student's seat.
    const matches = students.filter((student) => request.nationalId
      ? identity(student.nationalId || student.national_id) === identity(request.nationalId)
      : request.studentId
        ? identity(student.id) === identity(request.studentId)
        : identity(student.seatNumber || student.seat_number) === identity(request.seatNumber) && text(student.grade) === text(request.studentGrade));
    if (matches.length !== 1) throw new Error(`تعذر مطابقة بيانات الطالب بدقة: ${label}`);
    const student = matches[0];
    const nationalId = text(student.nationalId || student.national_id);
    if (!nationalId) throw new Error(`رقم هوية الطالب غير مسجل: ${label}`);
    const scheduledDate = request.scheduledDate || (settings.retakeSchedule?.date ? `${settings.retakeSchedule.date}T${settings.retakeSchedule.time || '08:00'}:00` : '');
    const date = new Date(scheduledDate);
    if (!scheduledDate || Number.isNaN(date.getTime())) throw new Error(`موعد الإعادة غير محدد: ${label}`);
    const template = exam.template || 'nafs';
    const isCustom = template === 'custom' || template.startsWith('custom:');
    const customConfig = isCustom ? (exam.template_config || exam.customConfig || (template === 'custom' ? defaultCustomConfig : null)) : null;
    if ((template === 'custom' || template.startsWith('custom:')) && !customConfig) {
      throw new Error(`افتح «إدارة الاختبارات» على جهاز الكنترول مرة واحدة لمزامنة القالب المحفوظ للاختبار «${exam.title}»، ثم أعد التصدير من البوابة.`);
    }
    const duplicate = JSON.stringify([text(exam.id), nationalId, scheduledDate]);
    if (seen.has(duplicate)) continue;
    seen.add(duplicate);
    const key = JSON.stringify([text(exam.id), text(student.grade || request.studentGrade), scheduledDate]);
    if (!batches.has(key)) batches.set(key, {
      name: `${exam.subject || exam.title} - ${student.grade || request.studentGrade} - ${date.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' })}`,
      endpoint: customConfig ? '/generate-custom-batch' : '/generate-batch',
      body: {
        subject: exam.subject || exam.title,
        exam_id: text(exam.id),
        template,
        ...(customConfig ? { template_config: customConfig } : {}),
        num_questions: template === 'watania' ? 30 : (Number(exam.qCount) || 30),
        school_code: text(settings.moeSchoolCode),
        students: [],
      },
    });
    batches.get(key).body.students.push({
      id: nationalId,
      national_id: nationalId,
      name: student.name || request.studentName,
      class_name: student.grade || request.studentGrade || '',
      subject: exam.subject || exam.title,
      date: date.toLocaleDateString('ar-SA', { timeZone: 'Asia/Riyadh' }),
      day: date.toLocaleDateString('ar-SA', { timeZone: 'Asia/Riyadh', weekday: 'long' }),
      seat_number: text(student.seatNumber || student.seat_number || request.seatNumber),
      committee_number: text(student.committee).replace(/[^0-9٠-٩]/g, ''),
      school_code: text(settings.moeSchoolCode),
    });
  }
  return [...batches.values()];
}

async function generateExamFiles(batches, onProgress, acceptFile) {
  if (!batches.length) throw new Error('لا توجد اختبارات للطباعة.');
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    onProgress(`${i + 1} / ${batches.length}`);
    const template = batch.body.template;
    if (template === 'nafs' || template === 'custom' || template?.startsWith('custom:')) {
      const [{ createBrowserOmrPdf }, assets] = await Promise.all([import('./browserOmrSheet.js'), import('./browserOmrAssets.js')]);
      const bytes = await createBrowserOmrPdf(batch.body, {
        ...assets,
        onSheet: (done, total) => onProgress(`${i + 1} / ${batches.length} · ${done} / ${total}`),
      });
      await acceptFile(bytes, `${i + 1}-${safeName(batch.name)}.pdf`);
      continue;
    }
    const base = (import.meta.env.VITE_OMR_API_BASE || 'http://127.0.0.1:8000').replace(/\/$/, '');
    let response;
    try {
      response = await fetch(`${base}${batch.endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch.body) });
    } catch {
      throw new Error('تعذر الاتصال بمحرك طباعة الاختبارات. شغّل خدمة OMR على جهاز الكنترول أو اضبط عنوانها في إعدادات تشغيل البوابة.');
    }
    if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) throw new Error(`تعذر إنشاء أوراق الاختبار: ${batch.name}`);
    await acceptFile(await response.arrayBuffer(), `${i + 1}-${safeName(batch.name)}.pdf`);
  }
}

export async function createPrintableExamPdf(batches, onProgress = () => {}) {
  const { PDFDocument } = await import('pdf-lib');
  const combined = await PDFDocument.create();
  await generateExamFiles(batches, onProgress, async (bytes) => {
    const source = await PDFDocument.load(bytes);
    const pages = await combined.copyPages(source, source.getPageIndices());
    pages.forEach((page) => combined.addPage(page));
  });
  return new Blob([await combined.save()], { type: 'application/pdf' });
}

export async function exportRetakeExams(batches, onProgress = () => {}) {
  const zip = new JSZip();
  await generateExamFiles(batches, onProgress, (bytes, name) => { zip.file(name, bytes); });
  const url = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'اختبارات الإعادة المؤكدة.zip';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
