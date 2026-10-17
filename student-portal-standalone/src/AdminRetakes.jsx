import { getRetakeRange, isDateKey } from './retakeSchedule';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  RotateCcw, RefreshCw, Trash2, Search, Calendar, BookOpen,
  User, Hash, School, X, AlertCircle, FileDown, CheckCircle2,
  Clock, Edit3, Settings, ShieldCheck, Printer, Check,
  AlertTriangle, Users, Sparkles, Filter, ChevronDown, CheckSquare,
  Square, ArrowUpDown
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import schoolLogo from './assets/school_logo.jpeg';
import DirectExamPrint from './DirectExamPrint.jsx';
import { exportRetakeExams, prepareRetakeBatches, sameRetakeStudent } from './retakeExamExport';
import {
  getAllRetakeRequests,
  deleteRetakeRequest,
  getAppSettings,
  updateRetakeSchedule,
  updateRetakeRequest,
  batchUpdateRetakeScheduledDate,
  getNextMonday,
  getOmrExams,
  getStudents,
} from './dataService';

const PASS_KEY = 'mo_admin_passed';

/** تنسيق التاريخ والوقت بالعربية */
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const dateStr = d.toLocaleDateString('ar-EG', {
    timeZone: 'Asia/Riyadh',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  // إذا وجد وقت محدد
  const hasSpecificTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  if (hasSpecificTime) {
    const timeStr = d.toLocaleTimeString('ar-EG', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' });
    return `${dateStr} (${timeStr})`;
  }
  return dateStr;
};

const toDateOnly = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

export default function AdminRetakes() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(PASS_KEY) === '1');
  const [pwd, setPwd] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  const [config, setConfig] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /* ── إدارة موعد إعادة الاختبار (Schedule Management) ── */
  const [schedDate, setSchedDate] = useState('');
  const [schedEndDate, setSchedEndDate] = useState('');
  const [schedTime, setSchedTime] = useState('08:00');
  const [schedNotes, setSchedNotes] = useState('');
  const [schedIsOpen, setSchedIsOpen] = useState(true);
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedSuccessMsg, setSchedSuccessMsg] = useState('');

  /* ── فلاتر وبحث ── */
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterExam, setFilterExam] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  /* ── تحديد متعدد للطلبات ── */
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  /* ── تعديل موعد طالب فردي (Modal) ── */
  const [editItem, setEditItem] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('08:00');
  const [editStatus, setEditStatus] = useState('pending');
  const [editSaving, setEditSaving] = useState(false);

  /* ── تصدير PDF وطباعة ── */
  const [pdfExporting, setPdfExporting] = useState(false);
  const [examExporting, setExamExporting] = useState(false);
  const [examExportProgress, setExamExportProgress] = useState('');
  const [examExportMessage, setExamExportMessage] = useState('');
  const pdfRef = useRef(null);

  useEffect(() => {
    getAppSettings().then((cfg) => {
      setConfig(cfg);
      const s = cfg?.retakeSchedule;
      if (s) {
        const range = getRetakeRange(s);
        setSchedDate(range.startDate);
        setSchedEndDate(range.endDate);
        if (s.time) setSchedTime(s.time);
        if (s.notes != null) setSchedNotes(s.notes);
        if (s.isOpen != null) setSchedIsOpen(s.isOpen);
      } else {
        // افتراضي الاثنين القادم
        const day = getNextMonday().toISOString().slice(0, 10);
        setSchedDate(day);
        setSchedEndDate(day);
        setSchedTime('08:00');
        setSchedNotes('يرجى الحضور بالزي المدرسي قبل بدء الاختبار بـ 15 دقيقة مصطحبين الأدوات اللازمة.');
      }
    });
  }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAllRetakeRequests();
      setItems(data);
      setSelectedIds(new Set());
    } catch {
      setError('تعذر تحميل طلبات إعادة الاختبار.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authed) load();
  }, [authed]);

  const handleLogin = (e) => {
    e.preventDefault();
    const adminPass = config?.moAdminPassword || 'mo2025';
    if (pwd === adminPass) {
      sessionStorage.setItem(PASS_KEY, '1');
      setAuthed(true);
      setPwdErr('');
    } else {
      setPwdErr('كلمة المرور غير صحيحة.');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(PASS_KEY);
    setAuthed(false);
  };

  /* ── حفظ موعد إعادة الاختبار في إعدادات النظام ── */
  const handleSaveSchedule = async (e) => {
    if (e) e.preventDefault();
    if (!isDateKey(schedDate) || !isDateKey(schedEndDate) || schedEndDate < schedDate) {
      alert('يرجى تحديد فترة صحيحة: تاريخ النهاية لا يسبق تاريخ البداية.');
      return;
    }
    setSchedSaving(true);
    setSchedSuccessMsg('');
    try {
      const updated = await updateRetakeSchedule({
        date: schedDate,
        startDate: schedDate,
        endDate: schedEndDate,
        time: schedTime || '08:00',
        notes: schedNotes.trim(),
        isOpen: Boolean(schedIsOpen),
      });
      setConfig((prev) => ({
        ...(prev || {}),
        retakeSchedule: updated,
      }));
      setSchedSuccessMsg('تم حفظ واعتماد موعد إعادة الاختبار بنجاح!');
      setTimeout(() => setSchedSuccessMsg(''), 4000);
    } catch {
      alert('تعذر حفظ الموعد في الخادم. تحقق من الاتصال.');
    } finally {
      setSchedSaving(false);
    }
  };

  /* ── تطبيق الموعد المعتمد على جميع الطلبات الحالية ── */
  const handleApplyScheduleToAll = async () => {
    if (!schedDate || schedDate !== schedEndDate) {
      alert('خلال فترة متعددة الأيام يختار كل طالب يومه؛ يمكن تعديل موعد طالب من كشف الطلبات.');
      return;
    }
    if (!schedDate) {
      alert('يرجى تحديد موعد الاختبار أولاً ثم الضغط على حفظ.');
      return;
    }
    if (items.length === 0) {
      alert('لا توجد طلبات لتحديث موعدها حالياً.');
      return;
    }
    const combinedDate = `${schedDate}T${schedTime || '08:00'}:00`;
    const friendlyDate = new Date(combinedDate).toLocaleDateString('ar-EG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    if (!window.confirm(`هل أنت متأكد من تحديث موعد جميع الطلبات (${items.length} طلب) إلى: ${friendlyDate} الساعة ${schedTime}؟`)) {
      return;
    }

    setBatchActionLoading(true);
    try {
      const allIds = items.map((x) => x.id);
      await batchUpdateRetakeScheduledDate(allIds, combinedDate);
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          scheduledDate: combinedDate,
        }))
      );
      setSchedSuccessMsg(`تم تحديث موعد ${items.length} طالب بنجاح!`);
      setTimeout(() => setSchedSuccessMsg(''), 4000);
    } catch {
      alert('حدث خطأ أثناء تحديث مواعيد الطلبات.');
    } finally {
      setBatchActionLoading(false);
    }
  };

  /* ── تطبيق الموعد على الطلبات المحددة فقط ── */
  const handleApplyScheduleToSelected = async () => {
    if (!schedDate || schedDate !== schedEndDate) {
      alert('خلال فترة متعددة الأيام يختار كل طالب يومه؛ يمكن تعديل موعد طالب من كشف الطلبات.');
      return;
    }
    if (selectedIds.size === 0) return;
    const combinedDate = `${schedDate}T${schedTime || '08:00'}:00`;
    if (!window.confirm(`هل تريد تحديث موعد الطلاب المحددين (${selectedIds.size} طالب) إلى الموعد المعتمد؟`)) {
      return;
    }
    setBatchActionLoading(true);
    try {
      const ids = Array.from(selectedIds);
      await batchUpdateRetakeScheduledDate(ids, combinedDate);
      setItems((prev) =>
        prev.map((it) => (selectedIds.has(it.id) ? { ...it, scheduledDate: combinedDate } : it))
      );
      setSelectedIds(new Set());
      setSchedSuccessMsg(`تم تحديث موعد ${ids.length} طالب بنجاح!`);
      setTimeout(() => setSchedSuccessMsg(''), 4000);
    } catch {
      alert('تعذر تحديث المواعيد.');
    } finally {
      setBatchActionLoading(false);
    }
  };

  /* ── حذف طلب فردي ── */
  const handleDelete = async (id, studentName) => {
    if (!window.confirm(`هل تريد حذف طلب الطالب (${studentName || 'هذا الطالب'}) نهائياً؟`)) return;
    try {
      await deleteRetakeRequest(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch {
      alert('تعذر الحذف.');
    }
  };

  /* ── حذف جماعي للطلبات المحددة ── */
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedIds.size} طلب نهائياً؟ لا يمكن التراجع.`)) return;
    setBatchActionLoading(true);
    try {
      for (const id of selectedIds) {
        await deleteRetakeRequest(id);
      }
      setItems((prev) => prev.filter((x) => !selectedIds.has(x.id)));
      setSelectedIds(new Set());
    } catch {
      alert('حدث خطأ أثناء حذف بعض الطلبات.');
    } finally {
      setBatchActionLoading(false);
    }
  };

  /* ── تبديل حالة الطلب السريع (مؤكد / قيد الانتظار) ── */
  const handleToggleStatus = async (item) => {
    const nextStatus = item.status === 'confirmed' ? 'pending' : 'confirmed';
    try {
      await updateRetakeRequest(item.id, { status: nextStatus });
      setItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, status: nextStatus } : x))
      );
    } catch {
      alert('تعذر تحديث حالة الطلب.');
    }
  };

  /* ── فتح نافذة تعديل موعد طالب معين ── */
  const openEditModal = (item) => {
    setEditItem(item);
    const d = item.scheduledDate ? new Date(item.scheduledDate) : null;
    if (d && !isNaN(d.getTime())) {
      setEditDate(d.toISOString().slice(0, 10));
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      setEditTime(`${hours}:${mins}`);
    } else {
      setEditDate(schedDate || '');
      setEditTime(schedTime || '08:00');
    }
    setEditStatus(item.status || 'pending');
  };

  const handleSaveEditModal = async () => {
    if (!editItem || !editDate) return;
    setEditSaving(true);
    try {
      const combined = `${editDate}T${editTime || '08:00'}:00`;
      await updateRetakeRequest(editItem.id, {
        scheduledDate: combined,
        status: editStatus,
      });
      setItems((prev) =>
        prev.map((x) =>
          x.id === editItem.id ? { ...x, scheduledDate: combined, status: editStatus } : x
        )
      );
      setEditItem(null);
    } catch {
      alert('تعذر حفظ التعديل.');
    } finally {
      setEditSaving(false);
    }
  };

  /* ── خيارات الفلاتر ── */
  const availableGrades = useMemo(() => {
    const set = new Set();
    items.forEach((it) => { if (it.studentGrade) set.add(it.studentGrade); });
    return [...set].sort((a, b) => a.localeCompare(b, 'ar'));
  }, [items]);

  const availableExams = useMemo(() => {
    const set = new Set();
    items.forEach((it) => { if (it.examTitle) set.add(it.examTitle); });
    return [...set].sort((a, b) => a.localeCompare(b, 'ar'));
  }, [items]);

  const availableDates = useMemo(() => {
    const set = new Set();
    items.forEach((it) => {
      const d = toDateOnly(it.scheduledDate);
      if (d) set.add(d);
    });
    return [...set].sort().reverse();
  }, [items]);

  /* ── البيانات المفلترة ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (filterGrade && (it.studentGrade || '') !== filterGrade) return false;
      if (filterExam && (it.examTitle || '') !== filterExam) return false;
      if (filterDate && toDateOnly(it.scheduledDate) !== filterDate) return false;
      if (filterStatus && (it.status || 'pending') !== filterStatus) return false;
      if (q) {
        const blob = [
          it.studentName,
          it.studentId,
          it.nationalId,
          it.seatNumber,
          it.studentGrade,
          it.examTitle,
        ]
          .map((v) => String(v || '').toLowerCase())
          .join(' ');
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, filterDate, filterExam, filterGrade, filterStatus]);

  /* ── إحصائيات سريعة ── */
  const uniqueStudentsCount = useMemo(() => {
    const set = new Set();
    filtered.forEach((x) => {
      const k = x.nationalId || x.studentId || x.seatNumber || x.studentName;
      if (k) set.add(k);
    });
    return set.size;
  }, [filtered]);

  const confirmedCount = useMemo(() => {
    return filtered.filter((x) => x.status === 'confirmed').length;
  }, [filtered]);

  const pendingCount = useMemo(() => {
    return filtered.filter((x) => (x.status || 'pending') === 'pending').length;
  }, [filtered]);

  /* ── تحديد الكل ── */
  const allFilteredSelected = filtered.length > 0 && filtered.every((x) => selectedIds.has(x.id));
  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((x) => x.id)));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportRetakeExams = async (studentRequest = null) => {
    if (examExporting) return;
    const requests = (studentRequest ? items.filter((item) => sameRetakeStudent(item, studentRequest)) : filtered)
      .filter((item) => item.status === 'confirmed');
    setExamExporting(true);
    setExamExportMessage('');
    setExamExportProgress('');
    try {
      const [exams, students, settings] = await Promise.all([getOmrExams(), getStudents(), getAppSettings()]);
      const batches = prepareRetakeBatches(requests, exams, students, settings);
      await exportRetakeExams(batches, setExamExportProgress);
      setExamExportMessage(`تم تصدير ${batches.reduce((count, batch) => count + batch.body.students.length, 0)} ورقة اختبار في ${batches.length} ملف PDF داخل ZIP.`);
    } catch (err) {
      setExamExportMessage(err.message || 'تعذر تصدير اختبارات الإعادة.');
    } finally {
      setExamExporting(false);
      setExamExportProgress('');
    }
  };

  /* ── تصدير PDF لكشف الأسماء ── */
  const handleExportPdf = async () => {
    if (!pdfRef.current || filtered.length === 0) return;
    setPdfExporting(true);
    try {
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pageW, imgH);
      heightLeft -= pageH;

      while (heightLeft > 0) {
        position = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pageW, imgH);
        heightLeft -= pageH;
      }

      const parts = ['كشف_الراغبين_في_إعادة_الاختبار'];
      if (filterGrade) parts.push(filterGrade.replace(/\s+/g, '_'));
      if (filterExam) parts.push(filterExam.replace(/\s+/g, '_').slice(0, 30));
      pdf.save(`${parts.join('_')}.pdf`);
    } catch {
      alert('تعذر إنشاء ملف PDF. حاول مرة أخرى.');
    } finally {
      setPdfExporting(false);
    }
  };

  const schoolName = config?.schoolName || 'متوسطة وثانوية نخبة الشمال الأهلية';
  const managerName = config?.managerName || 'مدير المدرسة';

  /* ── شاشة تسجيل الدخول ── */
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans" dir="rtl">
        <form onSubmit={handleLogin} className="luxury-card w-full max-w-md p-8 space-y-5 bg-white border border-slate-200 shadow-2xl">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto bg-indigo-950 rounded-3xl flex items-center justify-center mb-3 shadow-xl text-white">
              <RotateCcw className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-800">بوابة الإدارة والكنترول</h1>
            <p className="text-xs font-bold text-slate-500 mt-1">تحديد مواعيد وإدارة طلبات إعادة الاختبار</p>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">كلمة المرور الإدارية</label>
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-base font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all text-center tracking-widest"
              autoFocus
            />
          </div>
          {pwdErr && (
            <div className="flex items-center gap-2 text-rose-600 bg-rose-50 px-4 py-2.5 rounded-xl font-bold text-sm border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" /> {pwdErr}
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-indigo-950 text-white py-3.5 rounded-2xl font-black hover:bg-indigo-900 transition-all active:scale-[0.98] shadow-lg shadow-indigo-950/20 text-base"
          >
            دخول لوحة التحكم
          </button>
        </form>
      </div>
    );
  }

  /* ── التاريخ العربي المعروض للموعد المعتمد ── */
  const schedFriendlyPreview = schedDate
    ? (() => {
        try {
          const d = new Date(`${schedDate}T${schedTime || '08:00'}:00`);
          return d.toLocaleDateString('ar-EG', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });
        } catch {
          return schedDate;
        }
      })()
    : 'لم يتم تحديد موعد بعد';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-indigo-950 font-sans pb-16" dir="rtl">
      {/* ── شريط الرأس الرئيسي (Top Navbar) ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-md border border-slate-100 flex items-center justify-center overflow-hidden p-1 shrink-0">
              <img
                src={schoolLogo}
                alt="logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-right">
              <h1 className="text-base sm:text-xl font-black text-slate-900 leading-tight flex items-center gap-2">
                إدارة إعادة الاختبار وتحديد المواعيد
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  الكنترول
                </span>
              </h1>
              <p className="text-[11px] font-bold text-slate-500">{schoolName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleExportRetakeExams()}
              disabled={loading || examExporting || confirmedCount === 0}
              className="flex items-center gap-1.5 bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm"
              title="تصدير أوراق اختبارات الطلبات المؤكدة حسب الفلاتر الحالية"
            >
              <FileDown className={`w-4 h-4 ${examExporting ? 'animate-pulse' : ''}`} />
              {examExporting ? `جاري تجهيز الاختبارات ${examExportProgress}` : `تصدير اختبارات المؤكدين (${confirmedCount})`}
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={pdfExporting || filtered.length === 0}
              className="flex items-center gap-1.5 bg-indigo-950 text-white hover:bg-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all"
            >
              <FileDown className={`w-4 h-4 ${pdfExporting ? 'animate-pulse' : ''}`} />
              {pdfExporting ? 'جاري إنشاء PDF...' : 'تصدير كشف PDF'}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50 px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all"
            >
              <Printer className="w-4 h-4" /> طباعة
            </button>

            <button
              onClick={load}
              className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> تحديث
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 px-3 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all"
            >
              خروج
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        <DirectExamPrint />
        {examExportMessage && <p role="status" className="bg-white border border-indigo-200 rounded-xl p-4 text-sm font-bold text-indigo-950">{examExportMessage}</p>}
        {/* ── قسم تحديد موعد إعادة الاختبار (Schedule Management Card) ── */}
        <section className="bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 rounded-3xl text-white shadow-xl p-5 sm:p-7 relative overflow-hidden border border-indigo-800/40">
          <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 text-indigo-300 shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                    تحديد فترة إعادة الاختبار المعتمدة
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </h2>
                  <p className="text-xs font-bold text-indigo-200 mt-0.5">
                    حدد الفترة من وإلى ووقت الاختبار؛ يختار الطالب يومًا داخل الفترة عند تقديم طلبه
                  </p>
                </div>
              </div>

              {/* شارة الموعد الحالي المفعل */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-2 text-right">
                <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">الفترة المختارة</div>
                <div className="text-sm font-black text-white mt-0.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>من {schedFriendlyPreview} إلى {schedEndDate ? fmtDate(`${schedEndDate}T00:00:00`) : "—"}</span>
                  {schedTime && <span className="text-indigo-200 font-mono text-xs">({schedTime})</span>}
                </div>
              </div>
            </div>

            {/* نموذج تحديد الموعد */}
            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* تاريخ الاختبار */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-indigo-200 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-300" /> تاريخ البداية (من) *
                  </label>
                  <input
                    type="date"
                    value={schedDate}
                    aria-label="تاريخ بداية فترة الإعادة"
                    max={schedEndDate || undefined}
                    onChange={(e) => setSchedDate(e.target.value)}
                    required
                    className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 font-bold text-sm text-white focus:bg-white focus:text-slate-900 focus:border-white outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="retake-end" className="text-xs font-black text-indigo-200 block">تاريخ النهاية (إلى) *</label>
                  <input id="retake-end" type="date" value={schedEndDate} min={schedDate || undefined}
                    onChange={(e) => setSchedEndDate(e.target.value)} required
                    className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 font-bold text-sm text-white focus:bg-white focus:text-slate-900 outline-none" />
                </div>

                {/* وقت الاختبار */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-indigo-200 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-300" /> وقت الاختبار
                  </label>
                  <input
                    type="time"
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 font-bold text-sm text-white focus:bg-white focus:text-slate-900 focus:border-white outline-none transition-all font-mono"
                  />
                </div>

                {/* حالة استقبال الطلبات */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-indigo-200 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> استقبال الطلبات من الطلاب
                  </label>
                  <button
                    type="button"
                    onClick={() => setSchedIsOpen(!schedIsOpen)}
                    className={`w-full py-3 px-4 rounded-2xl font-black text-sm flex items-center justify-between transition-all border ${
                      schedIsOpen
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                    }`}
                  >
                    <span>{schedIsOpen ? 'مفتوح (متاح في البوابة)' : 'مغلق (معطّل مؤقتاً)'}</span>
                    <span className={`w-3 h-3 rounded-full ${schedIsOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                  </button>
                </div>

                {/* أزرار الحفظ والإجراءات */}
                <div className="flex flex-col justify-end gap-2">
                  <button
                    type="submit"
                    disabled={schedSaving}
                    className="w-full bg-indigo-500 hover:bg-indigo-400 text-white py-3 px-4 rounded-2xl font-black text-sm transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    {schedSaving ? 'جاري الحفظ...' : 'حفظ واعتماد الموعد'}
                  </button>
                </div>
              </div>

              {/* ملاحظات وتعليمات الإعادة للطلاب */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
                <div className="lg:col-span-3 space-y-1.5">
                  <label className="text-xs font-black text-indigo-200 flex items-center gap-1">
                    <Edit3 className="w-3.5 h-3.5 text-indigo-300" /> ملاحظات وتعليمات الإدارة (تظهر للطالب في البوابة)
                  </label>
                  <input
                    type="text"
                    value={schedNotes}
                    onChange={(e) => setSchedNotes(e.target.value)}
                    placeholder="مثال: يرجى التواجد بالزي المدرسي مصطحبين بطاقة الهوية وقلم التظليل OMR قبل الاختبار بـ 15 دقيقة."
                    className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 font-bold text-xs sm:text-sm text-white focus:bg-white focus:text-slate-900 outline-none transition-all placeholder:text-white/40"
                  />
                </div>

                {/* زر تعميم الموعد على كافة الطلبات الحالية */}
                <div>
                  <button
                    type="button"
                    onClick={handleApplyScheduleToAll}
                    disabled={batchActionLoading || items.length === 0 || schedDate !== schedEndDate}
                    title="تحديث موعد جميع الطلاب المسجلين حالياً إلى هذا الموعد المعتمد"
                    className="w-full bg-white/15 hover:bg-white/25 border border-white/30 text-white py-2.5 px-3 rounded-2xl font-black text-xs transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${batchActionLoading ? 'animate-spin' : ''}`} />
                    تطبيق على جميع الطلبات ({items.length})
                  </button>
                </div>
              </div>
            </form>

            {/* رسالة نجاح الحفظ */}
            {schedSuccessMsg && (
              <div className="bg-emerald-500/20 border border-emerald-400 text-emerald-200 px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 animate-in fade-in duration-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{schedSuccessMsg}</span>
              </div>
            )}
          </div>
        </section>

        {/* ── بطاقات الإحصائيات (KPI Cards) ── */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="الراغبون في الإعادة"
            value={items.length}
            sub={`${uniqueStudentsCount} طالب فريد`}
            color="indigo"
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            label="الطلبات الظاهرة"
            value={filtered.length}
            sub="حسب الفلاتر الحالية"
            color="emerald"
            icon={<Filter className="w-5 h-5" />}
          />
          <StatCard
            label="مؤكدة"
            value={confirmedCount}
            sub="تم اعتمادها"
            color="teal"
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
          <StatCard
            label="قيد الانتظار"
            value={pendingCount}
            sub="طلبات جديدة"
            color="amber"
            icon={<Clock className="w-5 h-5" />}
          />
          <StatCard
            label="الصفوف"
            value={availableGrades.length}
            sub="صفوف بها طلبات"
            color="slate"
            icon={<School className="w-5 h-5" />}
          />
          <StatCard
            label="المواد"
            value={availableExams.length}
            sub="مواد مطلوبة للإعادة"
            color="purple"
            icon={<BookOpen className="w-5 h-5" />}
          />
        </section>

        {/* ── شريط الفلاتر والبحث (Filters & Search) ── */}
        <section className="luxury-card p-4 sm:p-6 bg-white border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-700" />
              <h3 className="font-black text-slate-800 text-sm sm:text-base">تصفية وبحث أسماء الطلاب الراغبين في الإعادة</h3>
            </div>

            {/* مسح الفلاتر */}
            {(search || filterDate || filterExam || filterGrade || filterStatus) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setFilterDate('');
                  setFilterExam('');
                  setFilterGrade('');
                  setFilterStatus('');
                }}
                className="inline-flex items-center gap-1 text-xs font-black text-rose-600 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100"
              >
                <X className="w-3.5 h-3.5" /> مسح الفلاتر
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* حقل البحث الذكي */}
            <div className="space-y-1 lg:col-span-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Search className="w-3 h-3" /> بحث فوري
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="اسم الطالب، الهوية، الجلوس..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all text-right pr-9"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* فلتر الصف */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <School className="w-3 h-3" /> الصف الدراسي
              </label>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-xs sm:text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
              >
                <option value="">— كل الصفوف ({availableGrades.length}) —</option>
                {availableGrades.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* فلتر المادة */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> المادة / الاختبار
              </label>
              <select
                value={filterExam}
                onChange={(e) => setFilterExam(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-xs sm:text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
              >
                <option value="">— كل المواد ({availableExams.length}) —</option>
                {availableExams.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* فلتر موعد الإعادة */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar className="w-3 h-3" /> موعد الإعادة
              </label>
              <select
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-xs sm:text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
              >
                <option value="">— كل المواعيد —</option>
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    {new Date(d).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </option>
                ))}
              </select>
            </div>

            {/* فلتر حالة الطلب */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> حالة الطلب
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-xs sm:text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
              >
                <option value="">— جميع الحالات —</option>
                <option value="pending">قيد الانتظار ({pendingCount})</option>
                <option value="confirmed">مؤكد ({confirmedCount})</option>
              </select>
            </div>
          </div>

          {/* شريط الإجراءات الجماعية عند تحديد صفوف */}
          {selectedIds.size > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="bg-indigo-900 text-white font-black text-xs px-2.5 py-1 rounded-lg">
                  {selectedIds.size} محدد
                </span>
                <span className="text-xs font-bold text-slate-700">إجراءات سريعة على الطلاب المحددين:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleApplyScheduleToSelected}
                  disabled={batchActionLoading}
                  className="bg-indigo-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-indigo-800 transition-all"
                >
                  تعيين الموعد المعتمد للمحددين
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={batchActionLoading}
                  className="bg-rose-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-rose-700 transition-all"
                >
                  حذف المحددين
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── حالة الخطأ ── */}
        {error && (
          <div className="flex items-center gap-2 text-rose-600 bg-rose-50 px-4 py-3 rounded-2xl font-bold text-sm border border-rose-200">
            <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}

        {/* ── جدول كشف الطلاب الراغبين في الإعادة (The Main Student List) ── */}
        {loading ? (
          <div className="luxury-card p-20 text-center text-slate-400 font-bold bg-white">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
            جاري تحميل كشوفات الطلاب...
          </div>
        ) : filtered.length === 0 ? (
          <div className="luxury-card p-16 text-center bg-slate-50/70 border-2 border-dashed border-slate-200">
            <RotateCcw className="mx-auto text-slate-300 mb-4 w-14 h-14" />
            <h3 className="text-xl font-black text-slate-600">لا توجد طلبات إعادة مطابقة</h3>
            <p className="text-xs font-bold text-slate-400 mt-1">
              لم يقم أي طالب بطلب إعادة مطابق للفلاتر الحالية.
            </p>
          </div>
        ) : (
          <>
            {/* جدول الشاشات الكبيرة */}
            <div className="hidden lg:block luxury-card overflow-hidden bg-white border border-slate-200 shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-indigo-950 text-white select-none">
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAll}
                          className="rounded text-indigo-600 focus:ring-0 cursor-pointer w-4 h-4"
                        />
                      </th>
                      <th className="p-3 font-black">#</th>
                      <th className="p-3 font-black">اسم الطالب</th>
                      <th className="p-3 font-black">الصف الدراسي</th>
                      <th className="p-3 font-black">السجل المدني / الجلوس</th>
                      <th className="p-3 font-black">المادة المراد إعادتها</th>
                      <th className="p-3 font-black">النتيجة السابقة</th>
                      <th className="p-3 font-black">موعد الإعادة المحدد</th>
                      <th className="p-3 font-black">تاريخ الطلب</th>
                      <th className="p-3 font-black text-center">الحالة</th>
                      <th className="p-3 font-black text-center w-24">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((it, idx) => {
                      const isSelected = selectedIds.has(it.id);
                      const isConfirmed = it.status === 'confirmed';
                      return (
                        <tr
                          key={it.id}
                          className={`hover:bg-indigo-50/40 transition-colors ${
                            isSelected ? 'bg-indigo-50/70' : idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOne(it.id)}
                              className="rounded text-indigo-600 focus:ring-0 cursor-pointer w-4 h-4"
                            />
                          </td>
                          <td className="p-3 font-mono text-slate-400 font-bold">{idx + 1}</td>
                          <td className="p-3 font-black text-slate-900 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-black text-xs shrink-0">
                                <User className="w-4 h-4" />
                              </div>
                              <span className="font-bold">{it.studentName || '—'}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-lg text-[11px]">
                              {it.studentGrade || '—'}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-600 font-bold text-xs">
                            {it.nationalId || it.seatNumber || it.studentId || '—'}
                          </td>
                          <td className="p-3">
                            <span className="bg-indigo-50 text-indigo-900 border border-indigo-100 font-black px-2.5 py-1 rounded-lg text-xs inline-flex items-center gap-1">
                              <BookOpen className="w-3 h-3 text-indigo-600" />
                              {it.examTitle || '—'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="font-black text-slate-800">
                              {it.originalScore ?? '—'} / {it.originalTotal ?? '—'}
                            </span>
                            {typeof it.originalPercentage === 'number' && (
                              <span className={`text-[11px] font-bold mr-1.5 ${
                                it.originalPercentage < 60 ? 'text-rose-600 font-black' : 'text-slate-500'
                              }`}>
                                ({Math.round(it.originalPercentage)}%)
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 text-xs">
                              <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{fmtDate(it.scheduledDate)}</span>
                            </div>
                          </td>
                          <td className="p-3 text-slate-500 text-[11px] font-bold">
                            {fmtDate(it.requestedAt || it._rowCreatedAt)}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(it)}
                              title="انقر لتغيير الحالة"
                              className={`px-2.5 py-1 rounded-full text-[11px] font-black border transition-all inline-flex items-center gap-1 ${
                                isConfirmed
                                  ? 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
                                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isConfirmed ? 'bg-teal-500' : 'bg-amber-500'}`} />
                              {isConfirmed ? 'مؤكد' : 'قيد الانتظار'}
                            </button>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {it.status === 'confirmed' && (
  <button type="button" disabled={examExporting}
    onClick={() => handleExportRetakeExams(it)}
    title={'\u062a\u0635\u062f\u064a\u0631 \u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a \u0627\u0644\u0637\u0627\u0644\u0628 \u0627\u0644\u0645\u0624\u0643\u062f\u0629'}
    aria-label={'\u062a\u0635\u062f\u064a\u0631 \u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a \u0627\u0644\u0637\u0627\u0644\u0628 \u0627\u0644\u0645\u0624\u0643\u062f\u0629'}
    className="text-emerald-700 hover:bg-emerald-50 p-1.5 rounded-lg disabled:opacity-50">
    <FileDown className="w-4 h-4" />
  </button>
)}
<button
                                type="button"
                                onClick={() => openEditModal(it)}
                                title="تعديل موعد هذا الطالب"
                                className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-all"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(it.id, it.studentName)}
                                title="حذف الطلب"
                                className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* بطاقات الشاشات الصغيرة والمتوسطة (Mobile / Tablet Cards) */}
            <div className="lg:hidden space-y-3">
              <div className="flex items-center justify-between px-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs font-bold text-indigo-700 flex items-center gap-1.5"
                >
                  {allFilteredSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  تحديد الكل ({filtered.length})
                </button>
              </div>

              {filtered.map((it, idx) => {
                const isSelected = selectedIds.has(it.id);
                const isConfirmed = it.status === 'confirmed';
                return (
                  <div
                    key={it.id}
                    className={`luxury-card p-4 bg-white border transition-all ${
                      isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(it.id)}
                          className="rounded text-indigo-600 focus:ring-0 cursor-pointer w-4 h-4 shrink-0"
                        />
                        <div className="w-9 h-9 bg-indigo-100 text-indigo-800 rounded-xl flex items-center justify-center shrink-0 font-black text-xs">
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-black text-slate-900 text-sm truncate">{it.studentName || '—'}</div>
                          <div className="text-[11px] text-slate-500 font-bold">{it.studentGrade || '—'}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {it.status === 'confirmed' && (
  <button type="button" disabled={examExporting}
    onClick={() => handleExportRetakeExams(it)}
    title={'\u062a\u0635\u062f\u064a\u0631 \u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a \u0627\u0644\u0637\u0627\u0644\u0628 \u0627\u0644\u0645\u0624\u0643\u062f\u0629'}
    aria-label={'\u062a\u0635\u062f\u064a\u0631 \u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a \u0627\u0644\u0637\u0627\u0644\u0628 \u0627\u0644\u0645\u0624\u0643\u062f\u0629'}
    className="text-emerald-700 hover:bg-emerald-50 p-1.5 rounded-lg disabled:opacity-50">
    <FileDown className="w-4 h-4" />
  </button>
)}
<button
                          type="button"
                          onClick={() => openEditModal(it)}
                          className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(it.id, it.studentName)}
                          className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-bold">الهوية / الجلوس:</span>
                        <span className="font-mono font-bold text-slate-800">{it.nationalId || it.seatNumber || it.studentId || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-bold">المادة:</span>
                        <span className="font-black text-indigo-900">{it.examTitle || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-bold">النتيجة السابقة:</span>
                        <span className="font-bold text-slate-800">
                          {it.originalScore ?? '—'} / {it.originalTotal ?? '—'}
                          {typeof it.originalPercentage === 'number' && ` (${Math.round(it.originalPercentage)}%)`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                        <span className="text-emerald-700 font-black">موعد الإعادة:</span>
                        <span className="font-black text-emerald-800 bg-emerald-100/60 px-2 py-0.5 rounded-md text-[11px]">
                          {fmtDate(it.scheduledDate)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[10px] font-bold">تاريخ الطلب:</span>
                        <span className="text-slate-500 text-[10px]">{fmtDate(it.requestedAt || it._rowCreatedAt)}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(it)}
                        className={`text-xs font-black px-3 py-1 rounded-full border transition-all inline-flex items-center gap-1.5 ${
                          isConfirmed
                            ? 'bg-teal-50 text-teal-700 border-teal-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isConfirmed ? 'bg-teal-500' : 'bg-amber-500'}`} />
                        {isConfirmed ? 'الطلب مؤكد' : 'قيد الانتظار (اضغط للتأكيد)'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* ── نافذة تعديل موعد طالب معين (Reschedule Modal) ── */}
      {editItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">تعديل موعد الإعادة لطالب</h3>
                  <p className="text-xs font-bold text-slate-400">{editItem.studentName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl space-y-1 text-xs">
              <div className="text-slate-500 font-bold">المادة: <strong className="text-indigo-900">{editItem.examTitle}</strong></div>
              <div className="text-slate-500 font-bold">الصف: <strong className="text-slate-800">{editItem.studentGrade}</strong></div>
              <div className="text-slate-500 font-bold">الهوية: <strong className="text-slate-800 font-mono">{editItem.nationalId || editItem.seatNumber}</strong></div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700">تاريخ موعد الإعادة</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-sm outline-none focus:border-indigo-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700">وقت الاختبار</label>
                <input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-sm outline-none focus:border-indigo-600 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700">حالة الطلب</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-sm outline-none focus:border-indigo-600"
                >
                  <option value="pending">قيد الانتظار</option>
                  <option value="confirmed">مؤكد</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveEditModal}
                disabled={editSaving}
                className="flex-1 bg-indigo-950 text-white py-3 rounded-xl font-black text-sm hover:bg-indigo-900 transition-all disabled:opacity-50"
              >
                {editSaving ? 'جاري الحفظ...' : 'حفظ التعديل'}
              </button>
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="bg-slate-100 text-slate-600 py-3 px-4 rounded-xl font-bold text-sm hover:bg-slate-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── نموذج PDF المخفي للتصدير (High-resolution Printable Sheet) ── */}
      <div
        ref={pdfRef}
        dir="rtl"
        className="fixed left-[-10000px] top-0 w-[1100px] bg-white p-10 text-slate-900 font-sans"
        aria-hidden="true"
      >
        <div className="border-b-4 border-indigo-950 pb-5 mb-5 flex items-center justify-between">
          <div className="text-right">
            <h2 className="text-2xl font-black text-indigo-950">{schoolName}</h2>
            <h3 className="text-lg font-black text-slate-700 mt-1">كشف أسماء الطلاب المسجلين لإعادة الاختبار</h3>
            <p className="text-xs text-slate-500 font-bold mt-1">
              تاريخ استخراج الكشف: {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}إجمالي الطلاب في الكشف: {filtered.length} طالب
            </p>
            {schedFriendlyPreview && (
              <p className="text-xs text-indigo-800 font-black mt-1">
                الموعد المعتمد للإعادة: {schedFriendlyPreview} ({schedTime})
              </p>
            )}
          </div>
          <div className="w-20 h-20 bg-white border border-slate-200 rounded-2xl p-1 flex items-center justify-center">
            <img src={schoolLogo} alt="logo" className="w-full h-full object-contain" />
          </div>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-indigo-950 text-white">
              <th className="border border-indigo-900 p-2 text-center w-10">#</th>
              <th className="border border-indigo-900 p-2 text-right">اسم الطالب</th>
              <th className="border border-indigo-900 p-2 text-right">الصف الدراسي</th>
              <th className="border border-indigo-900 p-2 text-right">السجل المدني / الجلوس</th>
              <th className="border border-indigo-900 p-2 text-right">المادة</th>
              <th className="border border-indigo-900 p-2 text-center">الدرجة السابقة</th>
              <th className="border border-indigo-900 p-2 text-right">موعد الإعادة</th>
              <th className="border border-indigo-900 p-2 text-center">حالة الطلب</th>
              <th className="border border-indigo-900 p-2 text-center w-28">توقيع الطالب</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it, idx) => (
              <tr key={it.id} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                <td className="border border-slate-300 p-2 text-center font-bold">{idx + 1}</td>
                <td className="border border-slate-300 p-2 font-black text-slate-900">{it.studentName || '—'}</td>
                <td className="border border-slate-300 p-2">{it.studentGrade || '—'}</td>
                <td className="border border-slate-300 p-2 font-mono text-xs">{it.nationalId || it.seatNumber || it.studentId || '—'}</td>
                <td className="border border-slate-300 p-2 font-bold">{it.examTitle || '—'}</td>
                <td className="border border-slate-300 p-2 text-center">
                  {it.originalScore ?? '—'} / {it.originalTotal ?? '—'}
                  {typeof it.originalPercentage === 'number' && ` (${Math.round(it.originalPercentage)}%)`}
                </td>
                <td className="border border-slate-300 p-2 text-emerald-800 font-bold">{fmtDate(it.scheduledDate)}</td>
                <td className="border border-slate-300 p-2 text-center font-bold">
                  {it.status === 'confirmed' ? 'مؤكد' : 'قيد الانتظار'}
                </td>
                <td className="border border-slate-300 p-2"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* تذييل الاعتماد الرسمي */}
        <div className="mt-12 pt-6 border-t border-slate-300 grid grid-cols-3 text-center text-xs font-black">
          <div>
            <p className="text-slate-500 mb-8">مسؤول الكنترول</p>
            <p className="border-t border-slate-400 w-40 mx-auto pt-1">التوقيع: .....................</p>
          </div>
          <div>
            <p className="text-slate-500 mb-8">وكيل الشؤون التعليمية</p>
            <p className="border-t border-slate-400 w-40 mx-auto pt-1">التوقيع: .....................</p>
          </div>
          <div>
            <p className="text-slate-500 mb-8">{managerName}</p>
            <p className="border-t border-slate-400 w-40 mx-auto pt-1">التوقيع والختم: .....................</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── مكون بطاقة إحصائية مدمجة ── */
const StatCard = ({ label, value, sub, color, icon }) => (
  <div className={`bg-white border border-${color}-100 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all text-right`}>
    <div className="flex items-center justify-between mb-1.5">
      <span className={`text-[10px] font-black text-${color}-600 uppercase tracking-widest`}>{label}</span>
      <div className={`w-7 h-7 rounded-lg bg-${color}-50 text-${color}-600 flex items-center justify-center`}>
        {icon}
      </div>
    </div>
    <div className={`text-${color}-950 font-black text-2xl leading-none`}>{value}</div>
    {sub && <div className="text-[10px] text-slate-400 font-bold mt-1 truncate">{sub}</div>}
  </div>
);

