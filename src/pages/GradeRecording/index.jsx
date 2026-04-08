import React, { useState, useEffect, useMemo } from 'react';
import { Search, Trophy, User, Filter, FileText, Download, TrendingUp, BookOpen, BarChart2, X, Calendar, Clock, Loader2, Trash2, AlertTriangle, Eraser, PieChart } from 'lucide-react';
import { getStudents, getOmrResults, getOmrExams, saveOmrResult, deleteOmrResult } from '../../utils/dataService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const STAGES = {
  'ابتدائي': ['الأول الابتدائي','الثاني الابتدائي','الثالث الابتدائي','الرابع الابتدائي','الخامس الابتدائي','السادس الابتدائي'],
  'متوسط':  ['الأول المتوسط','الثاني المتوسط','الثالث المتوسط'],
  'ثانوي':  ['الأول الثانوي','الثاني الثانوي','الثالث الثانوي'],
};

const getSchoolNameByStage = (stage = '') => {
  const s = String(stage || '').trim();
  if (s === 'ابتدائي' || s === 'الابتدائي') return 'مدارس نخبة الشمال الأهلية والعالمية';
  if (s === 'متوسط' || s === 'المتوسط' || s === 'ثانوي' || s === 'الثانوي') return 'متوسطة وثانوية نخبة الشمال الأهلية';
  return 'مدارس نخبة الشمال الأهلية والعالمية';
};

const GradeRecording = () => {
  const [students,   setStudents]   = useState([]);
  const [results,    setResults]    = useState([]);
  const [exams,      setExams]      = useState([]);
  const [loading,    setLoading]    = useState(true);

  /* Filters */
  const [searchTerm,     setSearchTerm]     = useState('');
  const [filterStage,    setFilterStage]    = useState('All');
  const [filterGrade,    setFilterGrade]    = useState('All');
  const [filterSubject,  setFilterSubject]  = useState('All'); 

  /* Statistics */
  const [showStats, setShowStats] = useState(false);

  /* Export Modal & Metadata */
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDay,       setExportDay]       = useState('الأحد');
  const [exportDate,      setExportDate]      = useState(new Date().toLocaleDateString('ar-SA'));
  const [isExporting,     setIsExporting]     = useState(false);
  const [isExportingStats,setIsExportingStats]= useState(false);
  const [isZeroing,       setIsZeroing]       = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [sd, rd, ed] = await Promise.all([getStudents(), getOmrResults(), getOmrExams()]);
    setStudents(sd); setResults(rd); setExams(ed); setLoading(false);
  };

  /* All subjects that appear in exams */
  const allSubjects = useMemo(() => [...new Set(exams.map(e => e.subject).filter(Boolean))], [exams]);
  /* Grades for filter */
  const filterGrades = filterStage !== 'All' ? STAGES[filterStage] || [] : [];
  const printSchoolName = getSchoolNameByStage(filterStage);

  /* Results indexed by studentId → subject → best result */
  const resultIndex = useMemo(() => {
    const idx = {}; // { studentId: { subject: result } }
    results.forEach(r => {
      const exam = exams.find(e => e.id === r.examId);
      const subject = exam?.subject || r.examTitle || '؟';
      if (!idx[r.studentId]) idx[r.studentId] = {};
      // Keep the latest result per subject
      if (!idx[r.studentId][subject] || new Date(r.timestamp) > new Date(idx[r.studentId][subject].timestamp)) {
        idx[r.studentId][subject] = r;
      }
    });
    return idx;
  }, [results, exams]);

  /* Filtered students */
  const filteredStudents = useMemo(() => students.filter(s => {
    const sGrade = s.grade || s.classroom || '';
    const sStage = s.stage || '';
    
    if (filterStage !== 'All') {
      const normalizedStudentStage = sStage.replace(/^ال/, '');
      const stageGrades = STAGES[filterStage] || [];
      const matchesStage = normalizedStudentStage === filterStage || stageGrades.includes(sGrade);
      if (!matchesStage) return false;
    }
    
    if (filterGrade !== 'All') {
      if (sGrade !== filterGrade && !filterGrade.includes(sGrade)) return false;
    }
    
    const matchSearch = !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.includes(searchTerm);
    return matchSearch;
  }).sort((a, b) => a.name.localeCompare(b.name, 'ar')), [students, filterStage, filterGrade, searchTerm]);

  /* Subjects to display in columns */
  const displaySubjects = filterSubject === 'All' ? allSubjects : [filterSubject];

  /* ── Performance Statistics ── */
  const performanceStats = useMemo(() => {
    const stats = { excellent: 0, veryGood: 0, good: 0, pass: 0, weak: 0, total: 0 };
    filteredStudents.forEach(s => {
      const sResults = resultIndex[s.id] || {};
      const subjectScores = displaySubjects.map(sub => sResults[sub] || null).filter(Boolean);
      
      if (subjectScores.length > 0) {
        const avgPct = subjectScores.reduce((sum, r) => sum + parseFloat(r.percentage), 0) / subjectScores.length;
        stats.total++;
        if (avgPct >= 90) stats.excellent++;
        else if (avgPct >= 80) stats.veryGood++;
        else if (avgPct >= 65) stats.good++;
        else if (avgPct >= 50) stats.pass++;
        else stats.weak++;
      }
    });
    return stats;
  }, [filteredStudents, resultIndex, displaySubjects]);

  const handleExportStatisticsPDF = async () => {
    if (performanceStats.total === 0) {
      alert("لا توجد إحصائيات لتصديرها.");
      return;
    }
    setIsExportingStats(true);
    
    // Wait for DOM layout
    await new Promise(r => setTimeout(r, 600));

    const element = document.querySelector('.printable-statistics-page');
    if (!element) {
      alert('خطأ في الوصول إلى التقرير.');
      setIsExportingStats(false);
      return;
    }

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`إحصائيات_النتائج_${filterSubject === 'All' ? 'عام' : filterSubject}.pdf`);
    } catch (error) {
      console.error('Stats PDF Generation Error:', error);
      alert('حدث خطأ أثناء تصدير الإحصائيات');
    } finally {
      setIsExportingStats(false);
    }
  };

  const handleExportPDF = async () => {
    if (filteredStudents.length === 0) return;
    setIsExporting(true);
    
    // Wait for DOM to render all pages
    await new Promise(r => setTimeout(r, 800));

    const pageElements = document.querySelectorAll('.printable-page');
    if (pageElements.length === 0) {
      alert('خطأ في الوصول إلى عناصر التقرير.');
      setIsExporting(false);
      return;
    }

    try {
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      for (let i = 0; i < pageElements.length; i++) {
        const canvas = await html2canvas(pageElements[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) pdf.addPage();
        
        const imgWidth = 210;
        const imgHeight = 297; // Explicitly A4 height
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
      }

      pdf.save(`كشف_درجات_${filterSubject === 'All' ? 'عام' : filterSubject}.pdf`);
      setShowExportModal(false);
    } catch (error) {
      console.error('PDF Generation Error:', error);
      alert('حدث خطأ أثناء توليد ملف الـ PDF');
    } finally {
      setIsExporting(false);
    }
  };

  /* CSV Export */
  const handleExportCSV = () => {
    const subjectCols = filterSubject === 'All' ? allSubjects : [filterSubject];
    const headers = ['رقم الطالب','اسم الطالب','الصف', ...subjectCols.map(s=>`${s} - الدرجة`), ...subjectCols.map(s=>`${s} - النسبة`)];
    const rows = filteredStudents.map(s => {
      const sResults = resultIndex[s.id] || {};
      const scoresCols = subjectCols.map(sub => sResults[sub] ? `${sResults[sub].score}/${sResults[sub].total}` : '-');
      const pctCols    = subjectCols.map(sub => sResults[sub] ? `${sResults[sub].percentage}%` : '-');
      return [s.id, s.name, s.grade||s.classroom||'-', ...scoresCols, ...pctCols];
    });
    const csv = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = encodeURI(csv); a.download = 'GradeReport.csv';
    document.body.appendChild(a); a.click();
  };

  /* Clear grades (Delete records) */
  const handleClearGrades = async () => {
    if (filteredStudents.length === 0) return;
    
    const count = filteredStudents.length;
    const msg = filterSubject === 'All' 
      ? `تنبيه هام: هل أنت متأكد من مسح جميع الدرجات لـ ${count} طالب؟\nسيتم حذف السجلات بالكامل ولن تظهر أي درجات.`
      : `تنبيه هام: هل أنت متأكد من مسح درجات مادة (${filterSubject}) لـ ${count} طالب؟\nسيتم حذف الدرجات المسجلة في هذه المادة لتصبح فارغة.`;

    if (!window.confirm(msg)) return;

    setIsZeroing(true);
    try {
      const deletions = [];
      filteredStudents.forEach(student => {
        const sResults = resultIndex[student.id] || {};
        const subjectsToClear = filterSubject === 'All' ? Object.keys(sResults) : (sResults[filterSubject] ? [filterSubject] : []);
        
        subjectsToClear.forEach(sub => {
          const res = sResults[sub];
          if (res && res.id) {
            deletions.push(deleteOmrResult(res.id));
          }
        });
      });

      if (deletions.length > 0) {
        await Promise.all(deletions);
        await loadData();
        alert('تم مسح الدرجات بنجاح ✅');
      } else {
        alert('لا توجد درجات مرصودة لمسحها لهؤلاء الطلاب حالياً.');
      }
    } catch (error) {
      console.error('Error clearing grades:', error);
      alert('حدث خطأ أثناء مسح الدرجات.');
    } finally {
      setIsZeroing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4">

      {/* Header */}
      <div className="flex justify-between items-end bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <Trophy className="text-amber-500"/> رصد الدرجات (OMR)
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-gray-400 font-medium text-sm w-full md:w-auto">درجات الطلاب مصنفة حسب المرحلة والصف والمادة</p>
            <button onClick={() => setShowStats(!showStats)} 
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all
                ${showStats ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
              <BarChart2 size={14}/>
              {showStats ? 'إخفاء الإحصائيات' : 'عرض إحصائيات المستويات'}
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleClearGrades} disabled={isZeroing || filteredStudents.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold hover:bg-red-600 hover:text-white transition-all disabled:opacity-40">
            {isZeroing ? <Loader2 size={18} className="animate-spin" /> : <Eraser size={18} />}
            مسح الدرجات المعتمدة
          </button>
          <button onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
            <Download size={18} /> تصدير كشف الدرجات
          </button>
        </div>
      </div>

      {/* Statistics Section */}
      {showStats && (
        <div className="space-y-6 animate-in slide-in-from-top-4">
          {performanceStats.total > 0 ? (
            <>
              {/* Main Chart Card */}
              <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl shadow-gray-100/50 flex flex-col md:flex-row gap-10 items-center">
                <div className="w-full md:w-1/2">
                  <h4 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
                    <BarChart2 className="text-indigo-500" size={24}/>
                    توزيع مستويات أداء الطلاب
                  </h4>
                  <PerformanceChart stats={performanceStats} />
                </div>
                <div className="w-full md:w-1/2 space-y-4">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-dashed border-gray-200">
                    <h5 className="text-sm font-black text-slate-500 mb-4 flex items-center gap-2 italic">
                      <TrendingUp size={16}/> نظرة عامة على النتائج
                    </h5>
                    <p className="text-sm text-slate-600 leading-relaxed font-bold">
                      أظهرت النتائج الحالية أن <span className="text-emerald-600 font-black">{( (performanceStats.excellent / performanceStats.total) * 100 ).toFixed(1)}%</span> من الطلاب في مستوى ممتاز، 
                      بينما يمثل الطلاب دون مستوى النجاح حوالي <span className="text-rose-600 font-black">{( (performanceStats.weak / performanceStats.total) * 100 ).toFixed(1)}%</span>.
                      <br/><br/>
                      * يتم حساب هذه الإحصائيات بناءً على <span className="text-indigo-600 underline">المتوسط العام</span> للفلاتر المطبقة حالياً.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50/50 p-5 rounded-3xl border border-emerald-100/50 flex flex-col items-center justify-center shadow-sm">
                        <span className="text-[10px] font-black text-emerald-700/60 uppercase tracking-widest mb-2">نسبة الإتقان العامة</span>
                        <span className="text-3xl font-black text-emerald-600">{( ((performanceStats.excellent + performanceStats.veryGood) / performanceStats.total) * 100 ).toFixed(0)}%</span>
                    </div>
                    <div className="bg-indigo-50/50 p-5 rounded-3xl border border-indigo-100/50 flex flex-col items-center justify-center shadow-sm">
                        <span className="text-[10px] font-black text-indigo-700/60 uppercase tracking-widest mb-2">متوسط التحصيل</span>
                        <span className="text-3xl font-black text-indigo-600">
                          {( 
                            (filteredStudents.reduce((sum, s) => {
                              const r = resultIndex[s.id];
                              const scored = displaySubjects.map(sub => r?.[sub]).filter(Boolean);
                              if (scored.length === 0) return sum;
                              return sum + (scored.reduce((t, x) => t + parseFloat(x.percentage), 0) / scored.length);
                            }, 0) / performanceStats.total).toFixed(1)
                          )}%
                        </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-5">
                <StatCard label="ممتاز (90-100)" count={performanceStats.excellent} total={performanceStats.total} color="emerald" icon={<Trophy size={20}/>} />
                <StatCard label="جيد جداً (80-89)" count={performanceStats.veryGood} total={performanceStats.total} color="blue" icon={<TrendingUp size={20}/>} />
                <StatCard label="جيد (65-79)" count={performanceStats.good} total={performanceStats.total} color="indigo" icon={<BookOpen size={20}/>} />
                <StatCard label="مقبول (50-64)" count={performanceStats.pass} total={performanceStats.total} color="amber" icon={<BarChart2 size={20}/>} />
                <StatCard label="ضعيف (< 50)" count={performanceStats.weak} total={performanceStats.total} color="rose" icon={<TrendingUp size={20} className="rotate-180"/>} />
              </div>
            </>
          ) : (
            <div className="bg-white p-12 rounded-[3rem] border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mb-4">
                <BarChart2 size={40}/>
              </div>
              <h4 className="text-xl font-black text-slate-400">لا توجد بيانات متاحة للإحصائيات</h4>
              <p className="text-slate-400 text-sm mt-1 max-w-sm">يرجى التأكد من رصد درجات لبعض الطلاب في الصف المختار ليظهر الرسم البياني.</p>
            </div>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={17}/>
            <input type="text" placeholder="ابحث عن طالب..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-sm"/>
          </div>
          {/* Stage */}
          <select value={filterStage} onChange={e => { setFilterStage(e.target.value); setFilterGrade('All'); }}
            className="p-3 bg-slate-50 border border-gray-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-indigo-400">
            <option value="All">كل المراحل</option>
            {Object.keys(STAGES).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {/* Grade */}
          <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}
            disabled={filterStage === 'All'}
            className="p-3 bg-slate-50 border border-gray-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-indigo-400 disabled:opacity-40">
            <option value="All">كل الصفوف</option>
            {filterGrades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          {/* Subject */}
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
            className="p-3 bg-slate-50 border border-gray-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-indigo-400">
            <option value="All">جميع المواد</option>
            {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {/* Summary stats */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-50">
          <span className="text-xs font-bold text-gray-400">إجمالي الطلاب: <span className="text-gray-700">{filteredStudents.length}</span></span>
          <span className="text-xs font-bold text-gray-400">المواد المرصودة: <span className="text-gray-700">{displaySubjects.length}</span></span>
          <span className="text-xs font-bold text-gray-400">إجمالي التصحيحات: <span className="text-gray-700">{results.length}</span></span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right" dir="rtl">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-100">
                <th className="px-5 py-4 text-xs font-black text-gray-500 uppercase tracking-wider sticky right-0 bg-slate-50 min-w-[220px]">الطالب</th>
                <th className="px-4 py-4 text-xs font-black text-gray-500 uppercase tracking-wider min-w-[120px]">الصف</th>
                {displaySubjects.map(sub => (
                  <th key={sub} className="px-4 py-4 text-xs font-black text-gray-500 uppercase tracking-wider min-w-[130px]">
                    <div className="flex items-center gap-1.5 justify-center">
                      <BookOpen size={12} className="text-indigo-400"/>
                      {sub}
                    </div>
                  </th>
                ))}
                {displaySubjects.length > 1 && (
                  <th className="px-4 py-4 text-xs font-black text-gray-500 uppercase tracking-wider min-w-[110px]">
                    <div className="flex items-center gap-1.5 justify-center">
                      <BarChart2 size={12} className="text-violet-400"/> متوسط
                    </div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredStudents.map(s => {
                const sResults = resultIndex[s.id] || {};
                const subjectScores = displaySubjects.map(sub => sResults[sub] || null);
                const graded = subjectScores.filter(Boolean);
                const avgPct = graded.length > 0
                  ? (graded.reduce((sum, r) => sum + parseFloat(r.percentage), 0) / graded.length).toFixed(1)
                  : null;

                return (
                  <tr key={s.id} className="hover:bg-indigo-50/20 transition-colors">
                    {/* Student name */}
                    <td className="px-5 py-4 sticky right-0 bg-white hover:bg-indigo-50/20">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                          <User size={16}/>
                        </div>
                        <div>
                          <div className="font-bold text-gray-800 text-sm">{s.name}</div>
                          <div className="text-xs text-gray-400 font-mono">{s.id}</div>
                        </div>
                      </div>
                    </td>
                    {/* Grade/Class */}
                    <td className="px-4 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-600">
                        {s.grade || s.classroom || '-'}
                      </span>
                    </td>
                    {/* Subject scores */}
                    {subjectScores.map((res, i) => (
                      <td key={i} className="px-4 py-4 text-center">
                        {res ? (
                          <div>
                            <div className={`text-base font-black ${parseFloat(res.percentage) >= 50 ? 'text-indigo-700' : 'text-red-500'}`}>
                              {res.score}/{res.total}
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1 mx-auto max-w-[60px]">
                              <div className={`h-full rounded-full ${parseFloat(res.percentage) >= 50 ? 'bg-green-400' : 'bg-red-400'}`}
                                style={{ width: `${res.percentage}%` }}/>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">{res.percentage}%</div>
                          </div>
                        ) : (
                          <span className="text-gray-200 text-xs font-bold">—</span>
                        )}
                      </td>
                    ))}
                    {/* Average */}
                    {displaySubjects.length > 1 && (
                      <td className="px-4 py-4 text-center">
                        {avgPct !== null ? (
                          <div className={`text-base font-black ${parseFloat(avgPct) >= 50 ? 'text-violet-600' : 'text-red-500'}`}>
                            {avgPct}%
                          </div>
                        ) : <span className="text-gray-200 text-xs">—</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredStudents.length === 0 && !loading && (
            <div className="py-24 flex flex-col items-center justify-center text-gray-300">
              <Search size={48} className="opacity-10 mb-4"/>
              <p className="font-bold">لا يوجد طلاب مطابقون</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Export Modal ── */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">تصدير التقرير (PDF)</h3>
                <p className="text-indigo-100 text-xs mt-0.5">أدخل بيانات الجدول للطباعة</p>
              </div>
              <button onClick={() => setShowExportModal(false)} className="p-2 hover:bg-white/10 rounded-xl"><X size={22}/></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1">
                  <Calendar size={12}/> تاريخ الاختبار
                </label>
                <input type="text" value={exportDate} onChange={e => setExportDate(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl font-bold text-sm text-right" placeholder="15 / 09 / 1446"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1">
                  <Clock size={12}/> اليوم
                </label>
                <input type="text" value={exportDay} onChange={e => setExportDay(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl font-bold text-sm text-right" placeholder="الأحد"/>
              </div>
              
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
                  * سيتم توليد التقرير بناءً على التصفية الحالية: 
                  <br/>
                  المادة: <span className="text-black">{filterSubject === 'All' ? 'جميع المواد' : filterSubject}</span> | 
                  الصف: <span className="text-black">{filterGrade === 'All' ? 'جميع الصفوف' : filterGrade}</span>
                </p>
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50 flex flex-col gap-3">
              <button onClick={handleExportPDF} disabled={isExporting || isExportingStats}
                className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg
                  ${(isExporting || isExportingStats) ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'}`}>
                {isExporting ? <><Loader2 size={18} className="animate-spin"/> جاري التحميل...</> : <><FileText size={18}/> تصدير كشف الدرجات للطلاب</>}
              </button>
              
              <button onClick={handleExportStatisticsPDF} disabled={isExporting || isExportingStats || performanceStats.total === 0}
                className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all border-2
                  ${(isExporting || isExportingStats || performanceStats.total === 0) 
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600'}`}>
                {isExportingStats ? <><Loader2 size={18} className="animate-spin"/> جاري التحميل...</> : <><PieChart size={18}/> تصدير الإحصائيات والرسم البياني</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hidden Printable Report (Used by html2canvas) ── */}
      <div className="fixed left-[-9999px] top-0" style={{ zIndex: -100 }}>
        {/* Printable Statistics PDF Template */}
        {performanceStats.total > 0 && (
          <div className="printable-statistics-page bg-white p-12 text-black" style={{ width: '210mm', minHeight: '297mm', fontFamily: 'Arial, sans-serif', direction: 'rtl', backgroundColor: '#ffffff', color: '#000000' }}>
            <style dangerouslySetInnerHTML={{__html: `
              .printable-statistics-page { background-color: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .printable-statistics-page .bg-colored { background-color: #f8fafc !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            `}} />
            <div className="text-center mb-10 space-y-4 border-b-2 border-black pb-8 mt-10">
              <h1 className="text-4xl font-bold">{printSchoolName}</h1>
              <h2 className="text-3xl font-bold mt-4">تقرير تفصيلي للإحصائيات ومستويات الأداء</h2>
              <div className="mt-8 text-xl font-bold p-4 border-2 border-black inline-block rounded-xl">
                المادة: {filterSubject === 'All' ? 'جميع المواد' : filterSubject} | الصف: {filterGrade === 'All' ? 'جميع الصفوف' : filterGrade}
              </div>
            </div>
            
            <div className="mb-12 p-8 border-2 border-black rounded-3xl bg-colored mt-12">
              <h4 className="text-2xl font-black mb-10 text-center border-b-2 border-black pb-4">التمثيل البياني لمستويات الطلاب</h4>
              <div className="h-80 flex items-end justify-between gap-8 px-6">
                {[
                  { label: 'ممتاز', count: performanceStats.excellent, color: '#10b981' },
                  { label: 'جيد جداً', count: performanceStats.veryGood, color: '#3b82f6' },
                  { label: 'جيد', count: performanceStats.good, color: '#6366f1' },
                  { label: 'مقبول', count: performanceStats.pass, color: '#f59e0b' },
                  { label: 'ضعيف', count: performanceStats.weak, color: '#f43f5e' }
                ].map((l, i) => {
                  const maxVal = Math.max(performanceStats.excellent, performanceStats.veryGood, performanceStats.good, performanceStats.pass, performanceStats.weak, 1);
                  const height = Math.max((l.count / maxVal) * 100, 2); 
                  return (
                    <div key={i} className="flex-1 h-full flex flex-col justify-end items-center">
                      <div className="text-xl font-black mb-3">{l.count} طالب</div>
                      <div className="w-20 mx-auto transition-all" style={{ height: `${height}%`, backgroundColor: 'black', border: '2px solid black' }} />
                      <div className="text-xl font-black mt-4 whitespace-nowrap">{l.label}</div>
                      <div className="text-lg font-bold mt-2 text-gray-800">
                        {performanceStats.total > 0 ? ((l.count / performanceStats.total) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mt-12">
              <div className="border-2 border-black p-8 rounded-3xl text-center bg-colored flex flex-col items-center justify-center min-h-[160px]">
                <div className="text-2xl font-bold mb-4">إجمالي المختبرين</div>
                <div className="text-6xl font-black">{performanceStats.total}</div>
              </div>
              <div className="border-2 border-black p-8 rounded-3xl text-center bg-colored flex flex-col items-center justify-center min-h-[160px]">
                <div className="text-2xl font-bold mb-4">نسبة الإتقان العامة</div>
                <div className="text-6xl font-black">
                  {performanceStats.total > 0 ? (((performanceStats.excellent + performanceStats.veryGood) / performanceStats.total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>
            
            <div className="mt-20 flex justify-end px-20 text-lg font-bold">
              <div className="text-center">
                <div className="mb-4">يعتمد مدير المدرسة</div>
                <div>......................................</div>
              </div>
            </div>
          </div>
        )}

        {Array.from({ length: Math.ceil(filteredStudents.length / 18) }).map((_, pageIdx) => {
          const pageStudents = filteredStudents.slice(pageIdx * 18, (pageIdx + 1) * 18);
          const totalCorrected = filteredStudents.filter(s => {
            const sResults = resultIndex[s.id] || {};
            return filterSubject === 'All' ? Object.keys(sResults).length > 0 : !!sResults[filterSubject];
          }).length;

          return (
            <div key={pageIdx} className="printable-page bg-white p-12 text-black" 
                 style={{ 
                   width: '210mm', 
                   height: '297mm',
                   fontFamily: 'Arial, sans-serif', 
                   direction: 'rtl',
                   backgroundColor: '#ffffff',
                   color: '#000000',
                   marginBottom: '20px'
                 }}>
              
              <style dangerouslySetInnerHTML={{__html: `
                .printable-page * {
                  background-color: transparent !important;
                  color: black !important;
                  border-color: black !important;
                  box-shadow: none !important;
                }
                .printable-page {
                  background-color: white !important;
                }
                .printable-page table {
                  border-collapse: collapse !important;
                  width: 100% !important;
                }
                .printable-page th, .printable-page td {
                  border: 1px solid black !important;
                  padding: 8px !important;
                }
                .printable-page .bg-gray-100 {
                  background-color: #f3f4f6 !important;
                }
              `}} />

              {/* Header Section */}
              <div className="text-center mb-8 space-y-3">
                <h1 className="text-3xl font-bold">{printSchoolName}</h1>
                {filterSubject === 'اختبار مجمع' ? (
                  <h2 className="text-2xl font-bold border-b-2 border-black pb-2 inline-block">اختبار محاكي اختبار نافس (اختبار مجمع)</h2>
                ) : (
                  <h2 className="text-2xl font-bold border-b-2 border-black pb-2 inline-block">اختبار نهاية الدور الأول - الفصل الدراسي الثاني العام الدراسي 1447</h2>
                )}
                <div className="mt-4">
                  <h3 className="text-xl font-bold bg-gray-100 px-8 py-3 rounded-xl inline-block border-2 border-black">كشف رصد الدرجات</h3>
                </div>
              </div>

              {/* Table */}
              <table className="w-full border-collapse border-2 border-black mt-6">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border-2 border-black p-2 text-sm w-12">م</th>
                    <th className="border-2 border-black p-2 text-sm text-center">اسم الطالب</th>
                    {filterSubject === 'All' ? (
                      allSubjects.map(sub => (
                        <th key={sub} className="border-2 border-black p-2 text-xs">{sub === 'اختبار مجمع' ? 'الدرجة' : sub}</th>
                      ))
                    ) : (
                      <th className="border-2 border-black p-2 text-sm w-24">الدرجة</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pageStudents.map((s, idx) => {
                    const sResults = resultIndex[s.id] || {};
                    const globalIdx = (pageIdx * 18) + idx + 1;
                    return (
                      <tr key={s.id}>
                        <td className="border-2 border-black p-2 text-center text-sm">{globalIdx}</td>
                        <td className="border-2 border-black p-2 text-base font-bold text-center">{s.name}</td>
                        {filterSubject === 'All' ? (
                          allSubjects.map(sub => (
                            <td key={sub} className="border-2 border-black p-2 text-center text-xs">
                              {sResults[sub] ? `${sResults[sub].score}/${sResults[sub].total}` : '-'}
                            </td>
                          ))
                        ) : (
                          <td className="border-2 border-black p-2 text-center text-sm font-bold">
                            {sResults[filterSubject] ? `${sResults[filterSubject].score} / ${sResults[filterSubject].total}` : '-'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {/* Fill empty rows to maintain page layout if needed, but not required for simple reports */}
                </tbody>
              </table>

              {/* Page Numbering */}
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-400">
                صفحة {pageIdx + 1} من {Math.ceil(filteredStudents.length / 18)}
              </div>

              {/* Footer Signature Area (Only on the last page) */}
              {pageIdx === Math.ceil(filteredStudents.length / 18) - 1 && (
                <div className="mt-12 flex justify-end px-20 text-sm font-bold">
                  <div className="text-center">
                    <div className="mb-2">يعتمد مدير المدرسة</div>
                    <div>......................................</div>
                  </div>
                </div>
              )}

            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatCard = ({ label, count, total, color, icon }) => {
  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
  
  // Mapping color names to Tailwind color classes for background/border/text
  const theme = {
    emerald: { bg: 'bg-emerald-500', lightBg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', accent: 'border-emerald-500', shadow: 'shadow-emerald-100' },
    blue:    { bg: 'bg-blue-500',    lightBg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    accent: 'border-blue-500', shadow: 'shadow-blue-100' },
    indigo:  { bg: 'bg-indigo-500',  lightBg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  accent: 'border-indigo-500', shadow: 'shadow-indigo-100' },
    amber:   { bg: 'bg-amber-500',   lightBg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   accent: 'border-amber-500', shadow: 'shadow-amber-100' },
    rose:    { bg: 'bg-rose-500',    lightBg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    accent: 'border-rose-500', shadow: 'shadow-rose-100' },
  }[color] || theme.indigo;

  return (
    <div className={`bg-white p-6 rounded-[2.5rem] border ${theme.border} border-b-4 ${theme.accent} shadow-xl shadow-gray-100 transition-all duration-400 hover:scale-[1.02] hover:-translate-y-1 relative overflow-hidden group`}>
      <div className={`absolute top-0 right-0 w-24 h-24 ${theme.bg} opacity-[0.03] rounded-bl-[80px] transition-all group-hover:w-full group-hover:h-full group-hover:opacity-[0.05] group-hover:rounded-none`}/>
      
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className={`w-14 h-14 ${theme.bg} text-white rounded-2xl flex items-center justify-center shadow-lg ${theme.shadow} rotate-0 group-hover:rotate-6 transition-transform duration-300`}>
          {React.cloneElement(icon, { size: 28 })}
        </div>
        <div className="text-right">
          <span className={`block text-[11px] font-black opacity-60 uppercase tracking-widest mb-1 ${theme.text}`}>{label}</span>
          <div className="flex items-baseline justify-end gap-1">
            <span className="text-4xl font-black text-slate-800 tracking-tighter leading-none">{count}</span>
            <span className="text-xs font-bold text-slate-400">طالب</span>
          </div>
        </div>
      </div>
      
      <div className="space-y-3 relative z-10">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
          <span className="text-slate-400">نسبة التحصيل</span>
          <span className={`${theme.text}`}>{percentage}%</span>
        </div>
        <div className="w-full bg-slate-50 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-100">
          <div className={`${theme.bg} h-full rounded-full transition-all duration-1000 ease-out`} 
               style={{ width: `${percentage}%`, boxShadow: `0 0 10px ${theme.bg}44` }}/>
        </div>
      </div>
    </div>
  );
};

const PerformanceChart = ({ stats }) => {
  const levels = [
    { label: 'ممتاز', count: stats.excellent, color: 'bg-emerald-500', hoverColor: 'bg-emerald-600', textColor: 'text-emerald-700' },
    { label: 'جيد جداً', count: stats.veryGood, color: 'bg-blue-500', hoverColor: 'bg-blue-600', textColor: 'text-blue-700' },
    { label: 'جيد', count: stats.good, color: 'bg-indigo-500', hoverColor: 'bg-indigo-600', textColor: 'text-indigo-700' },
    { label: 'مقبول', count: stats.pass, color: 'bg-amber-500', hoverColor: 'bg-amber-600', textColor: 'text-amber-700' },
    { label: 'ضعيف', count: stats.weak, color: 'bg-rose-500', hoverColor: 'bg-rose-600', textColor: 'text-rose-700' }
  ];

  const maxCount = Math.max(...levels.map(l => l.count), 1);

  return (
    <div className="h-64 flex items-end justify-between gap-4 px-2">
      {levels.map((l, i) => {
        const heightPct = (l.count / maxCount) * 100;
        return (
          <div key={i} className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-help">
            {/* Tooltip on hover */}
            <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] py-1 px-2 rounded-lg font-black z-20 pointer-events-none whitespace-nowrap">
              {l.count} طالب ({stats.total > 0 ? ((l.count / stats.total) * 100).toFixed(1) : 0}%)
            </div>
            
            {/* The Bar Wrapper */}
            <div className="flex-1 w-full flex items-end relative overflow-hidden rounded-t-xl">
              <div className={`w-full ${l.color} rounded-t-xl transition-all duration-700 ease-out group-hover:${l.hoverColor} group-hover:scale-x-105 shadow-inner`}
                   style={{ height: `${Math.max(heightPct, 3)}%` }}>
                   <div className="w-full h-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"/>
              </div>
            </div>
            
            {/* Label */}
            <div className="mt-3 text-center flex flex-col justify-end h-10">
              <span className={`text-[10px] font-black ${l.textColor} tracking-tight`}>{l.label}</span>
              <span className="text-[10px] font-bold text-slate-400 mt-0.5">{l.count} طالب</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GradeRecording;
