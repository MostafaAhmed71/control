import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { BarChart3, Users, ListChecks, FileDown, RefreshCw, Save, Loader2 } from 'lucide-react';
import {
  getOmrExams,
  getOmrResultsForGrading,
  getStudents,
  getAppSettings,
  saveOmrExam,
} from '../../utils/dataService';
import { isWataniaExam } from '../../utils/studentIdentity';
import { getSchoolNameByStage } from '../../utils/aggregatedGradesPrint';
import {
  examSections,
  collectExamTesters,
  studentsForFilter,
  summarizeSections,
  analyzeQuestions,
  fmt,
} from '../../utils/nationalExamStats';

const STAGES = {
  'ابتدائي': ['الأول الابتدائي', 'الثاني الابتدائي', 'الثالث الابتدائي', 'الرابع الابتدائي', 'الخامس الابتدائي', 'السادس الابتدائي'],
  'متوسط': ['الأول المتوسط', 'الثاني المتوسط', 'الثالث المتوسط'],
  'ثانوي': ['الأول الثانوي', 'الثاني الثانوي', 'الثالث الثانوي'],
};

const TABS = [
  { id: 'stats', label: 'الإحصائيات', icon: BarChart3 },
  { id: 'testers', label: 'قائمة المختبرين', icon: Users },
  { id: 'analysis', label: 'احصائية تحليلية لنتائج الطلاب', icon: ListChecks },
];

const examGrades = (exam) => {
  const list = Array.isArray(exam?.grades) && exam.grades.length ? exam.grades : [exam?.grade];
  return list.map((g) => String(g || '').trim()).filter(Boolean);
};

const todayAr = () =>
  new Date().toLocaleDateString('ar-SA-u-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric' });

/** يلتقط عنصر التقرير ويقسّمه على صفحات A4 دون قطع الصفوف قدر الإمكان */
async function exportReportToPdf(element, filename) {
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const pxPerMm = canvas.width / pageW;
  const pagePx = Math.floor(pageH * pxPerMm);

  const elTop = element.getBoundingClientRect().top;
  const scale = canvas.width / element.offsetWidth;
  const breaks = [...element.querySelectorAll('tr, [data-keep]')].map((n) => {
    const r = n.getBoundingClientRect();
    return { top: (r.top - elTop) * scale, bottom: (r.bottom - elTop) * scale };
  });

  let y = 0;
  let first = true;
  while (y < canvas.height - 2) {
    let end = Math.min(y + pagePx, canvas.height);
    if (end < canvas.height) {
      const cut = breaks.find((b) => b.top < end && b.bottom > end);
      if (cut && cut.top > y + pagePx * 0.3) end = Math.floor(cut.top);
    }
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = end - y;
    const ctx = slice.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, y, canvas.width, end - y, 0, 0, canvas.width, end - y);
    if (!first) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, (end - y) / pxPerMm);
    first = false;
    y = end;
  }
  pdf.save(filename);
}

const th = { border: '1px solid #334155', padding: '7px 6px', background: '#e2e8f0', fontWeight: 800, fontSize: 13 };
const td = { border: '1px solid #334155', padding: '6px', textAlign: 'center', fontSize: 13 };

function ReportFrame({ reportRef, title, exam, grade, stage, extra, managerName, children }) {
  return (
    <div
      ref={reportRef}
      dir="rtl"
      style={{ width: 794, padding: '36px 40px', background: '#fff', color: '#0f172a', fontFamily: 'Alexandria, Tahoma, Arial, sans-serif' }}
    >
      <div data-keep style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ fontSize: 13, lineHeight: 1.9, fontWeight: 700 }}>
          <div>المملكة العربية السعودية</div>
          <div>وزارة التعليم</div>
          <div>{getSchoolNameByStage(stage)}</div>
        </div>
        <img src={encodeURI('/الشعار مفرغ.png')} alt="" style={{ height: 80 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <div style={{ fontSize: 13, lineHeight: 1.9, fontWeight: 700, textAlign: 'left' }}>
          <div>التاريخ: {todayAr()}</div>
          <div>الصف: {grade || stage || '—'}</div>
        </div>
      </div>
      <div data-keep style={{ textAlign: 'center', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', padding: '10px 0', marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{title}</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{exam?.title || ''}{extra ? ` — ${extra}` : ''}</div>
      </div>
      {children}
      <div data-keep style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 48 }}>
        <div style={{ textAlign: 'center', minWidth: 240, fontWeight: 800, fontSize: 15, lineHeight: 2.2 }}>
          <div>يعتمد،</div>
          <div>مدير المدرسة</div>
          <div style={{ fontWeight: 700 }}>{managerName && managerName !== 'اسم المدير هنا' ? managerName : ''}</div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>التوقيع: ............................</div>
        </div>
      </div>
    </div>
  );
}

export default function NationalExamStats() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [students, setStudents] = useState([]);
  const [settings, setSettings] = useState({});
  const [stage, setStage] = useState('');
  const [grade, setGrade] = useState('');
  const [examId, setExamId] = useState('');
  const [tab, setTab] = useState('stats');
  const [sectionIdx, setSectionIdx] = useState(0);
  const [avgBasis, setAvgBasis] = useState('testers');
  const [sectionNames, setSectionNames] = useState(['', '', '']);
  const [savingSections, setSavingSections] = useState(false);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError('');
    try {
      const [ex, rs, st, cfg] = await Promise.all([
        getOmrExams(),
        getOmrResultsForGrading({ forceRefresh }),
        getStudents(),
        getAppSettings().catch(() => ({})),
      ]);
      setExams((ex || []).filter(isWataniaExam));
      setResults(rs || []);
      setStudents(st || []);
      setSettings(cfg || {});
    } catch (e) {
      setError(e?.message || 'تعذّر تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  const stageGrades = stage ? STAGES[stage] || [] : [];

  const filteredExams = useMemo(
    () =>
      exams.filter((e) => {
        const gs = examGrades(e);
        if (grade) return gs.length === 0 || gs.includes(grade);
        if (stage) return String(e.stage || '') === stage || gs.some((g) => stageGrades.includes(g)) || gs.length === 0;
        return true;
      }),
    [exams, grade, stage, stageGrades]
  );

  const exam = useMemo(() => filteredExams.find((e) => String(e.id) === String(examId)) || null, [filteredExams, examId]);
  const examStage = stage || exam?.stage || '';

  useEffect(() => {
    if (examId && !filteredExams.some((e) => String(e.id) === String(examId))) setExamId('');
  }, [filteredExams, examId]);

  useEffect(() => {
    setSectionNames(examSections(exam).map((s) => s.subject));
  }, [exam]);

  const effectiveGrades = useMemo(() => {
    if (grade) return [grade];
    if (stageGrades.length) return stageGrades;
    return exam ? examGrades(exam) : [];
  }, [grade, stageGrades, exam]);

  const roster = useMemo(
    () => studentsForFilter(students, { grade, stageGrades: effectiveGrades }),
    [students, grade, effectiveGrades]
  );

  const testers = useMemo(
    () => (exam ? collectExamTesters(results, exam, students, { grade, stageGrades: effectiveGrades }) : []),
    [results, exam, students, grade, effectiveGrades]
  );

  const totalStudents = Math.max(roster.length, testers.length);
  const attendance = totalStudents ? (testers.length / totalStudents) * 100 : 0;
  const summary = useMemo(() => (exam ? summarizeSections(testers, exam, totalStudents) : null), [testers, exam, totalStudents]);
  const sections = examSections(exam);
  const analysis = useMemo(() => (exam ? analyzeQuestions(testers, exam, sectionIdx) : []), [testers, exam, sectionIdx]);

  const sectionsDirty = exam && sectionNames.some((n, i) => n.trim() !== sections[i].subject);

  const handleSaveSections = async () => {
    if (!exam) return;
    setSavingSections(true);
    try {
      const nextSections = sections.map((s, i) => ({ ...s, subject: sectionNames[i].trim() || s.subject }));
      const updated = { ...exam, sections: nextSections };
      await saveOmrExam(updated);
      setExams((list) => list.map((e) => (String(e.id) === String(exam.id) ? updated : e)));
    } catch (e) {
      alert(e?.message || 'تعذّر حفظ أسماء الأقسام');
    } finally {
      setSavingSections(false);
    }
  };

  const handleExport = async () => {
    if (!reportRef.current || !exam) return;
    setExporting(true);
    try {
      const label = TABS.find((t) => t.id === tab)?.label || 'تقرير';
      const sec = tab === 'analysis' ? ` - ${sections[sectionIdx].subject}` : '';
      await exportReportToPdf(reportRef.current, `${label} - ${exam.title || 'الاختبار الوطني'}${sec}.pdf`);
    } catch (e) {
      alert(e?.message || 'تعذّر تصدير PDF');
    } finally {
      setExporting(false);
    }
  };

  const reportProps = { reportRef, exam, grade, stage: examStage, managerName: settings.managerName };

  const renderReport = () => {
    if (!exam || !summary) return null;
    if (tab === 'stats') {
      return (
        <ReportFrame {...reportProps} title="إحصائية نتائج الاختبارات الوطنية">
          <table data-keep style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18 }}>
            <thead>
              <tr>
                <th style={th}>العدد الإجمالي للطلاب</th>
                <th style={th}>عدد المختبرين</th>
                <th style={th}>عدد الغائبين</th>
                <th style={th}>نسبة الحضور</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...td, fontSize: 16, fontWeight: 800 }}>{totalStudents}</td>
                <td style={{ ...td, fontSize: 16, fontWeight: 800 }}>{testers.length}</td>
                <td style={{ ...td, fontSize: 16, fontWeight: 800 }}>{totalStudents - testers.length}</td>
                <td style={{ ...td, fontSize: 16, fontWeight: 800 }}>{fmt(attendance, 1)}%</td>
              </tr>
            </tbody>
          </table>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th} rowSpan={2}>القسم / المادة</th>
                <th style={th} rowSpan={2}>الأسئلة</th>
                <th style={th} rowSpan={2}>الدرجة العظمى</th>
                <th style={th} colSpan={2}>
                  {avgBasis === 'all'
                    ? `متوسط الدرجات حسب إجمالي عدد الطلاب (${totalStudents})`
                    : `متوسط الدرجات حسب عدد الحضور (${testers.length})`}
                </th>
              </tr>
              <tr>
                <th style={th}>الدرجة</th>
                <th style={th}>النسبة</th>
              </tr>
            </thead>
            <tbody>
              {[...summary.rows, summary.total].map((r, i) => {
                const isTotal = i === summary.rows.length;
                const cell = isTotal ? { ...td, fontWeight: 900, background: '#f1f5f9' } : { ...td, fontWeight: 700 };
                const avg = avgBasis === 'all' ? r.avgAll : r.avgTesters;
                return (
                  <tr key={r.subject}>
                    <td style={cell}>{r.subject}</td>
                    <td style={cell}>{r.range}</td>
                    <td style={cell}>{fmt(r.outOf)}</td>
                    <td style={cell}>{fmt(avg)}</td>
                    <td style={cell}>{r.outOf ? `${fmt((avg / r.outOf) * 100, 1)}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ReportFrame>
      );
    }
    if (tab === 'testers') {
      return (
        <ReportFrame {...reportProps} title="قائمة المختبرين في الاختبارات الوطنية" extra={`عدد المختبرين: ${testers.length}`}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 40 }}>م</th>
                <th style={th}>اسم الطالب</th>
                {sections.map((s, i) => (
                  <th key={i} style={th}>{s.subject}<div style={{ fontWeight: 600, fontSize: 11 }}>من {fmt(summary.rows[i].outOf)}</div></th>
                ))}
                <th style={th}>الدرجة النهائية<div style={{ fontWeight: 600, fontSize: 11 }}>من {fmt(summary.total.outOf)}</div></th>
              </tr>
            </thead>
            <tbody>
              {testers.map((t, idx) => (
                <tr key={`${t.name}-${idx}`}>
                  <td style={td}>{idx + 1}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{t.name}</td>
                  {t.bySection.map((s, i) => <td key={i} style={td}>{fmt(s.score)}</td>)}
                  <td style={{ ...td, fontWeight: 900 }}>{fmt(t.score)}</td>
                </tr>
              ))}
              {testers.length === 0 && (
                <tr><td style={td} colSpan={6}>لا توجد نتائج معتمدة لهذا الاختبار</td></tr>
              )}
            </tbody>
          </table>
        </ReportFrame>
      );
    }
    const sec = sections[sectionIdx];
    const totals = analysis.reduce((a, r) => ({ c: a.c + r.correct, w: a.w + r.wrong }), { c: 0, w: 0 });
    return (
      <ReportFrame
        {...reportProps}
        title="احصائية تحليلية لنتائج الطلاب"
        extra={`القسم: ${sec.subject} (الأسئلة ${sec.from} – ${sec.to}) — عدد المختبرين: ${testers.length}`}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>رقم السؤال</th>
              <th style={th}>الإجابة الصحيحة</th>
              <th style={th}>عدد الإجابات الصحيحة</th>
              <th style={th}>عدد الإجابات الخاطئة</th>
              <th style={th}>نسبة الإجابات الصحيحة</th>
            </tr>
          </thead>
          <tbody>
            {analysis.map((r) => (
              <tr key={r.q}>
                <td style={{ ...td, fontWeight: 800 }}>السؤال {r.q}</td>
                <td style={td}>{r.key}</td>
                <td style={{ ...td, color: '#047857', fontWeight: 800 }}>{r.correct}</td>
                <td style={{ ...td, color: '#b91c1c', fontWeight: 800 }}>
                  {r.wrong}
                  {r.blank > 0 && <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}> (منها {r.blank} بدون إجابة)</span>}
                </td>
                <td style={td}>{fmt(r.pct, 1)}%</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...td, fontWeight: 900, background: '#f1f5f9' }} colSpan={2}>الإجمالي</td>
              <td style={{ ...td, fontWeight: 900, background: '#f1f5f9' }}>{totals.c}</td>
              <td style={{ ...td, fontWeight: 900, background: '#f1f5f9' }}>{totals.w}</td>
              <td style={{ ...td, fontWeight: 900, background: '#f1f5f9' }}>
                {totals.c + totals.w ? `${fmt((totals.c / (totals.c + totals.w)) * 100, 1)}%` : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </ReportFrame>
    );
  };

  const selectCls = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-alexandria focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-5 font-alexandria">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-header text-2xl font-bold text-slate-800">إحصائيات الاختبارات الوطنية</h1>
          <p className="text-sm text-slate-500 mt-1">الاختبار مقسّم إلى 3 أقسام × 10 أسئلة (1–10، 11–20، 21–30)</p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> تحديث البيانات
        </button>
      </div>

      <div className="luxury-card rounded-2xl bg-white p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-600">المرحلة</span>
          <select className={selectCls} value={stage} onChange={(e) => { setStage(e.target.value); setGrade(''); }}>
            <option value="">كل المراحل</option>
            {Object.keys(STAGES).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-600">الصف</span>
          <select className={selectCls} value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">كل الصفوف</option>
            {(stage ? STAGES[stage] : Object.values(STAGES).flat()).map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-600">اسم الاختبار</span>
          <select className={selectCls} value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">— اختر الاختبار —</option>
            {filteredExams.map((e) => <option key={e.id} value={e.id}>{e.title || e.id}</option>)}
          </select>
        </label>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500"><Loader2 className="animate-spin" /> جاري التحميل...</div>
      ) : !exam ? (
        <div className="luxury-card rounded-2xl bg-white p-10 text-center text-slate-500">
          {filteredExams.length ? 'اختر الاختبار لعرض الإحصائيات' : 'لا توجد اختبارات وطنية مطابقة للمرحلة/الصف المختار'}
        </div>
      ) : (
        <>
          <div className="luxury-card rounded-2xl bg-white p-4">
            <div className="text-sm font-bold text-slate-700 mb-3">أقسام الاختبار</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              {sections.map((s, i) => (
                <label key={i} className="space-y-1">
                  <span className="text-xs font-bold text-slate-600">القسم {i + 1} (الأسئلة {s.from}–{s.to})</span>
                  <input
                    className={selectCls}
                    value={sectionNames[i]}
                    onChange={(e) => setSectionNames((arr) => arr.map((v, j) => (j === i ? e.target.value : v)))}
                  />
                </label>
              ))}
              <button
                type="button"
                onClick={handleSaveSections}
                disabled={!sectionsDirty || savingSections}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                {savingSections ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} حفظ أسماء الأقسام
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['العدد الإجمالي للطلاب', totalStudents],
              ['عدد المختبرين', testers.length],
              ['عدد الغائبين', totalStudents - testers.length],
              ['نسبة الحضور', `${fmt(attendance, 1)}%`],
            ].map(([label, value]) => (
              <div key={label} className="luxury-card rounded-2xl bg-white p-4 text-center">
                <div className="text-xs font-bold text-slate-500">{label}</div>
                <div className="mt-1 text-2xl font-black text-slate-800">{value}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                    tab === id ? 'bg-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {tab === 'stats' && (
                <div className="inline-flex rounded-xl border border-slate-300 bg-white p-1 text-sm font-bold">
                  <span className="px-2 py-1.5 text-slate-500">حساب المتوسط حسب:</span>
                  {[
                    ['testers', `عدد الحضور (${testers.length})`],
                    ['all', `إجمالي الطلاب (${totalStudents})`],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setAvgBasis(id)}
                      className={`rounded-lg px-3 py-1.5 transition ${avgBasis === id ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {tab === 'analysis' && (
                <select className={`${selectCls} w-auto`} value={sectionIdx} onChange={(e) => setSectionIdx(Number(e.target.value))}>
                  {sections.map((s, i) => <option key={i} value={i}>{s.subject} ({s.from}–{s.to})</option>)}
                </select>
              )}
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} تصدير PDF
              </button>
            </div>
          </div>

          <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-4">
            <div className="mx-auto w-fit shadow-lg">{renderReport()}</div>
          </div>
        </>
      )}
    </div>
  );
}
