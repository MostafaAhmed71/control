import React, { useEffect, useMemo, useState } from 'react';
import { X, Layers, Calendar, CheckSquare, Square, Loader2, Wand2, AlertCircle } from 'lucide-react';
import { dateForDay } from '../../utils/examSchedule';

const WEEKDAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const parseISODate = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

const toISODate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const weekdayOf = (s) => {
  const d = parseISODate(s);
  return d ? WEEKDAY_NAMES[d.getDay()] : '';
};

const inputCls = 'w-full px-6 py-4 bg-slate-50 border-none rounded-[1.5rem] outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-black text-slate-700 text-right shadow-sm';
const labelCls = 'text-[11px] font-black text-slate-400 uppercase tracking-widest px-1';

const BulkGradeExamsModal = ({
  open,
  onClose,
  stages,
  subjects,
  templateOptions,
  isLevelMatch,
  hasExistingExam,
  examSchedule,
  onSave,
}) => {
  const [stage, setStage] = useState('');
  const [grade, setGrade] = useState('');
  const [template, setTemplate] = useState('nafs');
  const [classroom, setClassroom] = useState('');
  const [defaultQCount, setDefaultQCount] = useState(30);
  const [rows, setRows] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [perDay, setPerDay] = useState(1);
  const [skipWeekend, setSkipWeekend] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStage('');
    setGrade('');
    setTemplate('nafs');
    setClassroom('');
    setDefaultQCount(30);
    setRows([]);
    setStartDate('');
    setPerDay(1);
    setSkipWeekend(true);
    setSaving(false);
  }, [open]);

  const scheduleDateFor = (g, subjectName) => {
    const entry = (examSchedule?.entries || []).find(
      (e) => isLevelMatch(e.grade, g) && String(e.subject || '').trim() === subjectName
    );
    return entry ? dateForDay(examSchedule, entry.day) : '';
  };

  useEffect(() => {
    if (!grade) {
      setRows([]);
      return;
    }
    const gradeSubjects = subjects.filter(
      (s) => (s.grades || []).includes('All') || (s.grades || []).some((g) => isLevelMatch(g, grade))
    );
    setRows(
      gradeSubjects.map((s) => {
        const exists = hasExistingExam(grade, s.name, classroom);
        return {
          key: s.id || s.name,
          subject: s.name,
          checked: !exists,
          exists,
          date: scheduleDateFor(grade, s.name),
          qCount: defaultQCount,
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, subjects, examSchedule]);

  useEffect(() => {
    if (!grade) return;
    setRows((prev) => prev.map((r) => ({ ...r, exists: hasExistingExam(grade, r.subject, classroom) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroom]);

  const selectedCount = useMemo(() => rows.filter((r) => r.checked).length, [rows]);
  const allChecked = rows.length > 0 && selectedCount === rows.length;
  const hasScheduleDates = useMemo(
    () => !!grade && rows.some((r) => scheduleDateFor(grade, r.subject)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grade, rows, examSchedule]
  );

  const updateRow = (key, patch) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const moveRow = (index, dir) => {
    setRows((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const autoDistributeDates = () => {
    let d = parseISODate(startDate);
    if (!d) return;
    const isOff = (date) => skipWeekend && (date.getDay() === 5 || date.getDay() === 6);
    while (isOff(d)) d.setDate(d.getDate() + 1);
    const n = Math.max(1, parseInt(perDay, 10) || 1);
    let usedToday = 0;
    setRows((prev) =>
      prev.map((r) => {
        if (!r.checked) return r;
        if (usedToday >= n) {
          d.setDate(d.getDate() + 1);
          while (isOff(d)) d.setDate(d.getDate() + 1);
          usedToday = 0;
        }
        usedToday += 1;
        return { ...r, date: toISODate(d) };
      })
    );
  };

  const fillFromSchedule = () => {
    setRows((prev) => prev.map((r) => {
      const date = scheduleDateFor(grade, r.subject);
      return date ? { ...r, date } : r;
    }));
  };

  const applyQCountToAll = (val) => {
    setDefaultQCount(val);
    setRows((prev) => prev.map((r) => ({ ...r, qCount: val })));
  };

  const handleSave = async () => {
    const chosen = rows.filter((r) => r.checked);
    if (!stage || !grade || chosen.length === 0) return;
    const missingDates = chosen.filter((r) => !r.date);
    if (missingDates.length > 0) {
      const names = missingDates.map((r) => r.subject).join('، ');
      if (!window.confirm(`المواد التالية بدون تاريخ: ${names}\nهل تريد المتابعة وحفظها بدون تاريخ؟`)) return;
    }
    setSaving(true);
    try {
      await onSave({
        stage,
        grade,
        template,
        classroom: classroom.trim(),
        items: chosen.map((r) => ({
          subject: r.subject,
          date: r.date,
          qCount: parseInt(r.qCount, 10) || 30,
        })),
      });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-[3.5rem] shadow-2xl animate-in zoom-in-95 overflow-hidden border-none flex flex-col relative">
        <div className="p-8 pb-6 flex justify-between items-center bg-emerald-600 text-white shrink-0">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/30 shadow-xl"><Layers size={28} /></div>
            <div>
              <h3 className="text-2xl font-black font-header tracking-tight">اختبارات الصف دفعة واحدة</h3>
              <p className="text-emerald-100 text-xs font-bold mt-1">إنشاء اختبار لكل مادة من مواد الصف مع تاريخ مستقل لكل مادة</p>
            </div>
          </div>
          <button onClick={onClose} disabled={saving} className="p-3 bg-white/20 text-white hover:bg-white/40 rounded-2xl transition-all"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className={labelCls}>المرحلة الدراسية</label>
              <select value={stage} onChange={(e) => { setStage(e.target.value); setGrade(''); }} className={inputCls}>
                <option value="">اختر المرحلة...</option>
                {Object.keys(stages).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-3">
              <label className={labelCls}>الصف</label>
              <div className={`flex flex-wrap gap-2 justify-end px-4 py-3 bg-slate-50 rounded-[1.5rem] min-h-[3.5rem] items-center ${!stage ? 'opacity-50 pointer-events-none' : ''}`}>
                {(stages[stage] || []).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrade(g)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all border ${
                      grade === g ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-100' : 'bg-white text-slate-600 border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                    }`}
                  >
                    {g}
                  </button>
                ))}
                {!stage && <span className="text-xs font-bold text-slate-400">اختر المرحلة أولاً</span>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <label className={labelCls}>قالب ورقة الإجابة</label>
              <select value={template} onChange={(e) => setTemplate(e.target.value)} className={inputCls}>
                {templateOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-3">
              <label className={labelCls}>الفصل (اختياري)</label>
              <input type="text" value={classroom} onChange={(e) => setClassroom(e.target.value)} placeholder="مثلاً: أ أو 1/1" className={inputCls} />
            </div>
            <div className="space-y-3">
              <label className={labelCls}>عدد الأسئلة (للكل)</label>
              <input type="number" min="1" max="100" value={defaultQCount} onChange={(e) => applyQCountToAll(e.target.value)} className={inputCls} />
            </div>
          </div>

          {grade && (
            <div className="p-5 bg-emerald-50/60 rounded-[2rem] border border-emerald-100 space-y-4">
              <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                <Wand2 size={18} /> توزيع التواريخ تلقائياً
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <label className={labelCls}>تاريخ أول اختبار</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>عدد المواد في اليوم</label>
                  <select value={perDay} onChange={(e) => setPerDay(e.target.value)} className={inputCls}>
                    <option value={1}>مادة واحدة</option>
                    <option value={2}>مادتان</option>
                    <option value={3}>3 مواد</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none py-4 font-black text-sm text-slate-600">
                  <input type="checkbox" checked={skipWeekend} onChange={(e) => setSkipWeekend(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                  تخطي الجمعة والسبت
                </label>
                <button
                  type="button"
                  onClick={autoDistributeDates}
                  disabled={!startDate || selectedCount === 0}
                  className="py-4 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all disabled:opacity-40"
                >
                  توزيع على المواد المحددة
                </button>
              </div>
              {hasScheduleDates && (
                <button type="button" onClick={fillFromSchedule} className="text-xs font-black text-emerald-700 underline underline-offset-4 hover:text-emerald-900">
                  تعبئة التواريخ من جدول الفترات
                </button>
              )}
            </div>
          )}

          {grade && (
            <div className="rounded-[2rem] border border-slate-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.map((r) => ({ ...r, checked: !allChecked })))}
                  className="flex items-center gap-2 text-sm font-black text-slate-600 hover:text-emerald-700"
                >
                  {allChecked ? <CheckSquare size={18} className="text-emerald-600" /> : <Square size={18} />}
                  تحديد الكل
                </button>
                <span className="text-xs font-black text-slate-500">المحدد: {selectedCount} من {rows.length}</span>
              </div>
              {rows.length === 0 ? (
                <div className="p-8 text-center text-sm font-bold text-slate-400">لا توجد مواد مرتبطة بهذا الصف. أضفها من تبويب «إدارة المقررات».</div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {rows.map((r, i) => (
                    <div key={r.key} className={`grid grid-cols-12 gap-3 items-center px-5 py-3 transition-all ${r.checked ? 'bg-white' : 'bg-slate-50/60 opacity-70'}`}>
                      <button type="button" onClick={() => updateRow(r.key, { checked: !r.checked })} className="col-span-4 flex items-center gap-3 text-right">
                        {r.checked ? <CheckSquare size={20} className="text-emerald-600 shrink-0" /> : <Square size={20} className="text-slate-300 shrink-0" />}
                        <span className="font-black text-slate-700">{r.subject}</span>
                        {r.exists && (
                          <span className="flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-lg" title="يوجد اختبار نشط لهذه المادة والصف">
                            <AlertCircle size={12} /> موجود مسبقاً
                          </span>
                        )}
                      </button>
                      <div className="col-span-4 flex items-center gap-2">
                        <Calendar size={16} className="text-slate-300 shrink-0" />
                        <input
                          type="date"
                          value={r.date}
                          disabled={!r.checked}
                          onChange={(e) => updateRow(r.key, { date: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 rounded-xl outline-none focus:bg-white focus:ring-4 focus:ring-emerald-100 font-black text-slate-700 text-sm text-right"
                        />
                      </div>
                      <div className="col-span-1 text-xs font-black text-slate-400 text-center">{weekdayOf(r.date)}</div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={r.qCount}
                          disabled={!r.checked}
                          onChange={(e) => updateRow(r.key, { qCount: e.target.value })}
                          title="عدد الأسئلة"
                          className="w-full px-3 py-2.5 bg-slate-50 rounded-xl outline-none focus:bg-white focus:ring-4 focus:ring-emerald-100 font-black text-slate-700 text-sm text-center"
                        />
                      </div>
                      <div className="col-span-1 flex flex-col items-center">
                        <button type="button" onClick={() => moveRow(i, -1)} disabled={i === 0} className="text-slate-300 hover:text-emerald-600 disabled:opacity-20 leading-none text-xs" title="تقديم">▲</button>
                        <button type="button" onClick={() => moveRow(i, 1)} disabled={i === rows.length - 1} className="text-slate-300 hover:text-emerald-600 disabled:opacity-20 leading-none text-xs" title="تأخير">▼</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-8 pt-6 border-t border-slate-50 flex gap-4 bg-slate-50/50 shrink-0">
          <button onClick={onClose} disabled={saving} className="px-10 py-4 bg-white text-slate-400 rounded-2xl font-black hover:bg-slate-50 transition-all border border-slate-100 shadow-sm">إلغاء</button>
          <button
            onClick={handleSave}
            disabled={saving || !grade || selectedCount === 0}
            className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 shadow-xl active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            إنشاء {selectedCount} اختبار
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkGradeExamsModal;
