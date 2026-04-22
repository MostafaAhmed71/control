import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getOmrResults, getAppSettings, getStudents } from './dataService';
import {
  Search, Printer, CheckCircle, AlertCircle, Download,
  GraduationCap, School, User, Award, Hash, BookOpen,
  Calendar, Filter, ChevronDown, X
} from 'lucide-react';
import html2canvas from 'html2canvas';

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
const FilterBar = ({ results, filterDate, setFilterDate, filterText, setFilterText, filtered }) => {
  /* Collect unique dates from results */
  const availableDates = useMemo(() => {
    const set = new Set();
    results.forEach(r => {
      const d = parseResultDate(r);
      if (d) set.add(toDateValue(d));
    });
    return [...set].sort().reverse();
  }, [results]);

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white shadow-xl p-4 sm:p-6 mb-6">
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
        {/* Date filter */}
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <Calendar className="w-3 h-3" /> فلترة حسب اليوم
          </label>
          <div className="flex gap-2">
            <select
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
            >
              <option value="">— كل الأيام —</option>
              {availableDates.map(d => (
                <option key={d} value={d}>
                  {new Date(d).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
                </option>
              ))}
            </select>
            {filterDate && (
              <button onClick={() => setFilterDate('')}
                className="p-2.5 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-all border border-rose-100">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Text / exam name filter */}
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <Filter className="w-3 h-3" /> بحث باسم الاختبار
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="مثلاً: رياضيات، نافس..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all text-right"
            />
            {filterText && (
              <button onClick={() => setFilterText('')}
                className="p-2.5 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-all border border-rose-100">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Counter */}
        <div className="flex items-end pb-0.5">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 text-center min-w-[80px]">
            <div className="text-[10px] font-black text-indigo-400 uppercase">الظاهر</div>
            <div className="text-indigo-900 font-black text-xl">{filtered.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Result Slip ── */
const ResultSlip = ({ result, schoolName, index }) => {
  const g = getGradeLabel(result.percentage);
  const slipRef  = useRef();
  const exportRef = useRef();

  const handleDownload = async () => {
    const canvas = await html2canvas(exportRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const link = document.createElement('a');
    link.href   = canvas.toDataURL('image/png');
    link.download = `شهادة_${result.studentName || result.studentId}_${result.examTitle || index + 1}.png`;
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
            <div style={{ marginTop:'8px', fontSize:'18px', opacity:0.9 }}>{result.examTitle || 'نتيجة الطالب'}</div>
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3 print:hidden">
        {/* Exam badge + date */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center font-black text-sm shadow-sm">
            {index + 1}
          </div>
          <div>
            <div className="font-black text-slate-800 text-sm">{result.examTitle || `اختبار #${index + 1}`}</div>
            {resultDate && (
              <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3" />
                {resultDate.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <button onClick={handleDownload}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95 text-sm">
            <Download className="w-4 h-4" /> تحميل صورة
          </button>
          <button onClick={() => window.print()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-slate-200 active:scale-95 text-sm">
            <Printer className="w-4 h-4" /> طباعة
          </button>
        </div>
      </div>

      <div ref={slipRef} className="luxury-card overflow-hidden border-2 border-slate-200/50 print:border-none print:shadow-none bg-white relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full opacity-50 -z-0" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-slate-50 rounded-tr-full opacity-50 -z-0" />

        <div className="relative z-10">
          <div className="bg-gradient-to-l from-indigo-950 to-indigo-900 text-white p-4 sm:p-6 border-b-4 border-indigo-500 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3 sm:gap-5 text-right">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-xl sm:rounded-2xl p-1.5 shadow-2xl flex items-center justify-center overflow-hidden shrink-0">
                <img src="/school_logo.jpeg" alt="Logo" className="w-full h-full object-contain"
                  onError={e => { e.target.src = 'https://ui-avatars.com/api/?name=S&background=1e1b4b&color=fff'; }} />
              </div>
              <div>
                <h2 className="text-base sm:text-2xl font-black tracking-tight font-header">{schoolName}</h2>
                <div className="flex items-center gap-2 mt-1 text-indigo-200">
                  <GraduationCap className="w-3 h-3" />
                  <span className="text-[10px] sm:text-xs font-bold">نتائج اختبارات معسكر القدرات</span>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-4 px-6 text-center border border-white/20 min-w-[130px]">
              <div className="text-3xl font-black">{result.score}<span className="text-lg opacity-60">/{result.total}</span></div>
              <div className="text-xs font-bold uppercase tracking-widest text-indigo-300 mt-1">الدرجة النهائية</div>
            </div>
          </div>

          <div className="p-4 sm:p-6 md:p-8">
            {/* Student Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'اسم الطالب',        value: result.studentName || result.studentId, icon: <User className="w-4 h-4" />,     color: 'indigo' },
                { label: 'الصف الدراسي',      value: result.studentGrade || '—',            icon: <School className="w-4 h-4" />,    color: 'slate'  },
                { label: 'اسم الاختبار',      value: result.examTitle || '—',               icon: <BookOpen className="w-4 h-4" />,  color: 'indigo' },
                { label: 'رقم الجلوس/الهوية', value: result.studentId,                      icon: <Hash className="w-4 h-4" />,      color: 'slate'  },
              ].map((item, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl bg-${item.color}-100 text-${item.color}-700 flex items-center justify-center shadow-sm`}>
                    {item.icon}
                  </div>
                  <div className="text-right">
                    <span className="block text-slate-500 text-[10px] font-black mb-0.5">{item.label}</span>
                    <strong className="text-slate-800 text-sm font-bold">{item.value}</strong>
                  </div>
                </div>
              ))}
            </div>

            {/* Grade Metric */}
            <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-8 mb-8 p-4 sm:p-6 rounded-3xl bg-indigo-50/50 border border-indigo-100">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-8 border-white flex items-center justify-center shadow-xl text-2xl sm:text-3xl font-black transition-transform hover:scale-105"
                     style={{ backgroundColor: g.bg, color: g.color }}>
                  {Math.round(result.percentage)}%
                </div>
              </div>
              <div className="flex-1 w-full text-right">
                <div className="flex justify-between items-end mb-3">
                  <div className="flex items-center gap-2" style={{ color: g.color }}>
                    {g.icon}
                    <span className="text-xl font-black">{g.label}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-500">مستوى الإنجاز</span>
                </div>
                <div className="h-4 bg-white rounded-full overflow-hidden shadow-inner p-1">
                  <div className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                       style={{ width: `${result.percentage}%`, backgroundColor: g.color }} />
                </div>
              </div>
            </div>

            {/* Answer Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
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

            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-2 opacity-70 italic text-[10px] font-bold text-slate-500">
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
  const [error, setError]         = useState('');
  const [config, setConfig]       = useState(null);

  /* filters */
  const [filterDate, setFilterDate] = useState('');
  const [filterText, setFilterText] = useState('');

  useEffect(() => { getAppSettings().then(setConfig); }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;
    setLoading(true); setError(''); setAllResults(null);
    setFilterDate(''); setFilterText('');

    try {
      const [rawResults, rawStudents] = await Promise.all([getOmrResults(), getStudents()]);
      const student = rawStudents.find(s => s.nationalId && s.nationalId.trim() === studentId.trim());

      let matching = [];
      if (student) {
        matching = rawResults.filter(r =>
          r.approved === true && (
            r.studentId === student.id ||
            r.studentId === student.seatNumber ||
            r.studentName === student.name
          )
        );
      } else {
        matching = rawResults.filter(r =>
          (r.studentId === studentId.trim() || r.nationalId === studentId.trim()) && r.approved === true
        );
      }

      /* ── Sort newest-first ── */
      matching.sort((a, b) => {
        const da = parseResultDate(a);
        const db = parseResultDate(b);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;   // descending
      });

      if (matching.length > 0) setAllResults(matching);
      else setError('عذراً، لم نتمكن من العثور على أي نتائج معتمدة لهذا الرقم.');
    } catch {
      setError('حدث خطأ أثناء البحث عن النتيجة.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Filtered results (applied on top of sorted list) ── */
  const filteredResults = useMemo(() => {
    if (!allResults) return [];
    return allResults.filter(r => {
      /* date filter */
      if (filterDate) {
        const d = parseResultDate(r);
        if (!d || toDateValue(d) !== filterDate) return false;
      }
      /* text filter */
      if (filterText.trim()) {
        const txt = filterText.trim().toLowerCase();
        const title = (r.examTitle || '').toLowerCase();
        if (!title.includes(txt)) return false;
      }
      return true;
    });
  }, [allResults, filterDate, filterText]);

  const schoolName = config?.schoolName || 'متوسطة وثانوية نخبة الشمال الأهلية';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-indigo-950 font-sans" dir="rtl">
      {/* Header */}
      <nav className="glass-header print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-900 rounded-xl flex items-center justify-center shadow-lg transform -rotate-12">
              <GraduationCap className="text-white w-6 h-6" />
            </div>
            <div className="text-right">
              <h1 className="text-base sm:text-lg font-black royal-gradient-text font-header leading-tight">بوابة النخبة</h1>
              <p className="text-[10px] font-bold text-slate-500">منصة الاستعلام عن النتائج</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[11px] font-black text-indigo-900">النظام متصل</span>
          </div>
        </div>
      </nav>

      <div className="p-4 sm:p-6">
        <div className="print:hidden">
          {/* Page Header */}
          <header className="max-w-4xl mx-auto py-8 sm:py-12 text-center">
            <div className="inline-block bg-indigo-100 text-indigo-900 px-4 sm:px-6 py-2 rounded-full font-black text-[11px] sm:text-xs mb-4 shadow-sm border border-indigo-200">
              {config?.schoolName || 'نظام الرصد الذكي'}
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight font-header mb-4 leading-tight">
              نتائج <span className="text-indigo-700">معسكر القدرات</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-500 font-bold max-w-lg mx-auto leading-relaxed">
              بإمكانك الحصول على نتيجتك وتفاصيل إجاباتك بشكل فوري بمجرد إدخال رقم الهوية الخاص بك.
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
                    placeholder="أدخل رقم الهوية أو رقم الجلوس..."
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 sm:py-5 px-4 sm:px-6 pt-7 sm:pt-8 text-base sm:text-xl font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all shadow-sm"
                    value={studentId}
                    onChange={e => setStudentId(e.target.value)}
                  />
                  <label className="absolute right-6 top-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم التعريف</label>
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
              filterDate={filterDate}
              setFilterDate={setFilterDate}
              filterText={filterText}
              setFilterText={setFilterText}
              filtered={filteredResults}
            />

            {/* 3. Results list */}
            {filteredResults.length === 0 ? (
              <div className="luxury-card p-16 text-center bg-slate-50/50 border-2 border-dashed border-slate-200">
                <Filter className="mx-auto text-slate-200 mb-4 w-12 h-12" />
                <h3 className="text-xl font-black text-slate-400">لا توجد نتائج تطابق الفلتر المحدد</h3>
                <button onClick={() => { setFilterDate(''); setFilterText(''); }}
                  className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all">
                  مسح الفلتر
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredResults.map((r, i) => (
                  <ResultSlip key={r.id || i} result={r} schoolName={schoolName} index={i} />
                ))}
              </div>
            )}
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
