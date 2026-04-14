import React, { useState, useEffect, useMemo } from 'react';
import { Search, Trophy, User, Users as UsersIcon, CheckCircle2, Filter, FileText, Download, TrendingUp, BookOpen, BarChart2, X, Calendar, Clock, Loader2, Trash2, AlertTriangle, Eraser, PieChart } from 'lucide-react';
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
  const [filterDate,     setFilterDate]     = useState('All');
  const [filterExamId,   setFilterExamId]   = useState('All');
  const [showOnlyTested, setShowOnlyTested] = useState(false);

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

  /* Available Dates (from results) */
  const availableDates = useMemo(() => {
    const dateMap = {}; // 'ar-EG string' -> timestamp
    results.forEach(r => {
      const ts = r.timestamp || r.scannedAt;
      if (!ts) return;
      const d = new Date(ts);
      const str = d.toLocaleDateString('ar-EG');
      if (!dateMap[str] || new Date(ts) > new Date(dateMap[str])) {
        dateMap[str] = ts;
      }
    });
    
    return Object.keys(dateMap).sort((a, b) => new Date(dateMap[b]) - new Date(dateMap[a]));
  }, [results]);

  /* Available Exams (Tests) */
  const availableExams = useMemo(() => {
    return exams.filter(e => {
      if (filterStage !== 'All' && e.stage !== filterStage) return false;
      if (filterGrade !== 'All' && e.grade !== filterGrade) return false;
      if (filterSubject !== 'All' && e.subject !== filterSubject) return false;
      return true;
    });
  }, [exams, filterStage, filterGrade, filterSubject]);

  /* Results indexed by studentId → subject → best result */
  const resultIndex = useMemo(() => {
    const idx = {}; // { studentId: { subject: result } }
    results.forEach(r => {
      // Filter by Date if selected
      if (filterDate !== 'All') {
        const rDate = new Date(r.timestamp || r.scannedAt).toLocaleDateString('ar-EG');
        if (rDate !== filterDate) return;
      }
      
      // Filter by Exam ID if selected
      if (filterExamId !== 'All' && r.examId !== filterExamId) return;

      const exam = exams.find(e => e.id === r.examId);
      const subject = exam?.subject || r.examTitle || '؟';
      
      if (!idx[r.studentId]) idx[r.studentId] = {};
      
      // If we filtered by a specific exam, we just want that result. 
      // Otherwise, keep the latest result per subject
      if (filterExamId !== 'All') {
        idx[r.studentId][subject] = r;
      } else if (!idx[r.studentId][subject] || new Date(r.timestamp) > new Date(idx[r.studentId][subject].timestamp)) {
        idx[r.studentId][subject] = r;
      }
    });
    return idx;
  }, [results, exams, filterDate, filterExamId]);

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

    if (showOnlyTested) {
      const hasResult = resultIndex[s.id] && Object.keys(resultIndex[s.id]).length > 0;
      if (!hasResult) return false;
    }
    
    const matchSearch = !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.includes(searchTerm);
    return matchSearch;
  }).sort((a, b) => a.name.localeCompare(b.name, 'ar')), [students, filterStage, filterGrade, searchTerm, showOnlyTested, resultIndex]);

  const testedCount = useMemo(() => {
    return filteredStudents.filter(s => resultIndex[s.id] && Object.keys(resultIndex[s.id]).length > 0).length;
  }, [filteredStudents, resultIndex]);

  const pendingCount = filteredStudents.length - testedCount;

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

  const handleClearGrades = async () => {
    const msg = filterSubject === 'All' 
      ? `هل أنت متأكد من مسح جميع درجات الطلاب المعروضين (${filteredStudents.length} طالب) لجميع المواد؟ لا يمكن التراجع عن هذه الخطوة.`
      : `هل أنت متأكد من مسح درجات مادة (${filterSubject}) لجميع الطلاب المعروضين (${filteredStudents.length} طالب)؟`;
    
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
    <>
      <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">

      {/* ── Top Summary Statistics ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="luxury-card p-8 bg-white border-none shadow-2xl flex items-center gap-6 group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-[100px] transition-all group-hover:w-full group-hover:h-full group-hover:rounded-none duration-700"></div>
          <div className="w-16 h-16 bg-indigo-50 rounded-2.5xl flex items-center justify-center text-indigo-600 transition-transform group-hover:rotate-12 duration-500">
            <UsersIcon size={32} />
          </div>
          <div className="relative z-10">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">إجمالي الطلاب</span>
            <span className="text-4xl font-black text-slate-900 font-header">{filteredStudents.length} <span className="text-sm font-bold text-slate-400">طالب</span></span>
          </div>
        </div>

        <div className="luxury-card p-8 bg-white border-none shadow-2xl flex items-center gap-6 group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-[100px] transition-all group-hover:w-full group-hover:h-full group-hover:rounded-none duration-700"></div>
          <div className="w-16 h-16 bg-emerald-50 rounded-2.5xl flex items-center justify-center text-emerald-600 transition-transform group-hover:rotate-12 duration-500">
            <CheckCircle2 size={32} />
          </div>
          <div className="relative z-10">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1">تم رصد درجاتهم</span>
            <span className="text-4xl font-black text-slate-900 font-header">{testedCount} <span className="text-sm font-bold text-slate-400">طالب</span></span>
          </div>
        </div>

        <div className="luxury-card p-8 bg-white border-none shadow-2xl flex items-center gap-6 group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-[100px] transition-all group-hover:w-full group-hover:h-full group-hover:rounded-none duration-700"></div>
          <div className="w-16 h-16 bg-amber-50 rounded-2.5xl flex items-center justify-center text-amber-600 transition-transform group-hover:rotate-12 duration-500">
            <Clock size={32} />
          </div>
          <div className="relative z-10">
            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-1">في انتظار الرصد</span>
            <span className="text-4xl font-black text-slate-900 font-header">{pendingCount} <span className="text-sm font-bold text-slate-400">طالب</span></span>
          </div>
        </div>
      </div>

      {/* ── Filter & Action Bar ── */}
      <div className="luxury-card p-8 border-none bg-white shadow-2xl ring-1 ring-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-6 items-center">
          <div className="relative lg:col-span-3 group">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-indigo-500" size={20}/>
            <input type="text" placeholder="ابحث باسم الطالب..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pr-12 pl-4 py-4 bg-slate-50 border-none rounded-2.5xl focus:bg-white focus:ring-4 focus:ring-indigo-50/50 font-bold text-sm transition-all shadow-inner"/>
          </div>
          <div className="lg:col-span-2">
            <select value={filterStage} onChange={e => { setFilterStage(e.target.value); setFilterGrade('All'); setFilterExamId('All'); }}
              className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-sm focus:bg-white transition-all appearance-none cursor-pointer shadow-sm">
              <option value="All">كل المراحل</option>
              {Object.keys(STAGES).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="lg:col-span-2">
            <select value={filterGrade} onChange={e => { setFilterGrade(e.target.value); setFilterExamId('All'); }}
              disabled={filterStage === 'All'}
              className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-sm focus:bg-white disabled:opacity-30 transition-all appearance-none cursor-pointer shadow-sm">
              <option value="All">كل الصفوف</option>
              {filterGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="lg:col-span-2">
            <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setFilterExamId('All'); }}
              className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-sm focus:bg-white transition-all appearance-none cursor-pointer shadow-sm">
              <option value="All">جميع المواد</option>
              {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="lg:col-span-3 flex items-center justify-end gap-3">
            <button onClick={() => setShowOnlyTested(!showOnlyTested)}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 rounded-2.5xl text-xs font-black transition-all border
                ${showOnlyTested 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-100 scale-105' 
                  : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50 hover:border-slate-200 shadow-sm'}`}>
              <Filter size={18} />
              {showOnlyTested ? 'عرض الكل' : 'المختبرين فقط'}
            </button>
            <button onClick={() => setShowStats(!showStats)}
              title="تحليل البيانات"
              className={`p-4 rounded-2.5xl transition-all border
                ${showStats 
                  ? 'bg-amber-500 text-white border-amber-500 shadow-xl shadow-amber-100 scale-105' 
                  : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50 shadow-sm'}`}>
              <PieChart size={24} />
            </button>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-50 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block px-1">ربط النتائج باختبار محدد</label>
              <select value={filterExamId} onChange={e => setFilterExamId(e.target.value)}
                className="w-full p-4 bg-indigo-50/50 border border-indigo-100 text-indigo-700 rounded-2.5xl font-black text-sm focus:ring-4 focus:ring-indigo-100 transition-all appearance-none cursor-pointer">
                <option value="All">جميع اختبارات المادة المنفذة</option>
                {availableExams.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.title} ({new Date(ex.updatedAt || ex.createdAt).toLocaleDateString('ar-EG')})</option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-4 flex items-center gap-4 pt-6 lg:pt-0">
               <button onClick={() => setShowExportModal(true)}
                className="flex-1 flex items-center justify-center gap-3 px-8 py-5 bg-slate-900 text-white rounded-2.5xl font-black hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 active:scale-95">
                <Download size={20} /> تصدير الكشوف PDF
              </button>
              <button onClick={handleExportCSV} title="تصدير Excel/CSV"
                className="p-5 bg-white text-slate-600 border border-slate-100 rounded-2.5xl hover:bg-slate-50 transition-all shadow-sm active:scale-95">
                <FileText size={24} />
              </button>
            </div>
            <div className="lg:col-span-3 flex justify-end pt-6 lg:pt-0">
               <button onClick={handleClearGrades} disabled={isZeroing || filteredStudents.length === 0}
                className="w-full lg:w-auto px-8 py-5 bg-rose-50 text-rose-600 border border-rose-100 rounded-2.5xl font-black hover:bg-rose-600 hover:text-white transition-all disabled:opacity-40 flex items-center justify-center gap-3 shadow-sm active:scale-95">
                {isZeroing ? <Loader2 size={20} className="animate-spin" /> : <Eraser size={20} />}
                تصفير الكشف
              </button>
            </div>
        </div>
      </div>

      {/* ── Intelligent Statistics ── */}
      {showStats && (
        <div className="space-y-8 animate-in slide-in-from-top-6 duration-700">
          {performanceStats.total > 0 ? (
            <>
              <div className="luxury-card p-10 bg-white border-none shadow-2xl flex flex-col xl:flex-row gap-12 items-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-violet-500"></div>
                <div className="w-full xl:w-1/2">
                  <h4 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-4 leading-tight">
                    <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><BarChart2 size={24}/></div>
                    الخارطة البيانية للأداء التحصيلي
                  </h4>
                  <PerformanceChart stats={performanceStats} />
                </div>
                <div className="w-full xl:w-1/2 space-y-8">
                  <div className="bg-slate-50/50 p-8 rounded-3xl border border-slate-100 relative group overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 -mr-16 -mt-16 rounded-full transition-transform group-hover:scale-150 duration-700"></div>
                    <h5 className="text-sm font-black text-slate-500 mb-4 flex items-center gap-3 italic relative z-10">
                      <TrendingUp size={18} className="text-indigo-400"/> رؤى ذكية (Insights)
                    </h5>
                    <p className="text-base text-slate-600 leading-relaxed font-bold relative z-10">
                      تشير البيانات إلى أن <span className="text-emerald-600 font-black">{( (performanceStats.excellent / performanceStats.total) * 100 ).toFixed(1)}%</span> من الطلاب في فئة الامتياز، 
                      بينما يحتاج <span className="text-rose-600 font-black">{( (performanceStats.weak / performanceStats.total) * 100 ).toFixed(1)}%</span> إلى خطط علاجية عاجلة.
                      <br/><br/>
                      <span className="text-xs text-slate-400 opacity-60">* تم التحليل بناءً على النتائج المرصودة حالياً.</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 flex flex-col items-center justify-center shadow-lg shadow-emerald-50/50 group transition-all hover:bg-emerald-50/30">
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 opacity-60">معدل الإتقان</span>
                        <span className="text-4xl font-black text-emerald-600 group-hover:scale-110 transition-transform">{( ((performanceStats.excellent + performanceStats.veryGood) / performanceStats.total) * 100 ).toFixed(0)}%</span>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 flex flex-col items-center justify-center shadow-lg shadow-indigo-50/50 group transition-all hover:bg-indigo-50/30">
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2 opacity-60">المتوسط العام</span>
                        <span className="text-4xl font-black text-indigo-600 group-hover:scale-110 transition-transform">
                          {( 
                            (filteredStudents.reduce((sum, s) => {
                              const r = resultIndex[s.id];
                              const scored = displaySubjects.map(sub => r?.[sub]).filter(Boolean);
                              if (scored.length === 0) return sum;
                              return sum + (scored.reduce((t, x) => t + parseFloat(x.percentage), 0) / scored.length);
                            }, 0) / performanceStats.total).toFixed(1)
                          )}<span className="text-sm">%</span>
                        </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6">
                <StatCard label="ممتاز (90-100)" count={performanceStats.excellent} total={performanceStats.total} color="emerald" icon={<Trophy size={20}/>} />
                <StatCard label="جيد جداً (80-89)" count={performanceStats.veryGood} total={performanceStats.total} color="blue" icon={<TrendingUp size={20}/>} />
                <StatCard label="جيد (65-79)" count={performanceStats.good} total={performanceStats.total} color="indigo" icon={<BookOpen size={20}/>} />
                <StatCard label="مقبول (50-64)" count={performanceStats.pass} total={performanceStats.total} color="amber" icon={<BarChart2 size={20}/>} />
                <StatCard label="ضعيف (< 50)" count={performanceStats.weak} total={performanceStats.total} color="rose" icon={<TrendingUp size={20} className="rotate-180"/>} />
              </div>
            </>
          ) : (
            <div className="luxury-card p-20 bg-white border-none flex flex-col items-center justify-center text-center shadow-2xl">
              <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-200 mb-6 shadow-inner">
                <BarChart2 size={48}/>
              </div>
              <h4 className="text-2xl font-black text-slate-400">لا تتوفر إحصائيات كافية حالياً</h4>
              <p className="text-slate-400 text-sm mt-3 max-w-md font-medium">بمجرد رصد درجات لبعض الطلاب في الصف المختار، سيتم توليد تقارير أداء ذكية تلقائياً.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Main Results Table ── */}
      <div className="luxury-card border-none bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 delay-500 duration-1000">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right border-collapse" dir="rtl">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-10 py-10 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-20">ت</th>
                <th className="px-10 py-10 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky right-0 bg-slate-50/50 z-20">سجل الطالب</th>
                <th className="px-8 py-10 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">حالة الرصد</th>
                {displaySubjects.map(sub => (
                  <th key={sub} className="px-8 py-10 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-400 border border-slate-100 mb-1">
                        <BookOpen size={18}/>
                      </div>
                      <span className="whitespace-nowrap">{sub}</span>
                    </div>
                  </th>
                ))}
                {displaySubjects.length > 1 && (
                  <th className="px-10 py-10 text-[11px] font-black text-indigo-600 uppercase tracking-widest text-center bg-indigo-50/30">المعدل النهائي</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredStudents.map((s, idx) => {
                const sResults = resultIndex[s.id] || {};
                const subjectScores = displaySubjects.map(sub => sResults[sub] || null);
                const hasAnyResult = subjectScores.some(Boolean);
                const avgPct = hasAnyResult
                  ? (subjectScores.filter(Boolean).reduce((sum, r) => sum + parseFloat(r.percentage), 0) / subjectScores.filter(Boolean).length).toFixed(1)
                  : null;

                return (
                  <tr key={s.id} className="group hover:bg-slate-50/50 transition-all duration-300">
                    <td className="px-10 py-10 text-center text-xs font-black text-slate-300 group-hover:text-indigo-400 transition-colors">
                      {idx + 1}
                    </td>
                    <td className="px-10 py-10 sticky right-0 bg-white group-hover:bg-slate-50/50 z-10 transition-colors shadow-[15px_0_30px_-15px_rgba(0,0,0,0.03)]">
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-white border border-slate-100 rounded-[2rem] flex items-center justify-center text-slate-300 shadow-sm group-hover:border-indigo-100 group-hover:text-indigo-500 group-hover:shadow-indigo-50 group-hover:rotate-6 transition-all duration-500">
                          <User size={28}/>
                        </div>
                        <div>
                          <div className="font-black text-slate-800 text-lg mb-1 leading-none tracking-tight">{s.name}</div>
                          <div className="flex items-center gap-2 mt-2">
                             <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-lg font-black tracking-widest uppercase">{s.id}</span>
                             <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                             <span className="text-[11px] text-slate-400 font-bold">{s.grade || s.classroom || ''}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-10 text-center">
                      {hasAnyResult ? (
                        <div className="flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                          <div className="px-5 py-2 bg-emerald-50 text-emerald-600 rounded-2xl text-[11px] font-black border border-emerald-100 flex items-center gap-2 shadow-sm shadow-emerald-50">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> تم الرصد بنجاح
                          </div>
                        </div>
                      ) : (
                        <div className="px-5 py-2 bg-slate-100/50 text-slate-400 rounded-2xl text-[11px] font-black border border-slate-200/50 opacity-60">
                           في انتظار الاختبار
                        </div>
                      )}
                    </td>
                    
                    {subjectScores.map((res, i) => (
                      <td key={i} className="px-8 py-10">
                        {res ? (
                          <div className="flex flex-col items-center group/score">
                            <div className={`text-2xl font-black font-header transition-all duration-500 group-hover/score:scale-110 group-hover/score:tracking-widest
                              ${parseFloat(res.percentage) >= 90 ? 'text-emerald-600' : parseFloat(res.percentage) >= 50 ? 'text-indigo-600' : 'text-rose-500'}`}>
                              {res.score}<span className="text-xs opacity-30 mx-0.5">/</span>{res.total}
                            </div>
                            <div className="w-20 bg-slate-100 rounded-full h-1.5 mt-4 overflow-hidden p-0 relative shadow-inner">
                              <div className={`h-full rounded-full transition-all duration-1000 ease-out ${parseFloat(res.percentage) >= 90 ? 'bg-emerald-500' : parseFloat(res.percentage) >= 50 ? 'bg-indigo-500' : 'bg-rose-500'}`}
                                style={{ width: `${res.percentage}%`, boxShadow: `0 0 8px ${parseFloat(res.percentage) >= 50 ? '#6366f144' : '#f43f5e44'}` }}/>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-2.5 font-black tracking-tight opacity-60">{res.percentage}%</div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center opacity-10">
                            <Eraser size={24} className="text-slate-400" />
                          </div>
                        )}
                      </td>
                    ))}
                    
                    {displaySubjects.length > 1 && (
                      <td className="px-10 py-10 text-center bg-indigo-50/5 transition-colors group-hover:bg-indigo-50/20">
                        {avgPct !== null ? (
                          <div className={`text-3xl font-black font-header ${parseFloat(avgPct) >= 90 ? 'text-emerald-600' : parseFloat(avgPct) >= 50 ? 'text-indigo-600' : 'text-rose-600'}`}>
                            {avgPct}<span className="text-sm opacity-30 mr-1">%</span>
                          </div>
                        ) : <div className="w-12 h-1.5 bg-indigo-100/30 rounded-full mx-auto shadow-inner" />}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredStudents.length === 0 && !loading && (
            <div className="py-40 flex flex-col items-center justify-center text-center">
              <div className="w-32 h-32 bg-slate-50/50 rounded-[3rem] flex items-center justify-center text-slate-100 mb-8 shadow-inner ring-1 ring-slate-100">
                <Search size={64} className="animate-pulse opacity-50"/>
              </div>
              <h3 className="text-2xl font-black text-slate-400">لم نعثر على أي نتائج</h3>
              <p className="text-slate-400 text-sm mt-3 max-w-sm font-medium leading-relaxed">
                لا توجد بيانات مطابقة لمعايير البحث الحالية. جرب تغيير الفلاتر أو إيقاف وضع "المختبرين فقط".
              </p>
            </div>
          )}
        </div>
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
    </>
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
