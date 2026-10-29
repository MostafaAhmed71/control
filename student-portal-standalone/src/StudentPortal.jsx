import { PORTAL_EXAM_GROUPS, getPortalExamGroup, getPortalExamTitle, getPortalGroupResults, getPortalExamOptions } from './portalExamGroups';
import { getRetakeRange, isRetakeDayAllowed } from './retakeSchedule';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  fetchOmrResultsForPortalLookup,
  hydrateOmrResultsDetails,
  getAppSettings,
  findStudentByNormalizedNationalId,
  getStudentsCached,
  getOmrExamsPortalCached,
  collectStudentIdentityNorms,
  examIsArchived,
  supabaseUrl,
  getMyRetakeRequests,
  requestRetake,
  cancelRetakeRequest,
  retakeMatchesResult,
} from './dataService';
import {
  Search, Printer, CheckCircle, AlertCircle, Download,
  GraduationCap, School, User, Award, Hash, BookOpen,
  Calendar, Filter, ChevronDown, X, CreditCard, RotateCcw,
  Clock, ShieldCheck, CheckCircle2, Sparkles
} from 'lucide-react';
import html2canvas from 'html2canvas';
import schoolLogo from './assets/school_logo.jpeg';


/* ── helpers ── */
const getGradeLabel = (pct) => {
  if (pct >= 90) return { label: 'ممتاز',       color: '#1e1b4b', bg: '#e0e7ff', icon: <Award className="w-5 h-5" /> };
  if (pct >= 80) return { label: 'جيد جداً',    color: '#1e3a8a', bg: '#dbeafe', icon: <Award className="w-5 h-5" /> };
  if (pct >= 70) return { label: 'جيد',         color: '#1d4ed8', bg: '#eff6ff', icon: <Award className="w-5 h-5" /> };
  if (pct >= 50) return { label: 'مقبول',       color: '#4338ca', bg: '#eef2ff', icon: <Award className="w-5 h-5" /> };
  return           { label: 'دون المستوى',     color: '#dc2626', bg: '#fef2f2', icon: <AlertCircle className="w-5 h-5" /> };
};

const getLetterAr = (l) => ({ A: 'أ', B: 'ب', C: 'ج', D: 'د', E: 'هـ' }[l] || l || '—');

/* Tries to parse a date out of the result object */
const parseResultDate = (r) => {
  const raw = r.date || r.createdAt || r.scannedAt || r.timestamp || r.examDate || r._rowCreatedAt || '';
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

/* Format a Date → "YYYY-MM-DD" for <input type="date"> */
const toDateValue = (d) => d ? d.toISOString().slice(0, 10) : '';



/* ── Filter Bar ── */
const FilterBar = ({ results, examGroup, onGroupChange, filterText, setFilterText, filtered }) => {
  const availableExamTitles = useMemo(() => getPortalExamOptions(results, examGroup), [results, examGroup]);
  const isCamp = examGroup === 'qudrat';
  return (
    <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white shadow-xl p-4 sm:p-6 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-4 items-end">
        <div className="space-y-2 min-w-0">
          <label htmlFor="portal-exam-group" className="block text-xs font-black text-slate-600">قسم الاختبارات</label>
          <select id="portal-exam-group" value={examGroup} onChange={e => onGroupChange(e.target.value)}
            className="w-full bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 font-bold text-sm text-indigo-950 outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="">— اختر قسم الاختبارات —</option>
            {PORTAL_EXAM_GROUPS.map(group => <option key={group.value} value={group.value}>{group.label}</option>)}
          </select>
        </div>
        <div className="space-y-2 min-w-0">
          <label htmlFor="portal-exam-title" className="block text-xs font-black text-slate-600">{isCamp ? 'اختر الاختبار' : 'اختر المادة'}</label>
          <div className="flex gap-2">
            <select id="portal-exam-title" value={filterText} disabled={!examGroup || !availableExamTitles.length}
              onChange={e => setFilterText(e.target.value)}
              className="w-full min-w-0 flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-50">
              <option value="">{!examGroup ? '— اختر القسم أولًا —' : isCamp ? '— اختر الاختبار —' : '— اختر المادة —'}</option>
              {availableExamTitles.map(title => <option key={title} value={title}>{title}</option>)}
            </select>
            {filterText && <button type="button" onClick={() => setFilterText('')} aria-label="مسح اختيار الاختبار"
              className="p-2.5 bg-rose-50 text-rose-500 rounded-xl border border-rose-100"><X className="w-4 h-4" /></button>}
          </div>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 text-center">
          <div className="text-[10px] font-black text-indigo-500">النتائج الظاهرة</div>
          <div className="text-indigo-900 font-black text-xl" aria-live="polite">{filtered.length}</div>
        </div>
      </div>
      {examGroup && !availableExamTitles.length && <p role="status" className="mt-4 text-sm font-bold text-slate-500">لا توجد نتائج معتمدة لك في {PORTAL_EXAM_GROUPS.find(group => group.value === examGroup)?.label} حاليًا.</p>}
    </div>
  );
};

const displayExamTitle = getPortalExamTitle;

/** توحيد أرقام الهوية (عربي/لاتيني/أصفار بادئة) للمقارنة */
const normalizeNationalId = (value) => {
  const raw = (value ?? '').toString().trim();
  if (!raw) return '';
  const arabicIndicDigits = '٠١٢٣٤٥٦٧٨٩';
  const easternArabicDigits = '۰۱۲۳۴۵۶۷۸۹';
  const latin = raw
    .split('')
    .map((ch) => {
      const ia = arabicIndicDigits.indexOf(ch);
      if (ia >= 0) return String(ia);
      const ie = easternArabicDigits.indexOf(ch);
      if (ie >= 0) return String(ie);
      return ch;
    })
    .join('');
  return latin.replace(/[^a-zA-Z0-9]/g, '').replace(/^0+/, '').trim();
};

/** هوية سعودية 10 أرقام. لو انكتب 12 خانة نجرّب أول 10 أيضاً */
const expandNationalLookupNorms = (norm) => {
  const n = String(norm || '').trim();
  if (!n) return [];
  const out = [n];
  if (/^[12]\d{11}$/.test(n)) out.push(n.slice(0, 10));
  return [...new Set(out)];
};

/** حقول الهوية المحتملة على سجل طالب (بعض الاستيرادات تضعها في id أو studentId) */
const studentNationalIdNorms = (s) =>
  [s?.nationalId, s?.national_id, s?.id, s?.studentId, s?.student_id]
    .map((v) => normalizeNationalId(String(v ?? '')))
    .filter(Boolean);

/** فهرس: أي معرّف معروف للطالب (هوية، جلوس، معرف نظام…) → سجل الطالب */
const buildSeatStudentMap = (students) => {
  const m = new Map();
  for (const s of students || []) {
    for (const key of [
      s.nationalId,
      s.national_id,
      s.seatNumber,
      s.seat_number,
      s.studentId,
      s.student_id,
      s.id,
    ]) {
      const k = normalizeNationalId(String(key ?? ''));
      if (k && !m.has(k)) m.set(k, s);
    }
  }
  return m;
};

const resolveStudentFromResultRow = (r, bySeat) => {
  const candidates = [
    r.nationalId,
    r.national_id,
    r.studentId,
    r.detectedStudentId,
    r.normalizedDetectedStudentId,
    r.seatNumber,
    r.seat_number,
  ].filter(Boolean);
  for (const c of candidates) {
    const k = normalizeNationalId(String(c));
    if (k && bySeat.has(k)) return bySeat.get(k);
  }
  return null;
};

/** يطابق صفحة «كشف المعتمدين»: اعتماد صريح أو سجلات قديمة بها درجة ومعرّف */
const isApprovedOmrResult = (r) => {
  const t = (v) => v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
  if (t(r?.approved) || t(r?.confirmed)) return true;
  if (r?.approvedAt != null && String(r.approvedAt).trim() !== '') return true;
  const sid = r?.studentId != null ? String(r.studentId).trim() : '';
  if (sid && r?.score != null) return true;
  return false;
};

/**
 * يزيل الصفوف المكررة لنفس الطالب ونفس الاختبار (أكثر من سجل في القاعدة).
 * يُفترض أن المصفوفة مرتبة من الأحدث للأقدم؛ نُبقي أول ظهور لكل مفتاح.
 */
const dedupeStudentResults = (results) => {
  const seenRowIds = new Set();
  const seenLogical = new Set();
  const out = [];
  for (const r of results) {
    if (r.id != null && String(r.id).trim() !== '') {
      const rid = String(r.id).trim();
      if (seenRowIds.has(rid)) continue;
      seenRowIds.add(rid);
    }
    const eid = String(r.examId ?? '').trim();
    const title = (displayExamTitle(r) || '').trim();
    const examPart = eid || title;
    const sid = String(r.studentId ?? '').trim();
    const nat = String(r.nationalId ?? '').trim();
    const name = String(r.studentName ?? '').trim();
    const studentPart = sid || nat || name;
    const logical = `${examPart}|||${studentPart}`;
    if (seenLogical.has(logical)) continue;
    seenLogical.add(logical);
    out.push(r);
  }
  return out;
};

/* ── helpers: تنسيق موعد الإعادة ── */
const fmtRetakeDate = (isoOrSchedule) => {
  if (!isoOrSchedule) return 'موعد يحدده الكنترول';
  let d;
  if (typeof isoOrSchedule === 'object') {
    const { startDate, endDate } = getRetakeRange(isoOrSchedule);
    if (!startDate || !endDate) return 'موعد يحدده الكنترول';
    const formatDay = (day) => new Date(`${day}T12:00:00`).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return `${startDate === endDate ? formatDay(startDate) : `من ${formatDay(startDate)} إلى ${formatDay(endDate)}`} (الساعة ${isoOrSchedule.time || '08:00'})`;
  }
  d = new Date(isoOrSchedule);
  if (isNaN(d.getTime())) return String(isoOrSchedule || '');
  const dayName = d.toLocaleDateString('ar-EG', { timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  if (hasTime) {
    const timeStr = d.toLocaleTimeString('ar-EG', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' });
    return `${dayName} (${timeStr})`;
  }
  return dayName;
};

/* ── Result Slip ── */
const ResultSlip = ({
  result,
  schoolName,
  index,
  portalNationalId,
  portalSeatNumber,
  retakeSchedule,
  existingRetake,
  onRequestRetake,
  onCancelRetake,
}) => {
  const g = getGradeLabel(result.percentage);
  const slipRef  = useRef();
  const exportRef = useRef();

  const handleDownload = async () => {
    const canvas = await html2canvas(exportRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const link = document.createElement('a');
    link.href   = canvas.toDataURL('image/png');
    link.download = `شهادة_${result.studentName || result.studentId}_${displayExamTitle(result) || index + 1}.png`;
    link.click();
  };

  const details = result.details || {};
  const qs   = Object.keys(details).sort((a, b) => parseInt(a) - parseInt(b));
  const col1 = qs.filter(q => parseInt(q) <= 15);
  const col2 = qs.filter(q => parseInt(q) > 15);
  const maxRows = Math.max(col1.length, col2.length, 1);
  const rows = Array.from({ length: maxRows }, (_, i) => ({
    q1: col1[i], d1: col1[i] ? details[col1[i]] : null,
    q2: col2[i], d2: col2[i] ? details[col2[i]] : null
  }));

  const resultDate = parseResultDate(result);

  return (
    <div className="mb-10 group">
      {/* ── hidden export target ── */}
      <div ref={exportRef} style={{ position:'fixed', left:'-10000px', top:0, width:'1000px', background:'#ffffff', direction:'rtl', padding:'40px' }}>
        <div style={{ border:'3px solid #1e1b4b', borderRadius:'24px', overflow:'hidden' }}>
          <div style={{ background:'linear-gradient(to left,#1e1b4b,#312e81)', color:'#fff', padding:'24px 28px', textAlign:'right' }}>
            <div style={{ fontSize:'34px', fontWeight:900 }}>{schoolName}</div>
            <div style={{ marginTop:'8px', fontSize:'18px', opacity:0.9 }}>{displayExamTitle(result)}</div>
          </div>
          <div style={{ padding:'28px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'20px' }}>
              <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'14px', padding:'16px', textAlign:'right' }}>
                <div style={{ color:'#64748b', fontSize:'14px', fontWeight:700, marginBottom:'8px' }}>اسم الطالب</div>
                <div style={{ color:'#0f172a', fontSize:'26px', fontWeight:900 }}>{result.studentName || result.studentId}</div>
              </div>
              <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'14px', padding:'16px', textAlign:'right' }}>
                <div style={{ color:'#64748b', fontSize:'14px', fontWeight:700, marginBottom:'8px' }}>الصف الدراسي</div>
                <div style={{ color:'#0f172a', fontSize:'26px', fontWeight:900 }}>{result.studentGrade || '—'}</div>
              </div>
            </div>
            <div style={{ background:'#eef2ff', border:'1px solid #c7d2fe', borderRadius:'16px', padding:'20px 22px', textAlign:'right' }}>
              <div style={{ color:'#4338ca', fontSize:'18px', fontWeight:800, marginBottom:'14px' }}>الدرجات</div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:'12px' }}>
                <div>
                  <div style={{ color:'#64748b', fontSize:'13px', fontWeight:700 }}>المجموع</div>
                  <div style={{ color:'#0f172a', fontSize:'48px', fontWeight:900 }}>
                    {result.score}<span style={{ color:'#64748b', fontSize:'28px', fontWeight:700 }}>/{result.total}</span>
                  </div>
                </div>
                <div style={{ textAlign:'left' }}>
                  <div style={{ color:'#64748b', fontSize:'13px', fontWeight:700 }}>النسبة</div>
                  <div style={{ color:g.color, fontSize:'40px', fontWeight:900 }}>{Math.round(result.percentage)}%</div>
                  <div style={{ color:g.color, fontSize:'18px', fontWeight:800 }}>{g.label}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── visible card ── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-3 print:hidden">
        {/* Exam badge + date */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center font-black text-sm shadow-sm shrink-0">
            {index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-black text-slate-800 text-sm break-words leading-tight">{displayExamTitle(result)}</div>
            {resultDate && (
              <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3 shrink-0" />
                <span className="truncate">{resultDate.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-row gap-2 sm:justify-end flex-wrap">
          {existingRetake ? (
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-xl text-xs font-black">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>مُسجل للإعادة</span>
            </div>
          ) : retakeSchedule?.isOpen !== false ? (
            <button
              type="button"
              onClick={() => onRequestRetake(result)}
              className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 text-xs sm:text-sm"
            >
              <RotateCcw className="w-4 h-4" /> طلب إعادة
            </button>
          ) : null}
          <button onClick={handleDownload}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95 text-xs sm:text-sm">
            <Download className="w-4 h-4" /> تحميل صورة
          </button>
          <button onClick={() => window.print()}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-3 sm:px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-slate-200 active:scale-95 text-xs sm:text-sm">
            <Printer className="w-4 h-4" /> طباعة
          </button>
        </div>
      </div>

      <div ref={slipRef} className="luxury-card overflow-hidden border-2 border-slate-200/50 print:border-none print:shadow-none bg-white relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full opacity-50 -z-0" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-slate-50 rounded-tr-full opacity-50 -z-0" />

        <div className="relative z-10">
          {/* ── Header ── */}
          <div className="bg-gradient-to-l from-indigo-950 to-indigo-900 text-white p-4 sm:p-6 border-b-4 border-indigo-500">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div className="flex items-center gap-3 sm:gap-5 text-right min-w-0">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-xl sm:rounded-2xl p-1.5 shadow-2xl flex items-center justify-center overflow-hidden shrink-0">
                  <img src={schoolLogo} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div className="min-w-0 flex-1 text-right">
                  <h2 className="text-sm sm:text-2xl font-black tracking-tight font-header leading-snug break-words">{schoolName}</h2>
                  <div className="flex items-start gap-1.5 mt-1 text-indigo-200">
                    <GraduationCap className="w-3 h-3 shrink-0 mt-0.5" />
                    <span className="text-[10px] sm:text-xs font-bold leading-relaxed break-words">{displayExamTitle(result)}</span>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-4 text-center border border-white/20 w-full sm:w-auto sm:min-w-[140px]">
                <div className="flex sm:block items-baseline justify-center gap-2">
                  <div className="text-3xl sm:text-4xl font-black leading-none">
                    {result.score}<span className="text-lg sm:text-xl opacity-60">/{result.total}</span>
                  </div>
                  <div className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-indigo-300 sm:mt-2">الدرجة النهائية</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-6 md:p-8">
            {/* Student Info */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3 mb-5 sm:mb-6">
              {[
                { label: 'اسم الطالب',   value: result.studentName || result.studentId, icon: <User className="w-4 h-4" />,     color: 'indigo' },
                { label: 'الصف الدراسي', value: result.studentGrade || '—',            icon: <School className="w-4 h-4" />,    color: 'slate'  },
                { label: 'اسم الاختبار', value: displayExamTitle(result),               icon: <BookOpen className="w-4 h-4" />,  color: 'indigo' },
                { label: 'رقم الهوية',   value: (portalNationalId || result.nationalId || '—').toString().trim() || '—', icon: <Hash className="w-4 h-4" />, color: 'indigo' },
                { label: 'رقم الجلوس',   value: (portalSeatNumber || result.seatNumber || result.seat_number || '—').toString().trim() || '—', icon: <CreditCard className="w-4 h-4" />, color: 'slate' },
              ].map((item, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 flex items-center gap-2 sm:gap-4 min-w-0">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-${item.color}-100 text-${item.color}-700 flex items-center justify-center shadow-sm shrink-0`}>
                    {item.icon}
                  </div>
                  <div className="text-right min-w-0 flex-1">
                    <span className="block text-slate-500 text-[9px] sm:text-[10px] font-black mb-0.5">{item.label}</span>
                    <strong className="text-slate-800 text-[11px] sm:text-sm font-bold break-words leading-tight block">{item.value}</strong>
                  </div>
                </div>
              ))}
            </div>

            {/* Grade Metric */}
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 mb-6 sm:mb-8 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-indigo-50/50 border border-indigo-100">
              <div className="flex flex-col items-center shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-[6px] sm:border-8 border-white flex items-center justify-center shadow-xl text-2xl sm:text-3xl font-black"
                     style={{ backgroundColor: g.bg, color: g.color }}>
                  {Math.round(result.percentage)}%
                </div>
              </div>
              <div className="flex-1 w-full text-right">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-1 sm:gap-0 mb-3">
                  <div className="flex items-center justify-end gap-2" style={{ color: g.color }}>
                    {g.icon}
                    <span className="text-lg sm:text-xl font-black">{g.label}</span>
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-slate-500 text-right">مستوى الإنجاز</span>
                </div>
                <div className="h-3 sm:h-4 bg-white rounded-full overflow-hidden shadow-inner p-1">
                  <div className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                       style={{ width: `${result.percentage}%`, backgroundColor: g.color }} />
                </div>
              </div>
            </div>

            {/* Answer Details — section title */}
            {qs.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 bg-indigo-600 rounded-full" />
                <h3 className="text-sm sm:text-base font-black text-slate-800">تفاصيل الإجابات</h3>
                <span className="text-[10px] sm:text-xs font-bold text-slate-400">({qs.length} سؤال)</span>
              </div>
            )}

            {/* Answer cards — Mobile (grid of small cards) */}
            <div className="grid grid-cols-2 gap-2 sm:hidden mb-4">
              {qs.map((q) => {
                const d = details[q];
                const correct = d?.is_correct;
                return (
                  <div key={q}
                    className={`rounded-xl border p-2.5 flex items-center justify-between gap-2 ${
                      correct
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-rose-50/50 border-rose-200'
                    }`}>
                    <div className="flex flex-col items-center justify-center w-8 h-8 rounded-lg bg-indigo-900 text-white shrink-0">
                      <span className="text-[9px] font-bold opacity-70 leading-none">س</span>
                      <span className="text-xs font-black leading-none mt-0.5">{q}</span>
                    </div>
                    <div className="flex-1 text-right min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] font-black text-slate-500">إجابتك</span>
                        <span className="text-sm font-black text-indigo-900">{getLetterAr(d?.student_answer)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className="text-[9px] font-black text-slate-500">النموذج</span>
                        <span className="text-sm font-bold text-slate-700">{getLetterAr(d?.correct_option)}</span>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                      correct ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                    }`}>
                      {correct ? '✓' : '✗'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Answer Table — Tablet & Desktop */}
            <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
              <table className="w-full min-w-[640px] text-xs text-center border-collapse">
                <thead>
                  <tr className="bg-indigo-950 text-white print:bg-slate-100 print:text-black">
                    <th className="p-3 border-x border-indigo-900/50 w-16">النتيجة</th>
                    <th className="p-3 border-x border-indigo-900/50 w-16">النموذج</th>
                    <th className="p-3 border-x border-indigo-900/50 w-16">إجابتك</th>
                    <th className="p-3 border-x border-indigo-900/50 bg-indigo-900">سؤال</th>
                    <th className="w-3 bg-slate-200/50" />
                    <th className="p-3 border-x border-indigo-900/50 w-16">النتيجة</th>
                    <th className="p-3 border-x border-indigo-900/50 w-16">النموذج</th>
                    <th className="p-3 border-x border-indigo-900/50 w-16">إجابتك</th>
                    <th className="p-3 border-x border-indigo-900/50 bg-indigo-900">سؤال</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {rows.map(({ q1, d1, q2, d2 }, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      {q2 ? (
                        <>
                          <td className={`p-2 font-black ${d2.is_correct ? 'text-emerald-600 bg-emerald-50/30' : 'text-red-500 bg-red-50/30'}`}>
                            {d2.is_correct ? '✓' : '✗'}
                          </td>
                          <td className="p-2 border-x border-slate-100 text-slate-600 font-bold">{getLetterAr(d2.correct_option)}</td>
                          <td className="p-2 border-x border-slate-100 font-black text-indigo-900">{getLetterAr(d2.student_answer)}</td>
                          <td className="p-2 bg-indigo-50/30 font-black text-indigo-950">{q2}</td>
                        </>
                      ) : <td colSpan="4" />}
                      <td className="bg-slate-50 w-3" />
                      {q1 ? (
                        <>
                          <td className={`p-2 font-black ${d1.is_correct ? 'text-emerald-600 bg-emerald-50/30' : 'text-red-500 bg-red-50/30'}`}>
                            {d1.is_correct ? '✓' : '✗'}
                          </td>
                          <td className="p-2 border-x border-slate-100 text-slate-600 font-bold">{getLetterAr(d1.correct_option)}</td>
                          <td className="p-2 border-x border-slate-100 font-black text-indigo-900">{getLetterAr(d1.student_answer)}</td>
                          <td className="p-2 bg-indigo-50/30 font-black text-indigo-950">{q1}</td>
                        </>
                      ) : <td colSpan="4" />}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── قسم إعادة الاختبار وتأكيد الرغبة ── */}
            <div className="mt-6 pt-5 border-t-2 border-slate-100 print:hidden">
              {existingRetake ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-right shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="font-black text-emerald-950 text-sm sm:text-base flex items-center gap-2 flex-wrap">
                          <span>تم تسجيل رغبتك في إعادة اختبار {displayExamTitle(result)}</span>
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                            existingRetake.status === 'confirmed'
                              ? 'bg-teal-100 text-teal-800 border-teal-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}>
                            {existingRetake.status === 'confirmed' ? 'طلب مؤكد في الكنترول' : 'قيد الانتظار'}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 flex-wrap">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          <span>موعد الإعادة المسجل: <strong>{fmtRetakeDate(existingRetake.scheduledDate || retakeSchedule)}</strong></span>
                        </div>
                        {retakeSchedule?.notes && (
                          <p className="text-[11px] font-bold text-emerald-900 bg-white/80 p-2.5 rounded-xl border border-emerald-100 mt-1">
                            📌 <strong>تعليمات الإدارة:</strong> {retakeSchedule.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onCancelRetake(existingRetake.id, displayExamTitle(result))}
                      className="text-xs font-black text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 px-4 py-2 rounded-xl transition-all self-start sm:self-center shrink-0 shadow-sm"
                    >
                      إلغاء طلب الإعادة
                    </button>
                  </div>
                </div>
              ) : retakeSchedule?.isOpen !== false ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50/60 border border-indigo-100 text-right shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-950 text-white flex items-center justify-center shrink-0 shadow-md">
                        <RotateCcw className="w-5 h-5 text-amber-300" />
                      </div>
                      <div className="space-y-1">
                        <div className="font-black text-slate-900 text-sm sm:text-base">
                          هل ترغب في إعادة اختبار {displayExamTitle(result)} لتحسين درجتك؟
                        </div>
                        <div className="text-xs font-bold text-indigo-700 flex items-center gap-1.5 flex-wrap">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                          <span>فترة الإعادة المتاحة لاختيار يوم: <strong>{fmtRetakeDate(retakeSchedule)}</strong></span>
                        </div>
                        {retakeSchedule?.notes && (
                          <p className="text-[11px] font-bold text-slate-500">
                            ملاحظة: {retakeSchedule.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRequestRetake(result)}
                      className="bg-indigo-950 hover:bg-indigo-900 text-white font-black text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0 self-stretch sm:self-center"
                    >
                      <RotateCcw className="w-4 h-4 text-emerald-400" />
                      <span>تسجيل طلب إعادة</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-right text-xs text-slate-500 font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>استقبال طلبات إعادة الاختبار مغلق حالياً من قبل إدارة المدرسة.</span>
                </div>
              )}
            </div>

            <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-2 opacity-70 italic text-[9px] sm:text-[10px] font-bold text-slate-500">
              <p className="text-right">صدر هذا التقرير آلياً من نظام التصحيح الإلكتروني والمراجعة الذكية للنخبة</p>
              <p className="text-right">تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════ */
export default function StudentPortal() {
  const [studentId, setStudentId] = useState('');
  const [allResults, setAllResults] = useState(null);   // sorted, full list
  const [loading, setLoading]     = useState(false);
  const [searchProgress, setSearchProgress] = useState(null);
  const [error, setError]         = useState('');
  const [config, setConfig]       = useState(null);
  const [searchedStudent, setSearchedStudent] = useState(null);

  /* Retake requests state */
  const [myRetakes, setMyRetakes] = useState([]);
  const [retakeModalResult, setRetakeModalResult] = useState(null);
  const [retakeSubmitting, setRetakeSubmitting] = useState(false);
  const [retakeDay, setRetakeDay] = useState('');
  const retakeRange = getRetakeRange(config?.retakeSchedule);
  const retakeDayValid = isRetakeDayAllowed(config?.retakeSchedule, retakeDay);
  const [retakeToastMsg, setRetakeToastMsg] = useState('');

  /* filters */
  const [filterText, setFilterText] = useState('');
  const [examGroup, setExamGroup] = useState('');
  const handleGroupChange = (group) => {
    setExamGroup(group);
    setFilterText('');
  };

  useEffect(() => { getAppSettings().then(setConfig); }, []);

  const handleConfirmRetake = async () => {
    if (!retakeModalResult || retakeSubmitting || !retakeDayValid) return;
    setRetakeSubmitting(true);
    try {
      const studentName = searchedStudent?.name || retakeModalResult?.studentName || '';
      const studentGrade = searchedStudent?.grade || retakeModalResult?.studentGrade || '';
      const sid = String(searchedStudent?.id || retakeModalResult?.studentId || '').trim();
      const nat = String(searchedStudent?.nationalId || retakeModalResult?.nationalId || studentId).trim();
      const seat = String(searchedStudent?.seatNumber || retakeModalResult?.seatNumber || '').trim();
      const examTitle = displayExamTitle(retakeModalResult);
      const examId = retakeModalResult?.examId != null ? String(retakeModalResult.examId) : '';

      const payload = {
        examId,
        examTitle,
        studentId: sid || nat,
        nationalId: nat,
        seatNumber: seat || nat,
        studentName,
        studentGrade,
        originalScore: retakeModalResult.score,
        originalTotal: retakeModalResult.total,
        originalPercentage: retakeModalResult.percentage,
        originalResultId: retakeModalResult.id,
        status: 'pending',
      };

      const newRecord = await requestRetake(payload, retakeDay);
      setMyRetakes((prev) => [newRecord, ...prev]);
      setRetakeModalResult(null);
      setRetakeToastMsg(`تم تسجيل رغبتك في إعادة اختبار "${examTitle}" بنجاح!`);
      setTimeout(() => setRetakeToastMsg(''), 5000);
    } catch (err) {
      alert(err.message || 'تعذر إرسال طلب إعادة الاختبار. يرجى المحاولة مرة أخرى.');
    } finally {
      setRetakeSubmitting(false);
    }
  };

  const handleCancelRetake = async (retakeId, examTitle) => {
    if (!window.confirm(`هل أنت متأكد من إلغاء طلب إعادة اختبار "${examTitle || ''}"؟`)) return;
    try {
      await cancelRetakeRequest(retakeId);
      setMyRetakes((prev) => prev.filter((x) => x.id !== retakeId));
      setRetakeToastMsg(`تم إلغاء طلب إعادة اختبار "${examTitle}" بنجاح.`);
      setTimeout(() => setRetakeToastMsg(''), 4000);
    } catch {
      alert('تعذر إلغاء الطلب.');
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;
    setLoading(true); setError(''); setAllResults(null);
    setFilterText(''); setExamGroup(''); setSearchedStudent(null); setMyRetakes([]);
    setSearchProgress({
      phase: 'init',
      pct: 4,
      primary: 'بدء الاستعلام…',
      secondary:
        'الاستعلام يستخدم فهرس الهوية أو دالة portal_fetch على الخادم — دون تحميل كل الجدول.',
    });

    const lookupNorms = expandNationalLookupNorms(normalizeNationalId(studentId));
    if (!lookupNorms.length) {
      setError('يرجى إدخال رقم هوية صالح.');
      setLoading(false);
      setSearchProgress(null);
      return;
    }
    let inputNorm = lookupNorms[0];

    try {
      const reportScanProgress = (p) => {
        let pct = 10;
        if (p.totalCount != null && p.totalCount > 0) {
          pct = Math.min(88, 10 + Math.floor((p.loaded / p.totalCount) * 78));
        } else {
          pct = Math.min(82, 10 + p.pageIndex * 4);
        }
        const nf = new Intl.NumberFormat('ar-EG');
        setSearchProgress({
          phase: 'scan',
          pct,
          primary: 'جاري استعلام النتائج من الخادم…',
          secondary:
            p.totalCount != null
              ? `${nf.format(p.loaded)} من ${nf.format(p.totalCount)} سجل`
              : `تمت معالجة ${nf.format(p.loaded)} سجل`,
        });
      };

      let rawResults;
      let matchSource;
      let studentEarly = null;
      try {
        for (const candidate of lookupNorms) {
          studentEarly = await findStudentByNormalizedNationalId(candidate);
          const pack = await fetchOmrResultsForPortalLookup(
            candidate,
            studentEarly,
            reportScanProgress
          );
          rawResults = pack.rows;
          matchSource = pack.source;
          inputNorm = candidate;
          if ((pack.rows && pack.rows.length > 0) || studentEarly) break;
        }
      } catch (inner) {
        if (inner && inner.code === 'PORTAL_FAST_PATH_FAILED') {
          setError(inner.message);
          setSearchProgress(null);
          return;
        }
        throw inner;
      }

      setSearchProgress({
        phase: 'match',
        pct: 88,
        primary: 'جاري تجهيز العرض…',
        secondary: null,
      });

      const [sRes, eRes, allStudentsRes] = await Promise.allSettled([
        Promise.resolve(studentEarly),
        getOmrExamsPortalCached(),
        getStudentsCached(),
      ]);

      const allStudents =
        allStudentsRes.status === 'fulfilled' && Array.isArray(allStudentsRes.value)
          ? allStudentsRes.value
          : [];
      const rawStudents =
        sRes.status === 'fulfilled' && sRes.value ? [sRes.value] : [];
      const allExams = eRes.status === 'fulfilled' ? eRes.value : [];

      if (sRes.status === 'rejected' || eRes.status === 'rejected') {
        console.warn(
          'بوابة الطالب: تعذر تحميل سجل الطالب أو قائمة الاختبارات؛ يُكمَل العرض من نتائج الاستعلام.',
          sRes.status === 'rejected' ? sRes.reason : null,
          eRes.status === 'rejected' ? eRes.reason : null
        );
      }

      const activeExams = allExams.filter((e) => !examIsArchived(e));
      const activeExamById = new Map(activeExams.map((e) => [String(e.id), e]));
      const archivedExamIds = new Set(
        allExams.filter((e) => examIsArchived(e)).map((e) => String(e.id))
      );

      const isResultFromActiveExam = (r) => {
        const eid = r.examId != null && String(r.examId).trim() !== '' ? String(r.examId) : '';
        if (eid) {
          if (archivedExamIds.has(eid)) return false;
          if (activeExamById.has(eid)) return true;
          return true;
        }
        const title = String(r.examTitle || '').trim();
        if (title) {
          return activeExams.some((ex) => String(ex.title || '').trim() === title);
        }
        return true;
      };

      const enrichResult = (r) => {
        const eid = r.examId != null && String(r.examId).trim() !== '' ? String(r.examId) : '';
        const ex = eid ? activeExamById.get(eid) : null;
        const fromExam = ex?.title != null ? String(ex.title).trim() : '';
        const currentTitle = String(r.examTitle || '').trim();
        const examTitle = currentTitle || fromExam;
        return { ...r, examTitle, portalExamGroup: getPortalExamGroup({ ...ex, ...r, examTitle, examSubject: ex?.subject || r.subject }) };
      };

      const bySeatMap = buildSeatStudentMap(
        allStudents.length > 0 ? allStudents : rawStudents
      );
      const student =
        (sRes.status === 'fulfilled' && sRes.value) ||
        allStudents.find((s) => studentNationalIdNorms(s).includes(inputNorm)) ||
        rawStudents.find((s) => studentNationalIdNorms(s).includes(inputNorm)) ||
        null;

      const studentNorms = collectStudentIdentityNorms(student, inputNorm);

      const trustServer = ['rpc', 'index', 'merged', 'fallback'].includes(matchSource);

      const natMatchesResult = (r) => {
        if (!isApprovedOmrResult(r)) return false;
        const rNat = normalizeNationalId(r.nationalId || r.national_id || '');
        if (rNat && rNat === inputNorm) return true;
        for (const raw of [r.studentId, r.detectedStudentId, r.normalizedDetectedStudentId]) {
          if (normalizeNationalId(String(raw ?? '')) === inputNorm) return true;
        }
        const linked = resolveStudentFromResultRow(r, bySeatMap);
        if (linked && studentNationalIdNorms(linked).includes(inputNorm)) return true;
        return false;
      };

      const rowMatchesLookup = (r) => {
        if (!isApprovedOmrResult(r)) return false;
        if (natMatchesResult(r)) return true;
        const keys = [
          r.nationalId,
          r.national_id,
          r.studentId,
          r.detectedStudentId,
          r.normalizedDetectedStudentId,
          r.seatNumber,
          r.seat_number,
        ]
          .map((v) => normalizeNationalId(String(v ?? '')))
          .filter(Boolean);
        if (keys.some((k) => studentNorms.has(k))) return true;
        const linked = resolveStudentFromResultRow(r, bySeatMap);
        if (linked && student && String(linked.id) === String(student.id)) return true;
        if (linked && studentNationalIdNorms(linked).includes(inputNorm)) return true;
        if (student) {
          const seatNorm = normalizeNationalId(
            String(student.seatNumber || student.seat_number || '')
          );
          if (seatNorm && keys.includes(seatNorm)) return true;
          const name = String(student.name || '').trim();
          const rName = String(r.studentName || '').trim();
          if (name.length >= 4 && rName.length >= 4 && name === rName) return true;
        }
        return false;
      };

      let matching = trustServer
        ? rawResults.filter(rowMatchesLookup)
        : rawResults.filter(natMatchesResult);

      const afterExamFilter = matching.filter(isResultFromActiveExam);
      matching = (afterExamFilter.length > 0 ? afterExamFilter : matching).map(enrichResult);

      matching.sort((a, b) => {
        const da = parseResultDate(a);
        const db = parseResultDate(b);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;
      });

      matching = dedupeStudentResults(matching);
      // The approved score stored by control is authoritative, including manual edits.
      // Do not recalculate it from the original scan answers in this read-only portal.

      if (matching.length > 0) {
        setAllResults(matching);
        const resolvedStudent =
          student || resolveStudentFromResultRow(matching[0], bySeatMap) || null;
        const natRaw = (
          resolvedStudent?.nationalId ||
          resolvedStudent?.national_id ||
          studentId.trim() ||
          ''
        ).toString().trim();
        setSearchedStudent({
          ...(resolvedStudent || {}),
          nationalId: natRaw || studentId.trim(),
          name: resolvedStudent?.name || matching[0]?.studentName || '',
          grade: resolvedStudent?.grade || resolvedStudent?.classroom || matching[0]?.studentGrade || '',
          seatNumber: resolvedStudent?.seatNumber || resolvedStudent?.seat_number || '',
          identifier: natRaw || studentId.trim(),
        });

        setLoading(false);
        setSearchProgress(null);

        // جلب طلبات إعادة الاختبار المسجلة لهذا الطالب مسبقاً
        void getMyRetakeRequests(inputNorm)
          .then((reqs) => setMyRetakes(reqs))
          .catch((e) => console.warn('[بوابة الطالب] تعذر جلب طلبات الإعادة:', e));

        void hydrateOmrResultsDetails(matching, (p) => {
          const step = Math.max(1, p.total);
          const pct = 88 + Math.min(11, Math.floor((p.loaded / step) * 11));
          setSearchProgress({
            phase: 'details',
            pct,
            primary: 'تحميل تفاصيل الإجابات في الخلفية…',
            secondary: `الدفعة ${p.loaded} من ${p.total}`,
          });
        })
          .then((withDetails) => {
            setAllResults(withDetails);
            setSearchProgress(null);
          })
          .catch((e) => {
            console.warn('[بوابة الطالب] تعذر تحميل تفاصيل الأسئلة:', e);
            setSearchProgress(null);
          });
      } else {
        setError('عذراً، لم نتمكن من العثور على أي نتائج معتمدة لرقم الهوية هذا.');
      }
    } catch (err) {
      if (err && err.code === 'PORTAL_FAST_PATH_FAILED') {
        setError(err.message);
      } else if (err && err.code === 'SUPABASE_FETCH') {
        const tech = [err.pgCode, err.pgMessage].filter(Boolean).join(' — ');
        setError(
          [
            'تعذر تحميل نتائج الاختبارات من الخادم.',
            tech ? `(${tech})` : null,
            `تأكد أن المشروع يطابق: ${supabaseUrl}`,
            'راجع سياسات RLS لـ omr_results و students، واتصال الإنترنت.',
          ]
            .filter(Boolean)
            .join(' ')
        );
      } else {
        setError('حدث خطأ أثناء البحث عن النتيجة.');
      }
    } finally {
      setLoading(false);
      setSearchProgress(null);
    }
  };

  /* ── Filtered results (only shown after subject is selected) ── */
  const filteredResults = useMemo(() => {
    if (!allResults) return [];
    if (!filterText.trim()) return [];
    const target = filterText.trim();
    return getPortalGroupResults(allResults, examGroup).filter(r => {
      const title = (displayExamTitle(r) || '').trim();
      return title === target;
    });
  }, [allResults, examGroup, filterText]);

  const schoolName = config?.schoolName || 'متوسطة وثانوية نخبة الشمال الأهلية';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-indigo-950 font-sans" dir="rtl">
      <div className="p-4 sm:p-6">
        <div className="print:hidden">
          {/* Page Header */}
          <header className="max-w-3xl mx-auto pt-8 pb-6 sm:pt-12 sm:pb-8 text-center">
            {/* School Logo */}
            <div className="inline-block relative mb-3">
              <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto bg-white rounded-3xl p-2 shadow-2xl border border-slate-200/80 flex items-center justify-center overflow-hidden ring-8 ring-indigo-50/80 transition-transform hover:scale-105 duration-300">
                <img
                  src={schoolLogo}
                  alt={schoolName}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* School Name Badge */}
            <div className="mb-3">
              <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200/90 text-slate-800 px-4 py-1.5 rounded-full text-xs sm:text-sm font-black shadow-sm">
                <School className="w-4 h-4 text-indigo-700" />
                <span>{schoolName}</span>
              </span>
            </div>

            {/* Main Title & Semester */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 font-header tracking-tight leading-tight">
                نتائج الاختبارات
              </h1>
              <div className="inline-block">
                <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs sm:text-sm font-black px-4 py-1.5 rounded-2xl shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  الفصل الدراسي الأول
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-500 font-bold max-w-md mx-auto leading-relaxed mt-3">
              أدخل رقم الهوية فقط للاستعلام عن النتيجة الرسمية.
            </p>
          </header>

          {/* Search Box */}
          <main className="max-w-xl mx-auto mb-12 sm:mb-16 relative">
            <div className="absolute -top-12 -left-12 w-64 h-64 bg-indigo-200/20 blur-3xl rounded-full" />
            <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-slate-200/20 blur-3xl rounded-full" />

            <div className="luxury-card p-5 sm:p-10 md:p-14 border border-white shadow-2xl relative z-10 backdrop-blur-sm bg-white/90">
              <div className="mb-8 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
                  <Search className="text-indigo-600 w-8 h-8" />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-800">استعلم عن نتيجتك</h2>
              </div>

              <form onSubmit={handleSearch} className="space-y-5">
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="أدخل رقم الهوية..."
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 sm:py-5 px-4 sm:px-6 pt-7 sm:pt-8 text-base sm:text-xl font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all shadow-sm"
                    value={studentId}
                    onChange={e => setStudentId(e.target.value)}
                  />
                  <label className="absolute right-6 top-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم الهوية</label>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full bg-indigo-950 text-white py-4 sm:py-5 rounded-2xl font-black text-base sm:text-xl shadow-xl shadow-indigo-900/20 hover:bg-indigo-900 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>جاري المراجعة...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-6 h-6 text-emerald-400" />
                      <span>عــرض النـتـيـجـة</span>
                    </>
                  )}
                </button>
              </form>

              {loading && searchProgress && (
                <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/80 px-4 py-4 text-right shadow-inner">
                  <div className="h-2.5 w-full rounded-full bg-white overflow-hidden mb-3 border border-indigo-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-indigo-600 to-indigo-400 transition-[width] duration-500 ease-out"
                      style={{ width: `${Math.min(100, Math.max(3, searchProgress.pct))}%` }}
                    />
                  </div>
                  <p className="text-sm font-black text-indigo-950 leading-snug">{searchProgress.primary}</p>
                  {searchProgress.secondary ? (
                    <p className="text-xs font-bold text-indigo-700/90 mt-1.5 tabular-nums">{searchProgress.secondary}</p>
                  ) : null}
                </div>
              )}

              {error && (
                <div className="mt-8 flex items-center gap-4 text-red-600 bg-red-50 p-5 rounded-2xl font-bold border border-red-100 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <p className="text-sm">{error}</p>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* ── Results Section ── */}
        {allResults && allResults.length > 0 && (
          <div className="max-w-4xl mx-auto mb-16 sm:mb-24 animate-in fade-in slide-in-from-bottom-8 duration-700">

            {/* 1. Filter Bar */}
            <FilterBar
              results={allResults}
              examGroup={examGroup}
              onGroupChange={handleGroupChange}
              filterText={filterText}
              setFilterText={setFilterText}
              filtered={filteredResults}
            />

            {/* 2. Results list (only after subject selection) */}
            {!filterText.trim() ? (
              <div className="luxury-card p-16 text-center bg-slate-50/50 border-2 border-dashed border-slate-200">
                <BookOpen className="mx-auto text-indigo-300 mb-4 w-12 h-12" />
                <h3 className="text-xl font-black text-slate-500">{!examGroup ? 'يرجى اختيار قسم الاختبارات' : examGroup === 'qudrat' ? 'اختر الاختبار لعرض النتيجة' : 'اختر المادة لعرض النتيجة'}</h3>
                <p className="mt-2 text-sm font-bold text-slate-400">{!examGroup ? 'اختبارات الفترة الأولى أو معسكر القدرات' : 'حدد اختيارك من القائمة المنسدلة بالأعلى'}</p>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="luxury-card p-16 text-center bg-slate-50/50 border-2 border-dashed border-slate-200">
                <Filter className="mx-auto text-slate-200 mb-4 w-12 h-12" />
                <h3 className="text-xl font-black text-slate-400">{examGroup === 'qudrat' ? 'لا توجد نتائج لهذا الاختبار' : 'لا توجد نتائج لهذه المادة'}</h3>
                <button onClick={() => setFilterText('')}
                  className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all">
                  {examGroup === 'qudrat' ? 'اختيار اختبار آخر' : 'اختيار مادة أخرى'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredResults.map((r, i) => (
                  <ResultSlip
                    key={r.id || i}
                    result={r}
                    schoolName={schoolName}
                    index={i}
                    portalNationalId={searchedStudent?.nationalId || ''}
                    portalSeatNumber={searchedStudent?.seatNumber != null ? String(searchedStudent.seatNumber) : ''}
                    retakeSchedule={config?.retakeSchedule}
                    existingRetake={myRetakes.find((rt) => retakeMatchesResult(rt, r))}
                    onRequestRetake={(res) => { setRetakeDay(''); setRetakeModalResult(res); }}
                    onCancelRetake={handleCancelRetake}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── نافذة تأكيد تسجيل طلب إعادة الاختبار (Retake Confirmation Modal) ── */}
        {retakeModalResult && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:hidden" dir="rtl">
            <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-lg max-h-[90dvh] overflow-y-auto shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-950 text-white rounded-2xl flex items-center justify-center shadow-md">
                    <RotateCcw className="w-6 h-6 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg sm:text-xl">تأكيد طلب إعادة الاختبار</h3>
                    <p className="text-xs font-bold text-slate-400 mt-0.5">تسجيل الرغبة في دخول اختبار الإعادة</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRetakeModalResult(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* تفاصيل المادة والطالب */}
              <div className="bg-slate-50 p-4 rounded-2xl space-y-2 text-xs border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">اسم الطالب:</span>
                  <strong className="text-slate-900 text-sm font-black">{searchedStudent?.name || retakeModalResult?.studentName}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">المادة المراد إعادتها:</span>
                  <strong className="text-indigo-900 text-sm font-black">{displayExamTitle(retakeModalResult)}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">الصف الدراسي:</span>
                  <strong className="text-slate-800 font-bold">{searchedStudent?.grade || retakeModalResult?.studentGrade || '—'}</strong>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                  <span className="text-slate-500 font-bold">الدرجة السابقة:</span>
                  <strong className="text-slate-900 font-black">
                    {retakeModalResult.score} / {retakeModalResult.total} ({Math.round(retakeModalResult.percentage)}%)
                  </strong>
                </div>
              </div>

              {/* موعد الاختبار المعتمد من الإدارة */}
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-1.5 text-right">
                <div className="text-[11px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>فترة الإعادة المعتمدة من إدارة الكنترول</span>
                </div>
                <div className="text-base font-black text-emerald-950">
                  {fmtRetakeDate(config?.retakeSchedule)}
                </div>
                {config?.retakeSchedule?.notes && (
                  <p className="text-xs font-bold text-emerald-800/90 pt-1 border-t border-emerald-200/50 mt-1">
                    📌 {config.retakeSchedule.notes}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="retake-day" className="block text-sm font-black text-slate-800">اختر يوم الاختبار داخل الفترة *</label>
                <input id="retake-day" type="date" value={retakeDay}
                  min={retakeRange.startDate || undefined} max={retakeRange.endDate || undefined}
                  onChange={(e) => setRetakeDay(e.target.value)} required disabled={retakeSubmitting}
                  aria-describedby="retake-day-help"
                  className="w-full rounded-2xl border-2 border-indigo-200 bg-white p-3 font-bold text-slate-900" />
                <p id="retake-day-help" className="text-xs font-bold text-slate-500">
                  سيُسجّل اليوم الذي تختاره في كشف الكنترول. وقت الاختبار: {config?.retakeSchedule?.time || '08:00'}.
                </p>
                {retakeDay && !retakeDayValid && <p role="alert" className="text-xs text-rose-700">اختر يومًا داخل الفترة المعتمدة، ويجب أن يكون استقبال الطلبات مفتوحًا.</p>}
              </div>

              <p className="text-[11px] font-bold text-slate-500 leading-relaxed bg-amber-50/70 border border-amber-200/70 p-3 rounded-xl text-amber-900">
                💡 بالضغط على «تأكيد الطلب»، سيتم تسجيل اسمك فوراً لدى إدارة الكنترول في كشف الطلاب الراغبين في إعادة الاختبار.
              </p>

              {/* أزرار الإجراء */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmRetake}
                  disabled={retakeSubmitting || !retakeDayValid}
                  className="flex-1 bg-indigo-950 hover:bg-indigo-900 text-white py-3.5 px-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-indigo-950/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {retakeSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>جاري إرسال الطلب...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>تأكيد تسجيل طلب الإعادة</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setRetakeModalResult(null)}
                  disabled={retakeSubmitting}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 px-5 rounded-2xl font-bold text-sm transition-all"
                >
                  تراجع
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── إشعار عائم عند النجاح ── */}
        {retakeToastMsg && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-indigo-950 text-white px-6 py-3.5 rounded-2xl shadow-2xl border border-indigo-800 flex items-center gap-3 font-bold text-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{retakeToastMsg}</span>
          </div>
        )}
      </div>

      <footer className="py-12 border-t border-slate-200 text-center print:hidden">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Elite Control Smart System</p>
          <div className="flex justify-center gap-8 text-slate-300">
            {[1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-current" />)}
          </div>
        </div>
      </footer>
    </div>
  );
}



