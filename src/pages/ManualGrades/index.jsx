import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PenLine, Search, Loader2, CheckCircle2, RefreshCcw, Trash2, AlertCircle, Users, ScanLine, Save,
} from 'lucide-react';
import { getStudents, getOmrExams, getOmrResults, getOmrResultList, saveOmrResult, deleteOmrResult } from '../../utils/dataService';
import { normalizeStudentId, getStudentNationalId, getStudentSeatNumber } from '../../utils/studentIdentity';
import { isLevelMatch } from '../../utils/gradeMatch';
import { resultsForExam, matchResultsToStudents } from '../../utils/examAttendance';
import { useToast } from '../../components/Toast';

const STAGES = {
  'ابتدائي': ['الأول الابتدائي', 'الثاني الابتدائي', 'الثالث الابتدائي', 'الرابع الابتدائي', 'الخامس الابتدائي', 'السادس الابتدائي'],
  'متوسط': ['الأول المتوسط', 'الثاني المتوسط', 'الثالث المتوسط'],
  'ثانوي': ['الأول الثانوي', 'الثاني الثانوي', 'الثالث الثانوي'],
};

const isTruthy = (v) => v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
const isArchived = (e) => isTruthy(e?.archived);
const isApproved = (r) => isTruthy(r?.approved) || isTruthy(r?.confirmed) || (r?.approvedAt != null && String(r.approvedAt).trim() !== '');

const examGradesOf = (e) => (Array.isArray(e?.grades) && e.grades.length ? e.grades : [e?.grade]).filter(Boolean);
const studentInGrade = (s, grade) => isLevelMatch(s?.grade, grade) || isLevelMatch(s?.classroom, grade);
const studentRoom = (s) => String(s?.classroom ?? s?.class ?? '').trim();

const parseScore = (v) => {
  const s = String(v ?? '').trim().replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace('٫', '.').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

const selectCls = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 disabled:opacity-50';
const labelCls = 'text-[11px] font-black text-slate-400 px-1';

const ManualGrades = () => {
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const [stage, setStage] = useState('');
  const [grade, setGrade] = useState('');
  const [room, setRoom] = useState('');
  const [examId, setExamId] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [search, setSearch] = useState('');
  const [edits, setEdits] = useState({});
  const inputRefs = useRef({});
  const loadVersion = useRef(0);

  const loadData = async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setLoadError('');
    setResults([]);
    try {
      const [s, e, r] = await Promise.all([examId ? getStudents() : [], getOmrExams({ summary: true }), examId ? getOmrResultList(examId) : []]);
      if (version !== loadVersion.current) return;
      setStudents(s || []);
      setExams((e || []).filter((x) => !isArchived(x)));
      setResults(r || []);
    } catch (err) {
      if (version !== loadVersion.current) return;
      setLoadError('تعذر تحميل البيانات. اضغط تحديث للمحاولة مرة أخرى.');
      toast.error('فشل تحميل البيانات.', 'خطأ');
      console.error('ManualGrades load error:', err);
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  };

  useEffect(() => { loadData(); return () => { loadVersion.current += 1; }; }, [examId]);

  const dirtyCount = Object.keys(edits).length;
  const confirmDiscard = () => dirtyCount === 0 || window.confirm('توجد درجات غير معتمدة. هل تريد تجاهلها؟');

  const gradeStudents = useMemo(
    () => (grade ? students.filter((s) => studentInGrade(s, grade)) : []),
    [students, grade]
  );

  const roomOptions = useMemo(() => {
    const set = new Set();
    gradeStudents.forEach((s) => {
      const r = studentRoom(s);
      if (r && !isLevelMatch(r, grade)) set.add(r);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'ar', { numeric: true }));
  }, [gradeStudents, grade]);

  const examOptions = useMemo(
    () => (grade ? exams.filter((e) => examGradesOf(e).some((g) => isLevelMatch(g, grade))) : [])
      .sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || ''))),
    [exams, grade]
  );

  const exam = useMemo(() => exams.find((e) => e.id === examId) || null, [exams, examId]);

  const rosterStudents = useMemo(() => {
    const list = room ? gradeStudents.filter((s) => studentRoom(s) === room) : gradeStudents;
    return [...list].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));
  }, [gradeStudents, room]);

  const existingByStudent = useMemo(
    () => (exam ? matchResultsToStudents(resultsForExam(results, exam), gradeStudents) : new Map()),
    [exam, results, gradeStudents]
  );

  useEffect(() => {
    if (!exam) { setMaxScore(''); return; }
    const anyExisting = [...existingByStudent.values()].find((r) => Number(r.total) > 0);
    setMaxScore(String(anyExisting ? anyExisting.total : (exam.qCount || 30)));
  }, [exam?.id, results]);

  const visibleStudents = useMemo(() => {
    const q = search.trim();
    if (!q) return rosterStudents;
    return rosterStudents.filter((s) =>
      String(s.name || '').includes(q) ||
      getStudentNationalId(s).includes(q) ||
      getStudentSeatNumber(s).includes(q)
    );
  }, [rosterStudents, search]);

  const total = parseScore(maxScore);
  const totalValid = Number.isFinite(total) && total > 0;

  const valueFor = (s) => {
    if (Object.prototype.hasOwnProperty.call(edits, s.id)) return edits[s.id];
    const r = existingByStudent.get(s);
    return r && r.score != null ? String(r.score) : '';
  };

  const rowError = (s) => {
    if (!Object.prototype.hasOwnProperty.call(edits, s.id)) return '';
    const n = parseScore(edits[s.id]);
    if (n === null) return existingByStudent.get(s) ? 'لإزالة الدرجة استخدم زر الحذف' : '';
    if (Number.isNaN(n)) return 'رقم غير صالح';
    if (n < 0) return 'لا تقل عن صفر';
    if (totalValid && n > total) return `أكبر من ${total}`;
    return '';
  };

  const setEdit = (s, value) => {
    setEdits((prev) => {
      const next = { ...prev };
      const r = existingByStudent.get(s);
      const original = r && r.score != null ? String(r.score) : '';
      if (String(value).trim() === original) delete next[s.id];
      else next[s.id] = value;
      return next;
    });
  };

  const focusNext = (index) => {
    const next = visibleStudents[index + 1];
    if (next) inputRefs.current[next.id]?.focus();
  };

  const pending = useMemo(
    () => rosterStudents.filter((s) => {
      if (!Object.prototype.hasOwnProperty.call(edits, s.id)) return false;
      const n = parseScore(edits[s.id]);
      return n !== null && !Number.isNaN(n);
    }),
    [rosterStudents, edits]
  );
  const hasErrors = rosterStudents.some((s) => rowError(s));

  const stats = useMemo(() => {
    let graded = 0;
    let scanned = 0;
    rosterStudents.forEach((s) => {
      const r = existingByStudent.get(s);
      if (r && isApproved(r)) {
        graded += 1;
        if (!r.manualEntry) scanned += 1;
      }
    });
    return { total: rosterStudents.length, graded, scanned, remaining: rosterStudents.length - graded };
  }, [rosterStudents, existingByStudent]);

  const buildPayload = (s, score, now) => {
    const existing = existingByStudent.get(s) || null;
    const nat = getStudentNationalId(s);
    const seat = getStudentSeatNumber(s);
    const key = normalizeStudentId(nat || seat || s.id) || String(s.id);
    const changedScore = !existing || Number(existing.score) !== score || Number(existing.total) !== total;

    const payload = {
      ...(existing || {}),
      id: existing?.id || `omr_${exam.id}_${key}`,
      examId: exam.id,
      examTitle: exam.title || '',
      subject: exam.subject || existing?.subject || '',
      studentId: nat || seat || String(s.id),
      nationalId: nat || existing?.nationalId || '',
      seatNumber: seat || existing?.seatNumber || '',
      studentName: s.name || existing?.studentName || '',
      studentGrade: s.grade || existing?.studentGrade || '',
      classroom: studentRoom(s),
      assignedStudentId: s.id,
      phone: s.phone || s.phoneNumber || existing?.phone || '',
      score,
      total,
      percentage: Number(((score / total) * 100).toFixed(1)),
      approved: true,
      confirmed: true,
      approvedAt: now,
      timestamp: existing?.timestamp || now,
      updatedAt: now,
      manualEntry: true,
      reviewRois: undefined,
      audit: [
        ...(Array.isArray(existing?.audit) ? existing.audit : []),
        {
          action: 'manual_grade',
          at: now,
          note: existing ? `تعديل يدوي من ${existing.score}/${existing.total} إلى ${score}/${total}` : `إدخال يدوي ${score}/${total}`,
        },
      ],
    };
    if (changedScore) {
      delete payload.details;
      delete payload.answers;
    }
    return payload;
  };

  const handleApprove = async () => {
    if (!exam || !pending.length) return;
    if (!totalValid) { toast.error('أدخل الدرجة العظمى بشكل صحيح.', 'تنبيه'); return; }
    if (hasErrors) { toast.error('صحّح الدرجات المظللة بالأحمر أولاً.', 'تنبيه'); return; }
    if (!window.confirm(`اعتماد ${pending.length} درجة لاختبار «${exam.title}»؟ ستظهر للطلاب في الاستعلام عن النتيجة.`)) return;

    setSaving(true);
    const now = new Date().toISOString();
    const failed = [];
    const saved = [];
    try {
      for (let i = 0; i < pending.length; i += 10) {
        const chunk = pending.slice(i, i + 10);
        const payloads = chunk.map((s) => buildPayload(s, parseScore(edits[s.id]), now));
        const res = await Promise.allSettled(payloads.map((p) => saveOmrResult(p)));
        res.forEach((r, j) => (r.status === 'fulfilled' ? saved : failed).push({ student: chunk[j], payload: payloads[j] }));
      }
      if (saved.length) {
        const savedIds = new Set(saved.map((x) => x.payload.id));
        setResults((prev) => [...prev.filter((r) => !savedIds.has(r.id)), ...saved.map((x) => x.payload)]);
        setEdits((prev) => {
          const next = { ...prev };
          saved.forEach((x) => { delete next[x.student.id]; });
          return next;
        });
        toast.success(`تم اعتماد ${saved.length} درجة.`, 'تم الحفظ');
      }
      if (failed.length) toast.error(`فشل حفظ: ${failed.map((x) => x.student.name).join('، ')}`, 'خطأ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s) => {
    const r = existingByStudent.get(s);
    if (!r?.id) return;
    const src = r.manualEntry ? 'المُدخلة يدوياً' : 'المصححة آلياً';
    if (!window.confirm(`حذف نتيجة ${s.name} ${src} (${r.score}/${r.total})؟ لن تظهر بعدها في الاستعلام.`)) return;
    setDeletingId(r.id);
    try {
      await deleteOmrResult(r.id);
      setResults((prev) => prev.filter((x) => x.id !== r.id));
      setEdits((prev) => { const next = { ...prev }; delete next[s.id]; return next; });
      toast.success('تم حذف النتيجة.', 'تم');
    } catch (err) {
      toast.error('تعذر حذف النتيجة.', 'خطأ');
    } finally {
      setDeletingId(null);
    }
  };

  const statusOf = (s) => {
    const dirty = Object.prototype.hasOwnProperty.call(edits, s.id);
    const r = existingByStudent.get(s);
    if (dirty) return <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200">غير معتمدة</span>;
    if (r && isApproved(r)) {
      return r.manualEntry
        ? <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1"><CheckCircle2 size={12} /> معتمدة (يدوي)</span>
        : <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1"><ScanLine size={12} /> معتمدة (تصحيح آلي)</span>;
    }
    if (r) return <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-slate-100 text-slate-600 border border-slate-200">محفوظة غير معتمدة</span>;
    return <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-slate-50 text-slate-400 border border-slate-100">لم تُرصد</span>;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in pb-28">
      <div className="luxury-card p-8 flex flex-col md:flex-row justify-between items-center gap-6 bg-gradient-to-br from-white to-indigo-50/30 border-none">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200">
            <PenLine size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 font-header leading-tight">الإدخال اليدوي للدرجات</h1>
            <p className="text-slate-500 text-sm font-medium mt-1">اختر الصف والفصل والاختبار، أدخل درجة كل طالب ثم اعتمدها لتظهر في الاستعلام عن النتيجة</p>
          </div>
        </div>
        <button
          onClick={() => { if (confirmDiscard()) { setEdits({}); loadData(); } }}
          className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:border-indigo-300 hover:text-indigo-600 transition-all"
        >
          <RefreshCcw size={16} /> تحديث
        </button>
      </div>

      {loadError && <div role="alert" className="p-4 rounded-2xl bg-red-50 text-red-700 font-bold">{loadError}</div>}
      <div className="luxury-card p-6 bg-white border-none grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="space-y-2">
          <label className={labelCls}>المرحلة</label>
          <select value={stage} onChange={(e) => { if (!confirmDiscard()) return; setStage(e.target.value); setGrade(''); setRoom(''); setExamId(''); setEdits({}); }} className={selectCls}>
            <option value="">اختر المرحلة...</option>
            {Object.keys(STAGES).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className={labelCls}>الصف</label>
          <select value={grade} disabled={!stage} onChange={(e) => { if (!confirmDiscard()) return; setGrade(e.target.value); setRoom(''); setExamId(''); setEdits({}); }} className={selectCls}>
            <option value="">اختر الصف...</option>
            {(STAGES[stage] || []).map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className={labelCls}>الفصل</label>
          <select value={room} disabled={!grade} onChange={(e) => setRoom(e.target.value)} className={selectCls}>
            <option value="">كل الفصول</option>
            {roomOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className={labelCls}>الاختبار</label>
          <select value={examId} disabled={!grade} onChange={(e) => { if (!confirmDiscard()) return; setExamId(e.target.value); setEdits({}); }} className={selectCls}>
            <option value="">{grade && !examOptions.length ? 'لا توجد اختبارات لهذا الصف' : 'اختر الاختبار...'}</option>
            {examOptions.map((e) => <option key={e.id} value={e.id}>{e.title}{e.date ? ` — ${e.date}` : ''}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className={labelCls}>الدرجة العظمى</label>
          <input type="number" min="1" value={maxScore} disabled={!exam} onChange={(e) => setMaxScore(e.target.value)} className={`${selectCls} text-center ${exam && !totalValid ? 'border-rose-400 bg-rose-50' : ''}`} />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 size={40} className="animate-spin text-indigo-500" />
          <p className="text-slate-400 font-black">جاري التحميل...</p>
        </div>
      ) : !grade || !exam ? (
        <div className="luxury-card p-16 text-center bg-slate-50/50 border-2 border-dashed border-slate-200">
          <Users size={44} className="mx-auto text-slate-200 mb-4" />
          <h3 className="text-lg font-black text-slate-400">اختر المرحلة والصف والاختبار لعرض أسماء الطلاب</h3>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'طلاب القائمة', value: stats.total, cls: 'text-slate-900' },
              { label: 'درجات معتمدة', value: stats.graded, cls: 'text-emerald-600' },
              { label: 'منها تصحيح آلي', value: stats.scanned, cls: 'text-indigo-600' },
              { label: 'لم تُرصد بعد', value: stats.remaining, cls: 'text-amber-600' },
            ].map((c) => (
              <div key={c.label} className="luxury-card p-5 bg-white border-none">
                <div className={`text-2xl font-black font-header ${c.cls}`}>{c.value}</div>
                <div className="text-[11px] font-black text-slate-400 mt-1">{c.label}</div>
              </div>
            ))}
          </div>

          <div className="luxury-card bg-white border-none overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الهوية أو رقم الجلوس..." className="w-full pr-11 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-100" />
              </div>
              <p className="text-xs font-bold text-slate-400">اضغط Enter للانتقال إلى الطالب التالي</p>
            </div>

            {visibleStudents.length === 0 ? (
              <div className="p-12 text-center text-sm font-bold text-slate-400">لا يوجد طلاب مطابقون في قائمة الطلاب لهذا الصف/الفصل.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs font-black">
                      <th className="p-3 text-center w-12">#</th>
                      <th className="p-3 text-right">اسم الطالب</th>
                      <th className="p-3 text-center">الهوية / الجلوس</th>
                      <th className="p-3 text-center">الفصل</th>
                      <th className="p-3 text-center w-40">الدرجة</th>
                      <th className="p-3 text-center">النسبة</th>
                      <th className="p-3 text-center">الحالة</th>
                      <th className="p-3 w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {visibleStudents.map((s, i) => {
                      const value = valueFor(s);
                      const err = rowError(s);
                      const n = parseScore(value);
                      const pct = n !== null && !Number.isNaN(n) && totalValid ? ((n / total) * 100).toFixed(0) : '';
                      const existing = existingByStudent.get(s);
                      return (
                        <tr key={s.id} className={Object.prototype.hasOwnProperty.call(edits, s.id) ? 'bg-amber-50/40' : ''}>
                          <td className="p-3 text-center font-bold text-slate-400">{i + 1}</td>
                          <td className="p-3 font-black text-slate-800">{s.name}</td>
                          <td className="p-3 text-center font-mono text-xs text-slate-500">{getStudentNationalId(s) || getStudentSeatNumber(s) || '—'}</td>
                          <td className="p-3 text-center text-xs font-bold text-slate-500">{studentRoom(s) || '—'}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2 justify-center">
                              <input
                                ref={(el) => { inputRefs.current[s.id] = el; }}
                                inputMode="decimal"
                                value={value}
                                onChange={(e) => setEdit(s, e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); focusNext(i); } }}
                                onFocus={(e) => e.target.select()}
                                className={`w-20 px-3 py-2 rounded-xl border text-center font-black outline-none focus:ring-4 ${err ? 'border-rose-400 bg-rose-50 text-rose-700 focus:ring-rose-100' : 'border-slate-200 bg-white text-slate-800 focus:ring-indigo-100 focus:border-indigo-300'}`}
                                title={err}
                              />
                              <span className="text-xs font-bold text-slate-400">/ {totalValid ? total : '—'}</span>
                            </div>
                            {err && <div className="text-[10px] font-black text-rose-600 text-center mt-1">{err}</div>}
                          </td>
                          <td className="p-3 text-center font-bold text-slate-500">{pct !== '' ? `${pct}%` : '—'}</td>
                          <td className="p-3 text-center">{statusOf(s)}</td>
                          <td className="p-3 text-center">
                            {existing?.id && (
                              <button
                                onClick={() => handleDelete(s)}
                                disabled={deletingId === existing.id}
                                className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="حذف النتيجة"
                              >
                                {deletingId === existing.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {stats.scanned > 0 && (
            <div className="flex items-start gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              تعديل درجة طالب مصحح آلياً يستبدل نتيجته بالدرجة اليدوية ويُخفي تفاصيل إجاباته في الاستعلام.
            </div>
          )}
        </>
      )}

      {exam && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(640px,92vw)]">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-3 flex items-center justify-between gap-3">
            <span className="text-sm font-bold px-2">
              {pending.length ? `${pending.length} درجة جاهزة للاعتماد` : 'لا توجد تغييرات'}
              {hasErrors && <span className="text-rose-300"> — توجد أخطاء</span>}
            </span>
            <div className="flex gap-2">
              {dirtyCount > 0 && (
                <button onClick={() => setEdits({})} disabled={saving} className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 font-black text-sm">تراجع</button>
              )}
              <button
                onClick={handleApprove}
                disabled={saving || !pending.length || hasErrors || !totalValid}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-black text-sm disabled:opacity-40"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                اعتماد الدرجات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualGrades;
