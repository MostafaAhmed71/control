import React, { useEffect, useMemo, useState } from 'react';
import { Printer, ChevronDown, Search, CheckSquare, Square } from 'lucide-react';
import { getOmrExams, getStudents, getAppSettings } from './dataService';
import { activePrintExams, directExamGrades, examStage, matchesPrintScope, prepareDirectExamBatches } from './directExamPrintData';
import { createPrintableExamPdf } from './retakeExamExport';

const saudiToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const studentKey = (student) => String(student?.id ?? '');

export default function DirectExamPrint() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('');
  const [grade, setGrade] = useState('');
  const [examIds, setExamIds] = useState([]);
  const [studentIds, setStudentIds] = useState([]);
  const [search, setSearch] = useState('');
  const [day, setDay] = useState(saudiToday);
  const [printing, setPrinting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');

  useEffect(() => {
    if (!open || data) return;
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([getOmrExams(), getStudents(), getAppSettings()])
      .then(([exams, students, settings]) => { if (active) setData({ exams, students, settings }); })
      .catch(() => { if (active) setError('تعذر تحميل الاختبارات والطلاب. أغلق القسم وافتحه للمحاولة مرة أخرى.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, data]);

  const exams = useMemo(() => activePrintExams(data?.exams || []), [data]);
  const stages = useMemo(() => [...new Set(exams.map((exam) => examStage(exam.stage || directExamGrades(exam)[0])).filter(Boolean))], [exams]);
  const grades = useMemo(() => [...new Set(exams.filter((exam) => matchesPrintScope(exam, stage)).flatMap(directExamGrades))].sort((a, b) => a.localeCompare(b, 'ar')), [exams, stage]);
  const availableExams = useMemo(() => grade ? exams.filter((exam) => matchesPrintScope(exam, stage, grade)) : [], [exams, stage, grade]);
  const students = useMemo(() => grade ? (data?.students || []).filter((student) => matchesPrintScope(student, stage, grade)) : [], [data, stage, grade]);
  const matchingStudents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ar');
    return students.filter((student) => [student.name, student.nationalId, student.national_id, student.seatNumber, student.seat_number].some((value) => String(value || '').toLocaleLowerCase('ar').includes(query)))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));
  }, [students, search]);

  const allVisibleSelected = matchingStudents.length > 0 && matchingStudents.every((student) => studentIds.includes(studentKey(student)));

  const changeScope = () => { setExamIds([]); setStudentIds([]); setSearch(''); setError(''); setPdfUrl(''); };

  const toggleStudent = (id, checked) => {
    setStudentIds((prev) => checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((item) => item !== id));
  };

  const toggleVisibleStudents = () => {
    const visibleIds = matchingStudents.map(studentKey).filter(Boolean);
    setStudentIds((prev) => {
      if (allVisibleSelected) return prev.filter((id) => !visibleIds.includes(id));
      const next = [...prev];
      for (const id of visibleIds) if (!next.includes(id)) next.push(id);
      return next;
    });
  };

  const handlePrint = async (event) => {
    event.preventDefault();
    if (printing || !data) return;
    setError('');
    setPdfUrl('');
    let batches;
    try {
      batches = prepareDirectExamBatches({ ...data, stage, grade, examIds, studentIds, day });
    } catch (err) { setError(err.message); return; }
    const preview = window.open('', '_blank');
    if (preview) { preview.document.title = 'تجهيز الاختبارات'; preview.document.body.textContent = `جاري تجهيز أوراق ${studentIds.length} طالب للطباعة...`; }
    setPrinting(true);
    try {
      const pdf = await createPrintableExamPdf(batches, setProgress);
      const url = URL.createObjectURL(pdf);
      setPdfUrl(url);
      setTimeout(() => URL.revokeObjectURL(url), 300000);
      if (preview && !preview.closed) {
        preview.addEventListener('load', () => { try { preview.focus(); preview.print(); } catch { /* The PDF viewer also provides a print button. */ } }, { once: true });
        preview.location.replace(url);
      }
    } catch (err) {
      if (preview && !preview.closed) preview.close();
      setError(err.message || 'تعذر تجهيز أوراق الاختبارات.');
    } finally { setPrinting(false); setProgress(''); }
  };

  const selectClass = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold disabled:opacity-50';
  return (
    <section className="bg-white border border-emerald-200 rounded-3xl shadow-sm overflow-hidden">
      <button type="button" aria-expanded={open} aria-controls="direct-exam-print" disabled={printing} onClick={() => setOpen(!open)} className="w-full p-5 flex items-center justify-between text-right hover:bg-emerald-50">
        <span><span className="flex items-center gap-2 font-black text-emerald-900"><Printer size={20} /> طباعة اختبارات طالب مباشرة</span><span className="block text-xs text-slate-500 mt-1">اختر المرحلة والصف ومادة أو أكثر، ثم حدّد طالباً أو أكثر. تُطبع أوراق الجميع في ملف واحد.</span></span>
        <ChevronDown size={20} className={open ? 'rotate-180' : ''} />
      </button>
      {open && <div id="direct-exam-print" className="border-t border-emerald-100 p-5">
        {loading ? <p role="status" className="text-sm text-slate-500">جاري تحميل الطلاب والاختبارات...</p> : <form onSubmit={handlePrint} className="space-y-5">
          {data && stages.length === 0 && <p className="text-sm text-amber-700">لا توجد اختبارات نشطة متاحة للطباعة.</p>}
          <fieldset disabled={printing || !data} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="text-xs font-bold space-y-2"><span>المرحلة</span><select required value={stage} onChange={(event) => { setStage(event.target.value); setGrade(''); changeScope(); }} className={selectClass}><option value="">اختر المرحلة</option>{stages.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="text-xs font-bold space-y-2"><span>الصف</span><select required disabled={!stage} value={grade} onChange={(event) => { setGrade(event.target.value); changeScope(); }} className={selectClass}><option value="">اختر الصف</option>{grades.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="text-xs font-bold space-y-2"><span>تاريخ الاختبار</span><input required type="date" value={day} onChange={(event) => setDay(event.target.value)} className={selectClass} /></label>
            </div>
            {grade && <>
              <fieldset><legend className="font-black text-sm mb-3">المواد — يمكن اختيار أكثر من مادة ({examIds.length})</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availableExams.map((exam) => <label key={exam.id} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer ${examIds.includes(String(exam.id)) ? 'bg-emerald-50 border-emerald-400' : 'border-slate-200'}`}>
                    <input type="checkbox" checked={examIds.includes(String(exam.id))} onChange={(event) => setExamIds((prev) => event.target.checked ? [...prev, String(exam.id)] : prev.filter((id) => id !== String(exam.id)))} className="mt-1 accent-emerald-700" />
                    <span><span className="block text-sm font-black">{exam.subject || exam.title}</span><span className="block text-xs text-slate-500">{exam.title}{exam.date ? ` · ${exam.date}` : ''}</span></span>
                  </label>)}
                </div>
              </fieldset>
              <fieldset>
                <legend className="font-black text-sm mb-3">الطلاب — يمكن اختيار أكثر من اسم ({studentIds.length})</legend>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                  <label className="flex-1 text-xs font-bold space-y-2"><span className="flex items-center gap-1"><Search size={14} /> بحث عن الطالب</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="الاسم أو الهوية أو رقم الجلوس" className={selectClass} /></label>
                  <button type="button" onClick={toggleVisibleStudents} disabled={!matchingStudents.length} className="sm:mt-6 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-black text-xs hover:bg-slate-100 disabled:opacity-40">
                    {allVisibleSelected ? <CheckSquare size={16} className="text-emerald-700" /> : <Square size={16} />}
                    {allVisibleSelected ? 'إلغاء تحديد المعروض' : 'تحديد كل المعروض'}
                    <span className="text-slate-400">({matchingStudents.length})</span>
                  </button>
                </div>
                {matchingStudents.length === 0 ? (
                  <p className="text-sm text-amber-700">{students.length === 0 ? 'لا يوجد طلاب مسجلون في هذا الصف.' : 'لا يوجد طالب مطابق للبحث.'}</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1">
                    {matchingStudents.map((student) => {
                      const id = studentKey(student);
                      const selected = studentIds.includes(id);
                      return (
                        <label key={id} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer ${selected ? 'bg-emerald-50 border-emerald-400' : 'border-slate-200'}`}>
                          <input type="checkbox" checked={selected} onChange={(event) => toggleStudent(id, event.target.checked)} className="mt-1 accent-emerald-700" />
                          <span>
                            <span className="block text-sm font-black">{student.name}</span>
                            <span className="block text-xs text-slate-500" dir="ltr">
                              {student.nationalId || student.national_id || student.seatNumber || student.seat_number || id}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </fieldset>
            </>}
            <button type="submit" disabled={!studentIds.length || !examIds.length || printing} className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-3 rounded-xl font-black text-sm disabled:opacity-50">
              <Printer size={17} />
              {printing
                ? `جاري تجهيز الاختبارات ${progress}`
                : `طباعة ${examIds.length} اختبار لـ ${studentIds.length || 0} طالب`}
            </button>
          </fieldset>
        </form>}
        {error && <p role="alert" className="text-sm font-bold text-rose-700 mt-4">{error}</p>}
        {pdfUrl && <p role="status" className="text-sm text-emerald-800 mt-4">تم تجهيز الاختبارات في ملف واحد. <a href={pdfUrl} target="_blank" rel="noreferrer" className="font-black underline">فتح الملف للطباعة</a></p>}
      </div>}
    </section>
  );
}
