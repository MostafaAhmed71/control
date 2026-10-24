import React, { useMemo, useState } from 'react';
import {
  Send,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  ImageUp,
  X,
  Smartphone,
  AlertTriangle,
  Search,
  User,
} from 'lucide-react';
import { COMMITTEE_STAGES } from './committeeUtils';
import { searchStudentsByName } from './studentNameSearch';
import { useWhatsAppConnection } from './useWhatsAppConnection';
import {
  DEFAULT_WA_BULK_CONFIG,
  bulkSendConfirmMessage,
  buildPersonalCaption,
  getBulkProgressMessage,
  waitBulkSendGap,
  sendWhatsAppImage,
  prepareImageForWhatsApp,
  DEFAULT_WA_CAPTION,
  formatBulkDurationHint,
} from './whatsappBulk';

function clampInt(value, min, max, fallback) {
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function WhatsAppConnectionBadge({ wa }) {
  const { status, apiBase } = wa;

  if (status.connected) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-black border border-emerald-100">
        <CheckCircle size={14} />
        واتساب متصل
      </span>
    );
  }

  if (status.status === 'server_down') {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-black border border-rose-100">
          <AlertTriangle size={14} />
          تعذّر الوصول لخادم واتساب
        </span>
        {apiBase && (
          <span className="text-[10px] font-bold text-slate-400 max-w-[220px] truncate" title={apiBase}>
            {apiBase}
          </span>
        )}
      </div>
    );
  }

  if (status.status === 'loading' || status.status === 'connecting') {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 text-amber-800 text-xs font-black border border-amber-100">
        <Loader2 size={14} className="animate-spin" />
        جاري التحقق...
      </span>
    );
  }

  if (status.status === 'qr' || status.status === 'disconnected') {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 text-amber-800 text-xs font-black border border-amber-100">
          <AlertTriangle size={14} />
          واتساب غير مربوط على الخادم
        </span>
        {apiBase && (
          <span className="text-[10px] font-bold text-slate-400 max-w-[220px] truncate" title={apiBase}>
            {apiBase}
          </span>
        )}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-black">
      <Loader2 size={14} className="animate-spin" />
      جاري الاتصال...
    </span>
  );
}

export default function WhatsAppBulkPanel({ students = [], config: appConfig }) {
  const wa = useWhatsAppConnection(appConfig);
  const [sendMode, setSendMode] = useState('single');
  const [stageFilter, setStageFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [caption, setCaption] = useState(DEFAULT_WA_CAPTION);
  const [bulkConfig, setBulkConfig] = useState({ ...DEFAULT_WA_BULK_CONFIG });
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [sendReport, setSendReport] = useState(null);
  const [singleSending, setSingleSending] = useState(false);
  const [singleStatus, setSingleStatus] = useState(null);

  const grades = useMemo(
    () =>
      [...new Set(students.map((s) => s.grade).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b), 'ar', { numeric: true })
      ),
    [students]
  );

  const filteredGrades = useMemo(() => {
    if (stageFilter === 'all') return grades;
    return [
      ...new Set(
        students
          .filter((s) => s.stage === stageFilter)
          .map((s) => s.grade)
          .filter(Boolean)
      ),
    ].sort((a, b) => String(a).localeCompare(String(b), 'ar', { numeric: true }));
  }, [students, stageFilter, grades]);

  const targets = useMemo(() => {
    let list = students;
    if (stageFilter !== 'all') list = list.filter((s) => s.stage === stageFilter);
    if (gradeFilter !== 'all') list = list.filter((s) => s.grade === gradeFilter);
    return list.filter((s) => s.phone);
  }, [students, stageFilter, gradeFilter]);

  const withoutPhone = useMemo(() => {
    let list = students;
    if (stageFilter !== 'all') list = list.filter((s) => s.stage === stageFilter);
    if (gradeFilter !== 'all') list = list.filter((s) => s.grade === gradeFilter);
    return list.filter((s) => !s.phone);
  }, [students, stageFilter, gradeFilter]);

  const studentMatches = useMemo(() => {
    const q = studentQuery.trim();
    if (!q) return [];
    const parts = q.split(/\s+/).filter(Boolean);
    if (parts.length > 2) return [];
    return searchStudentsByName(students, q).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'ar', { numeric: true })
    );
  }, [students, studentQuery]);

  const isSending = bulkSending || singleSending;

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة (JPG أو PNG).');
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setSendReport(null);
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

  const updateBulkConfig = (key, value) => {
    setBulkConfig((prev) => ({ ...prev, [key]: value }));
  };

  const selectStudent = (student) => {
    setSelectedStudent(student);
    setStudentQuery(student.name || '');
    setSingleStatus(null);
    setSendReport(null);
  };

  const clearSelectedStudent = () => {
    setSelectedStudent(null);
    setStudentQuery('');
    setSingleStatus(null);
  };

  const handleSendSingle = async () => {
    if (!selectedStudent) {
      alert('اختر طالباً أولاً.');
      return;
    }
    if (!selectedStudent.phone) {
      alert('لا يوجد رقم جوال مسجّل لهذا الطالب.');
      return;
    }
    if (!imageFile) {
      alert('اختر صورة للإرسال أولاً.');
      return;
    }
    if (!wa.status.connected) {
      alert('واتساب غير متصل. تأكد من تشغيل خادم واتساب وربط الجلسة.');
      return;
    }
    if (!window.confirm(`إرسال الصورة عبر واتساب إلى ${selectedStudent.name}؟`)) return;

    setSingleSending(true);
    setSingleStatus(null);
    setSendReport(null);

    try {
      const imageBase64 = await prepareImageForWhatsApp(imageFile);
      const personalCaption = caption.trim()
        ? buildPersonalCaption(caption.trim(), selectedStudent)
        : '';

      await sendWhatsAppImage({
        waBase: wa.apiBase,
        phone: selectedStudent.phone,
        imageBase64,
        caption: personalCaption,
      });
      setSingleStatus({ type: 'success', message: `تم الإرسال إلى ${selectedStudent.name}` });
    } catch (err) {
      setSingleStatus({ type: 'error', message: err.message || 'فشل الإرسال' });
    } finally {
      setSingleSending(false);
    }
  };

  const handleSendBulk = async () => {
    if (!targets.length) {
      alert('لا يوجد طلاب لديهم أرقام جوال ضمن الفلتر المحدد.');
      return;
    }
    if (!imageFile) {
      alert('اختر صورة للإرسال أولاً.');
      return;
    }
    if (!wa.status.connected) {
      alert('واتساب غير متصل. تأكد من تشغيل خادم واتساب وربط الجلسة.');
      return;
    }
    if (!window.confirm(bulkSendConfirmMessage(targets.length, bulkConfig))) return;

    setBulkSending(true);
    setSendReport(null);
    setBulkProgress({ current: 0, total: targets.length, phase: 'sending', secondsLeft: 0, label: '' });

    const report = { sent: 0, failed: 0, items: [] };

    try {
      const imageBase64 = await prepareImageForWhatsApp(imageFile);

      for (let i = 0; i < targets.length; i++) {
        const student = targets[i];
        setBulkProgress({
          current: i + 1,
          total: targets.length,
          phase: 'sending',
          secondsLeft: 0,
          label: student.name,
        });

        try {
          const personalCaption = caption.trim()
            ? buildPersonalCaption(caption.trim(), student)
            : '';

          await sendWhatsAppImage({
            waBase: wa.apiBase,
            phone: student.phone,
            imageBase64,
            caption: personalCaption,
          });
          report.sent += 1;
          report.items.push({ name: student.name, status: 'sent' });
        } catch (err) {
          report.failed += 1;
          report.items.push({ name: student.name, status: 'error', reason: err.message });
        }

        await waitBulkSendGap(i, targets.length, setBulkProgress, bulkConfig);
      }

      setSendReport(report);
    } catch (err) {
      alert(err.message || 'تعذّر تجهيز الصورة للإرسال.');
    } finally {
      setBulkProgress(null);
      setBulkSending(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-5 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800">إرسال واتساب</h2>
            <p className="text-slate-500 text-sm font-medium mt-1">
              {sendMode === 'single'
                ? 'ابحث عن طالب وأرسل له صورة عبر واتساب'
                : 'اختر المرحلة والصف، ثم أرسل صورة لجميع الطلاب الذين لديهم جوال'}
            </p>
          </div>
          <div>
            <WhatsAppConnectionBadge wa={wa} />
          </div>
        </div>

        {!wa.status.connected && wa.apiBase && (wa.status.status === 'qr' || wa.status.status === 'disconnected') && (
          <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-100 text-xs font-bold text-amber-900 leading-relaxed">
            يجب ربط واتساب على <span className="font-black">نفس الخادم</span> الذي يستخدمه هذا التطبيق.
            افتح الرابط التالي وامسح QR من هاتفك:
            <a
              href={`${wa.apiBase}/qr`}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 text-emerald-700 font-black underline break-all"
            >
              {wa.apiBase}/qr
            </a>
          </div>
        )}

        {!wa.status.connected && wa.status.status === 'server_down' && (
          <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-100 text-xs font-bold text-rose-800 leading-relaxed">
            تعذّر الاتصال بخادم واتساب
            {wa.apiBase ? ` (${wa.apiBase})` : ''}.
            {wa.fetchError ? ` السبب: ${wa.fetchError}.` : ''}
            {' '}تأكد من تشغيل الخادم أو ضبط <code className="font-black">VITE_WHATSAPP_API_BASE</code> في ملف .env
          </div>
        )}

        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 mb-5">
          <button
            type="button"
            onClick={() => {
              setSendMode('single');
              setSendReport(null);
            }}
            disabled={isSending}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 ${
              sendMode === 'single'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <User size={14} />
            طالب واحد
          </button>
          <button
            type="button"
            onClick={() => {
              setSendMode('bulk');
              setSingleStatus(null);
            }}
            disabled={isSending}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 ${
              sendMode === 'bulk'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Smartphone size={14} />
            إرسال جماعي
          </button>
        </div>

        {sendMode === 'single' ? (
          <div className="mb-5">
            <label className="block text-xs font-black text-slate-500 mb-1.5">ابحث عن الطالب</label>
            <div className="relative">
              <Search
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                size={18}
              />
              <input
                type="search"
                value={studentQuery}
                onChange={(e) => {
                  setStudentQuery(e.target.value);
                  setSelectedStudent(null);
                  setSingleStatus(null);
                }}
                disabled={isSending}
                placeholder="مثال: محمد أو محمد أحمد"
                className="w-full px-4 py-3 pr-11 rounded-xl bg-slate-50 border-2 border-slate-200 text-sm font-bold outline-none focus:border-emerald-500"
                autoComplete="off"
              />
            </div>

            {studentQuery.trim() && !selectedStudent && studentMatches.length > 0 && (
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm">
                {studentMatches.map((student) => (
                  <li key={student.id || `${student.name}-${student.phone}`}>
                    <button
                      type="button"
                      onClick={() => selectStudent(student)}
                      disabled={isSending}
                      className="w-full text-right px-4 py-3 hover:bg-emerald-50 transition-colors"
                    >
                      <span className="block font-black text-slate-800 text-sm">{student.name}</span>
                      <span className="block text-xs font-bold text-slate-400 mt-0.5">
                        {[student.stage, student.grade].filter(Boolean).join(' — ') || '—'}
                        {student.phone ? ` · ${student.phone}` : ' · بدون جوال'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {studentQuery.trim() && !selectedStudent && studentMatches.length === 0 && (
              <p className="mt-2 text-xs font-bold text-rose-600">لم يتم العثور على طالب بهذا الاسم.</p>
            )}

            {selectedStudent && (
              <div className="mt-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black text-emerald-900">{selectedStudent.name}</p>
                  <p className="text-xs font-bold text-emerald-700 mt-1">
                    {[selectedStudent.stage, selectedStudent.grade].filter(Boolean).join(' — ')}
                    {selectedStudent.phone ? ` · ${selectedStudent.phone}` : ''}
                  </p>
                  {!selectedStudent.phone && (
                    <p className="text-xs font-bold text-rose-600 mt-1">لا يوجد رقم جوال مسجّل</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={clearSelectedStudent}
                  disabled={isSending}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-white/80 shrink-0"
                  title="إلغاء الاختيار"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        ) : (
        <>
        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          <div>
            <label className="block text-xs font-black text-slate-500 mb-1.5">المرحلة</label>
            <select
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setGradeFilter('all');
              }}
              disabled={isSending}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-200 text-sm font-black text-slate-700 outline-none focus:border-emerald-500"
            >
              <option value="all">كل المراحل</option>
              {COMMITTEE_STAGES.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 mb-1.5">الصف</label>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              disabled={isSending}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-200 text-sm font-black text-slate-700 outline-none focus:border-emerald-500"
            >
              <option value="all">كل الصفوف</option>
              {filteredGrades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-5 text-xs font-black">
          <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            <Smartphone size={12} className="inline ml-1" />
            جاهز للإرسال: {targets.length}
          </span>
          {withoutPhone.length > 0 && (
            <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">
              بدون جوال: {withoutPhone.length}
            </span>
          )}
          {targets.length > 1 && (
            <span className="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700">
              <Clock size={12} className="inline ml-1" />
              {formatBulkDurationHint(targets.length, bulkConfig)}
            </span>
          )}
        </div>
        </>
        )}

        <div className="mb-5">
          <label className="block text-xs font-black text-slate-500 mb-1.5">الصورة</label>
          {!imagePreview ? (
            <label className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors">
              <ImageUp size={28} className="text-slate-400" />
              <span className="text-sm font-black text-slate-600">اضغط لاختيار صورة</span>
              <span className="text-xs font-bold text-slate-400">JPG أو PNG</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} disabled={isSending} />
            </label>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
              <img src={imagePreview} alt="معاينة" className="w-full max-h-64 object-contain" />
              <button
                type="button"
                onClick={clearImage}
                disabled={isSending}
                className="absolute top-2 left-2 p-2 rounded-lg bg-white/90 text-slate-600 hover:text-rose-600 shadow"
                title="إزالة الصورة"
              >
                <X size={18} />
              </button>
            </div>
          )}
        </div>

        <div className="mb-5">
          <label className="block text-xs font-black text-slate-500 mb-1.5">نص مرفق</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={isSending}
            rows={12}
            dir="rtl"
            className="w-full resize-y min-h-[220px] px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-200 text-sm font-bold leading-relaxed text-slate-800 outline-none focus:border-emerald-500 whitespace-pre-wrap"
          />
          <p className="text-[11px] font-bold text-slate-400 mt-1">
            يمكنك التعديل قبل الإرسال. للتخصيص: {'{name}'} {'{grade}'} {'{committee}'} {'{seatNumber}'}
          </p>
        </div>

        {sendMode === 'bulk' && (
        <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 p-4 mb-5">
          <p className="text-xs font-black text-indigo-900 mb-3 flex items-center gap-1.5">
            <Clock size={14} />
            إعدادات التأخير (لتقليل خطر الحظر)
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1">بين كل رسالة (ثانية)</label>
              <input
                type="number"
                min={3}
                max={120}
                value={bulkConfig.messageDelaySec}
                onChange={(e) =>
                  updateBulkConfig('messageDelaySec', clampInt(e.target.value, 3, 120, 10))
                }
                disabled={isSending}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-black"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1">توقف كل (رسالة)</label>
              <input
                type="number"
                min={10}
                max={200}
                value={bulkConfig.batchSize}
                onChange={(e) =>
                  updateBulkConfig('batchSize', clampInt(e.target.value, 10, 200, 50))
                }
                disabled={isSending}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-black"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1">مدة التوقف (ثانية)</label>
              <input
                type="number"
                min={15}
                max={600}
                value={bulkConfig.batchPauseSec}
                onChange={(e) =>
                  updateBulkConfig('batchPauseSec', clampInt(e.target.value, 15, 600, 60))
                }
                disabled={isSending}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-black"
              />
            </div>
          </div>
        </div>
        )}

        {sendMode === 'bulk' && bulkSending && bulkProgress && (
          <div className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
            <Loader2 size={20} className="animate-spin text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-amber-900 text-sm">{getBulkProgressMessage(bulkProgress, bulkConfig)}</p>
              <p className="text-xs font-bold text-amber-700 mt-1">لا تغلق الصفحة أثناء الإرسال</p>
            </div>
          </div>
        )}

        {sendMode === 'bulk' && sendReport && (
          <div
            className={`mb-5 p-4 rounded-xl border ${
              sendReport.failed ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'
            }`}
          >
            <p className="font-black text-sm">
              تم: {sendReport.sent} — فشل: {sendReport.failed}
            </p>
            {sendReport.failed > 0 && (
              <ul className="mt-2 text-xs font-bold text-rose-700 space-y-0.5 max-h-32 overflow-y-auto">
                {sendReport.items
                  .filter((i) => i.status === 'error')
                  .slice(0, 10)
                  .map((i, idx) => (
                    <li key={idx}>
                      {i.name}: {i.reason}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        {sendMode === 'single' && singleStatus && (
          <div
            className={`mb-5 p-4 rounded-xl border ${
              singleStatus.type === 'error'
                ? 'bg-rose-50 border-rose-100 text-rose-700'
                : 'bg-emerald-50 border-emerald-100 text-emerald-700'
            }`}
          >
            <p className="font-black text-sm">{singleStatus.message}</p>
          </div>
        )}

        {sendMode === 'single' ? (
          <button
            type="button"
            onClick={handleSendSingle}
            disabled={singleSending || !selectedStudent || !selectedStudent.phone || !imageFile || !wa.status.connected}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-black text-base shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99]"
          >
            {singleSending ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                جاري الإرسال...
              </>
            ) : (
              <>
                <Send size={20} />
                {selectedStudent ? `إرسال إلى ${selectedStudent.name}` : 'اختر طالباً للإرسال'}
              </>
            )}
          </button>
        ) : (
        <button
          type="button"
          onClick={handleSendBulk}
          disabled={bulkSending || !targets.length || !imageFile || !wa.status.connected}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-black text-base shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99]"
        >
          {bulkSending ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              جاري الإرسال...
            </>
          ) : (
            <>
              <Send size={20} />
              إرسال الصورة إلى {targets.length} طالب
            </>
          )}
        </button>
        )}

        {!wa.apiBase && (
          <p className="mt-4 text-xs font-bold text-rose-600 flex items-start gap-1.5">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            أضف VITE_WHATSAPP_API_BASE في ملف .env (مثال: http://localhost:3001)
          </p>
        )}
      </div>
    </div>
  );
}
