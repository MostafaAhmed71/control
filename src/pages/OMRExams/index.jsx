import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, Save, FileText, CheckCircle2, XCircle, Download, Users, X, Loader2, Search, CheckSquare, Square, ScanLine, Wifi, WifiOff, AlertCircle, ChevronRight, Check, Edit2 } from 'lucide-react';
import { getOmrExams, saveOmrExam, deleteOmrExam, getStudents, saveOmrResult, OMR_API_BASE } from '../../utils/dataService';

/* ── Constants ── */
const STAGES = {
  'ابتدائي': ['الأول الابتدائي','الثاني الابتدائي','الثالث الابتدائي','الرابع الابتدائي','الخامس الابتدائي','السادس الابتدائي'],
  'متوسط':  ['الأول المتوسط','الثاني المتوسط','الثالث المتوسط'],
  'ثانوي':  ['الأول الثانوي','الثاني الثانوي','الثالث الثانوي'],
};
const SUBJECTS_KEY = 'omr_subjects';
const CUSTOM_TEMPLATES_KEY = 'omr_custom_templates';
const CUSTOM_TEMPLATE_PREFIX = 'custom:';
const DEFAULT_SUBJECTS = [
  'لغة عربية','رياضيات','علوم','دراسات اجتماعية','تربية إسلامية',
  'لغة إنجليزية','حاسب آلي','تربية وطنية','تربية بدنية','تربية فنية',
];

const normalizeStage = (s = '') => {
  const v = String(s).trim();
  if (v === 'ابتدائي' || v === 'الابتدائي') return 'ابتدائي';
  if (v === 'متوسط' || v === 'المتوسط') return 'متوسط';
  if (v === 'ثانوي' || v === 'الثانوي') return 'ثانوي';
  return v;
};

const templateOptionsByStage = (stage, customTemplates = []) => {
  return [
    { value: 'nafs', label: 'قالب نافس (موحد لجميع المراحل)' },
    { value: 'custom', label: 'قالب مخصص (نسخة نافس)' },
    ...customTemplates.map(t => ({
      value: `${CUSTOM_TEMPLATE_PREFIX}${t.id}`,
      label: `📌 ${t.name}`,
    })),
  ];
};

const OMRExams = () => {
  const [exams, setExams]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [isAdding, setIsAdding]   = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [students, setStudents]   = useState([]);

  /* Filter bar */
  const [filterStage,   setFilterStage]   = useState('All');
  const [filterGrade,   setFilterGrade]   = useState('All');
  const [filterSubject, setFilterSubject] = useState('All');

  /* New exam form */
  const [newExam, setNewExam] = useState({ stage:'', grade:'', subject:'', qCount:30, template: 'nafs' });

  /* Dynamic subjects list (saved in localStorage) */
  const [subjects, setSubjects] = useState(() => {
    try {
      const saved = localStorage.getItem(SUBJECTS_KEY);
      return saved ? JSON.parse(saved) : [...DEFAULT_SUBJECTS];
    } catch { return [...DEFAULT_SUBJECTS]; }
  });
  const [showSubjectManager, setShowSubjectManager] = useState(false);
  const [newSubjectInput, setNewSubjectInput]       = useState('');

  const saveSubjects = (list) => {
    setSubjects(list);
    localStorage.setItem(SUBJECTS_KEY, JSON.stringify(list));
  };
  const handleAddSubject = () => {
    const trimmed = newSubjectInput.trim();
    if (!trimmed || subjects.includes(trimmed)) return;
    saveSubjects([...subjects, trimmed]);
    setNewSubjectInput('');
  };
  const handleDeleteSubject = (sub) => {
    if (!window.confirm(`حذف مادة "‏${sub}"؟`)) return;
    saveSubjects(subjects.filter(s => s !== sub));
  };
  const handleResetSubjects = () => {
    if (!window.confirm('إعادة تعيين قائمة المواد إلى الافتراضيء')) return;
    saveSubjects([...DEFAULT_SUBJECTS]);
  };

  /* Custom template config */
  const defaultCustomConfig = {
    school_name:     'مدارس نخبة الشمال الأهلية والعالمية',
    exam_name:       'الاختبار المحاكي لاختبار نافس 2026 (اختبار مجمع)',
    year:            'العام الدراسي ١٤٤٧ هــ',
    principal:       'مدير المدرسة : محمد نصر الدين',
    footer:          'نظام التصحيح الآلي بمدارس نخبة الشمال الأهلية والعالمية',
    show_class_row:  false,
    show_subject_row: false,
    logoDataUrl:     '',
  };
  const [customConfig, setCustomConfig] = useState({ ...defaultCustomConfig });
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [customTemplates, setCustomTemplates] = useState(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [selectedCustomTemplateId, setSelectedCustomTemplateId] = useState('');

  /* Bulk print modal */
  const [showBulkModal,      setShowBulkModal]      = useState(false);
  const [selectedBulkExam,   setSelectedBulkExam]   = useState(null);
  const [selectedClass,      setSelectedClass]       = useState('All');
  const [selectedStudentIds, setSelectedStudentIds]  = useState(new Set());
  const [studentSearch,      setStudentSearch]       = useState('');
  const [examDate,           setExamDate]            = useState(() => new Date().toLocaleDateString('ar-SA'));
  const [examDay,            setExamDay]             = useState(() => {
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return days[new Date().getDay()];
  });
  const [isGenerating,       setIsGenerating]        = useState(false);
  const [selectedTemplate,   setSelectedTemplate]    = useState('nafs');

  /* ── Scanner state ── */
  const [scannerAvailable,   setScannerAvailable]   = useState(null);
  const [scannerNames,       setScannerNames]       = useState([]);
  const [showScanModal,      setShowScanModal]      = useState(false);
  const [scanningExam,       setScanningExam]       = useState(null);
  const [isScanning,         setIsScanning]         = useState(false);
  const [scanPages,          setScanPages]          = useState(1);
  const [scanResults,        setScanResults]        = useState([]);
  const [scanErrors,         setScanErrors]         = useState([]);
  const [scanPhase,          setScanPhase]          = useState('idle');
  const [savingResults,      setSavingResults]      = useState(false);
  const [savedCount,         setSavedCount]         = useState(0);

  useEffect(() => { load(); checkScanner(); }, []);

  const load = async () => {
    setLoading(true);
    const [ed, sd] = await Promise.all([getOmrExams(), getStudents()]);
    setExams(ed); setStudents(sd); setLoading(false);
  };

  const persistCustomTemplates = (list) => {
    setCustomTemplates(list);
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(list));
  };
  const isTemplateCustom = (value) => String(value || '').startsWith(CUSTOM_TEMPLATE_PREFIX) || value === 'custom';
  const getCustomTemplateIdFromValue = (value) =>
    String(value || '').startsWith(CUSTOM_TEMPLATE_PREFIX)
      ? String(value).slice(CUSTOM_TEMPLATE_PREFIX.length)
      : '';

  const handleSaveNamedCustomTemplate = () => {
    const name = customTemplateName.trim();
    if (!name) {
      alert('اكتب اسمًا للقالب أولاً');
      return;
    }
    const now = new Date().toISOString();
    const existing = customTemplates.find(t => t.name === name);
    if (existing) {
      const updated = customTemplates.map(t =>
        t.id === existing.id ? { ...t, config: { ...customConfig }, updatedAt: now } : t
      );
      persistCustomTemplates(updated);
      setSelectedCustomTemplateId(existing.id);
      setSelectedTemplate(`${CUSTOM_TEMPLATE_PREFIX}${existing.id}`);
      alert('تم تحديث القالب بنفس الاسم');
      return;
    }
    const id = Date.now().toString();
    const next = [...customTemplates, { id, name, config: { ...customConfig }, createdAt: now, updatedAt: now }];
    persistCustomTemplates(next);
    setSelectedCustomTemplateId(id);
    setSelectedTemplate(`${CUSTOM_TEMPLATE_PREFIX}${id}`);
    alert('تم حفظ القالب بنجاح');
  };

  const handleLoadNamedCustomTemplate = (id) => {
    setSelectedCustomTemplateId(id);
    const tpl = customTemplates.find(t => t.id === id);
    if (!tpl) return;
    setCustomTemplateName(tpl.name);
    setCustomConfig({ ...defaultCustomConfig, ...(tpl.config || {}) });
  };

  const handleDeleteNamedCustomTemplate = () => {
    if (!selectedCustomTemplateId) return;
    const tpl = customTemplates.find(t => t.id === selectedCustomTemplateId);
    if (!tpl) return;
    if (!window.confirm(`حذف القالب "${tpl.name}"؟`)) return;
    const next = customTemplates.filter(t => t.id !== selectedCustomTemplateId);
    persistCustomTemplates(next);
    if (selectedTemplate === `${CUSTOM_TEMPLATE_PREFIX}${selectedCustomTemplateId}`) {
      setSelectedTemplate('custom');
    }
    setSelectedCustomTemplateId('');
  };

  const handleTemplateSelectChange = (value) => {
    setSelectedTemplate(value);
    if (!isTemplateCustom(value)) {
      setSelectedCustomTemplateId('');
      return;
    }
    const id = getCustomTemplateIdFromValue(value);
    if (id) {
      handleLoadNamedCustomTemplate(id);
    }
  };

  const openCustomEditorForCurrentTemplate = () => {
    const id = getCustomTemplateIdFromValue(selectedTemplate);
    if (id) {
      handleLoadNamedCustomTemplate(id);
    } else {
      setSelectedCustomTemplateId('');
    }
    setShowCustomEditor(true);
  };

  const handleCustomLogoChange = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('الملف المختار ليس صورة');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setCustomConfig(prev => ({ ...prev, logoDataUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomEditor = () => {
    // If editing a saved template, apply updates to that template directly.
    if (selectedCustomTemplateId) {
      const now = new Date().toISOString();
      const updated = customTemplates.map(t =>
        t.id === selectedCustomTemplateId ? { ...t, config: { ...customConfig }, updatedAt: now } : t
      );
      persistCustomTemplates(updated);
      setSelectedTemplate(`${CUSTOM_TEMPLATE_PREFIX}${selectedCustomTemplateId}`);
      setShowCustomEditor(false);
      return;
    }
    // If user typed a name, save/create it on apply.
    if (customTemplateName.trim()) {
      handleSaveNamedCustomTemplate();
    }
    setShowCustomEditor(false);
  };

  /* ── Check scanner availability ── */
  const checkScanner = async () => {
    setScannerAvailable(null);
    try {
      const res = await fetch(`${OMR_API_BASE}/scanner-status`);
      if (res.ok) {
        const data = await res.json();
        setScannerAvailable(data.available);
        setScannerNames(data.scanners || []);
      } else {
        setScannerAvailable(false);
      }
    } catch {
      setScannerAvailable(false);
    }
  };

  /* ── Filtered exam list ── */
  const visibleExams = useMemo(() => exams.filter(e => {
    if (filterStage   !== 'All' && e.stage   !== filterStage)   return false;
    if (filterGrade   !== 'All' && e.grade   !== filterGrade)   return false;
    if (filterSubject !== 'All' && e.subject !== filterSubject) return false;
    return true;
  }), [exams, filterStage, filterGrade, filterSubject]);

  const filterGrades = filterStage !== 'All' ? STAGES[filterStage] || [] : [];

  /* ── Add/Edit exam ── */
  const handleAddExam = async () => {
    const isNafsLike = newExam.template === 'nafs' || isTemplateCustom(newExam.template);
    const finalSubject = isNafsLike ? 'اختبار مجمع' : newExam.subject;
    if (!newExam.stage || !newExam.grade || !finalSubject) return;
    const title = isNafsLike ? `اختبار نافس - ${newExam.grade}` : `${finalSubject} - ${newExam.grade}`;
    
    const payload = { 
      ...newExam, 
      subject: finalSubject, 
      title, 
      updatedAt: new Date().toISOString() 
    };
    if (!newExam.id) {
      payload.createdAt = new Date().toISOString();
      payload.keys = {};
    }

    await saveOmrExam(payload);
    setIsAdding(false);
    setNewExam({ stage:'', grade:'', subject:'', qCount:30, template: 'nafs' });
    load();
  };

  const handleEditMetadata = (exam) => {
    setNewExam({ ...exam });
    setIsAdding(true);
  };

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف هذا الاختبار؟')) { await deleteOmrExam(id); load(); }
  };

  /* ── Answer keys editor ── */
  const handleKeyChange = (q, v) => setEditingExam(p => ({ ...p, keys: { ...p.keys, [q]: v } }));
  const saveKeys = async () => { await saveOmrExam(editingExam); setEditingExam(null); load(); };

  /* ── Bulk modal helpers ── */
  const selectedExamStage = normalizeStage(selectedBulkExam?.stage || '');
  const stageStudents = useMemo(() => {
    if (!selectedBulkExam) return students;
    return students.filter(s => normalizeStage(s.stage) === selectedExamStage);
  }, [students, selectedBulkExam, selectedExamStage]);

  const grades = useMemo(
    () => [...new Set(stageStudents.map(s => s.grade || s.classroom).filter(Boolean))],
    [stageStudents]
  );

  const filteredModalStudents = useMemo(() => stageStudents.filter(s => {
    const mc = selectedClass === 'All' || s.grade === selectedClass || s.classroom === selectedClass;
    const ms = !studentSearch || s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.id.includes(studentSearch);
    return mc && ms;
  }), [stageStudents, selectedClass, studentSearch]);

  const openBulkModal = (exam) => {
    setSelectedBulkExam(exam);
    setSelectedTemplate(exam.template || 'nafs');
    setSelectedClass(exam.grade || 'All');
    setStudentSearch('');
    setSelectedStudentIds(new Set());
    if (!isTemplateCustom(exam.template || 'nafs')) {
      setSelectedCustomTemplateId('');
    } else {
      const id = getCustomTemplateIdFromValue(exam.template || 'custom');
      if (id) handleLoadNamedCustomTemplate(id);
    }
    setShowBulkModal(true);
  };

  const handleClassChange = (cls) => {
    setSelectedClass(cls);
    setStudentSearch('');
    setSelectedStudentIds(new Set(
      stageStudents
        .filter(s => cls === 'All' || s.grade === cls || s.classroom === cls)
        .map(s => s.id)
    ));
  };

  const toggleStudent = (id) => setSelectedStudentIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const toggleAll = () => {
    const allSel = filteredModalStudents.every(s => selectedStudentIds.has(s.id));
    setSelectedStudentIds(prev => {
      const n = new Set(prev);
      filteredModalStudents.forEach(s => allSel ? n.delete(s.id) : n.add(s.id));
      return n;
    });
  };

  const handleBulkPrint = async () => {
    if (!selectedBulkExam || selectedStudentIds.size === 0) return;
    setIsGenerating(true);
    const target = stageStudents.filter(s => selectedStudentIds.has(s.id));
    try {
      let url, body;
      if (isTemplateCustom(selectedTemplate)) {
        url  = `${OMR_API_BASE}/generate-custom-batch`;
        body = JSON.stringify({
          subject: selectedBulkExam.subject || selectedBulkExam.title,
          template_config: customConfig,
          students: target.map(s => ({
            id: s.id, name: s.name,
            class_name: selectedBulkExam.grade || s.grade || s.classroom || '',
            subject: selectedBulkExam.subject || selectedBulkExam.title,
            date: examDate, day: examDay
          }))
        });
      } else {
        url  = `${OMR_API_BASE}/generate-batch`;
        body = JSON.stringify({
          subject: selectedBulkExam.subject || selectedBulkExam.title,
          template: selectedTemplate,
          num_questions: selectedBulkExam.qCount || 30,
          students: target.map(s => ({
            id: s.id, name: s.name,
            class_name: selectedBulkExam.grade || s.grade || s.classroom || '',
            subject: selectedBulkExam.subject || selectedBulkExam.title,
            date: examDate, day: examDay
          }))
        });
      }
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const a_el = document.createElement('a');
      a_el.href = URL.createObjectURL(blob);
      a_el.download = `OMR_${selectedBulkExam.title}.pdf`;
      document.body.appendChild(a_el); a_el.click(); URL.revokeObjectURL(a_el.href);
      setShowBulkModal(false);
    } catch { alert('فشل الاتصال بمحرك OMR.'); }
    finally { setIsGenerating(false); }
  };

  const allFilteredSel = filteredModalStudents.length > 0 && filteredModalStudents.every(s => selectedStudentIds.has(s.id));

  /* ── Scanner modal ── */
  const openScanModal = (exam) => {
    setScanningExam(exam);
    setScanPages(1);
    setScanResults([]);
    setScanErrors([]);
    setScanPhase('idle');
    setSavedCount(0);
    setShowScanModal(true);
  };

  const gradeResult = useCallback((result, exam) => {
    const keys = exam.keys || {};
    const qCount = exam.qCount || 30;
    let correct = 0;
    for (let q = 1; q <= qCount; q++) {
      const k = keys[String(q)];
      const a = result.answers?.[String(q)];
      if (k && a && k === a) correct++;
    }
    const keysFilled = Object.keys(keys).length;
    const score = keysFilled > 0 ? Math.round((correct / keysFilled) * 100) : null;
    return { correct, total: keysFilled, score };
  }, []);

  const matchStudent = useCallback((student_id) => {
    if (!student_id) return null;
    return students.find(s => s.id === student_id || s.national_id === student_id) || null;
  }, [students]);

  const handleStartScan = async () => {
    if (!scanningExam) return;
    setIsScanning(true);
    setScanPhase('scanning');
    setScanResults([]);
    setScanErrors([]);
    try {
      const res = await fetch(
        `${OMR_API_BASE}/scan-from-scanner?template=${scanningExam.template || 'default'}&pages=${scanPages}&num_questions=${scanningExam.qCount || 30}`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'خطأ غير معروف' }));
        throw new Error(err.detail || 'فشل المسح');
      }
      const data = await res.json();
      const enriched = (data.results || []).map(r => {
        const grading = gradeResult(r, scanningExam);
        const matched = matchStudent(r.student_id);
        return { ...r, ...grading, matched_student: matched };
      });
      setScanResults(enriched);
      setScanErrors(data.errors || []);
      setScanPhase('results');
    } catch (e) {
      setScanErrors([e.message || 'فشل الاتصال بالسكانر']);
      setScanPhase('results');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveAllResults = async () => {
    setSavingResults(true);
    let saved = 0;
    for (const r of scanResults) {
      try {
        await saveOmrResult({
          examId:      scanningExam.id,
          examTitle:   scanningExam.title,
          studentId:   r.student_id || r.matched_student?.id || '',
          studentName: r.matched_student?.name || 'غير محدد',
          answers:     r.answers,
          score:       r.score,
          correct:     r.correct,
          total:       r.total,
          grade:       r.matched_student?.grade || r.matched_student?.classroom || '',
          scannedAt:   new Date().toISOString(),
        });
        saved++;
      } catch { /* skip */ }
    }
    setSavedCount(saved);
    setSavingResults(false);
  };

  const scoreColor = (score) => {
    if (score === null || score === undefined) return 'text-gray-400';
    if (score >= 90) return 'text-emerald-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };
  const scoreBg = (score) => {
    if (score === null || score === undefined) return 'bg-gray-50 border-gray-100';
    if (score >= 90) return 'bg-emerald-50 border-emerald-100';
    if (score >= 75) return 'bg-blue-50 border-blue-100';
    if (score >= 60) return 'bg-amber-50 border-amber-100';
    return 'bg-red-50 border-red-100';
  };

  /* ── UI ── */
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4">

      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-black text-gray-900">إدارة الاختبارات (OMR)</h1>
          <p className="text-gray-400 mt-1 font-medium text-sm">اختبار مستقل لكل صف ومادة</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Scanner status badge */}
          <div
            onClick={checkScanner}
            title="اضغط للتحديث"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all border select-none
              ${scannerAvailable === null ? 'bg-gray-50 border-gray-200 text-gray-400 animate-pulse' :
                scannerAvailable ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' :
                'bg-red-50 border-red-100 text-red-500 hover:bg-red-100'}`}>
            {scannerAvailable === null ? <Loader2 size={13} className="animate-spin"/> :
             scannerAvailable ? <Wifi size={13}/> : <WifiOff size={13}/>}
            {scannerAvailable === null ? 'جاري الفحص...' :
             scannerAvailable ? `سكانر متصل${scannerNames[0] ? ` · ${scannerNames[0]}` : ''}` : 'لا يوجد سكانر'}
          </div>
          <button onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
            <Plus size={20} /> اختبار جديد
          </button>
        </div>
      </div>

      {/* Add exam form */}
      {isAdding && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-indigo-100 animate-in zoom-in-95">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            {newExam.id ? <Edit2 size={20} className="text-indigo-500" /> : <Plus size={20} className="text-indigo-500" />}
            {newExam.id ? 'تعديل بيانات الاختبار' : 'إنشاء اختبار جديد'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">المرحلة الدراسية</label>
              <select value={newExam.stage}
                onChange={e => {
                  const stage = e.target.value;
                  const opts = templateOptionsByStage(stage, customTemplates);
                  const forcedTemplate = opts[0]?.value || 'default';
                  setNewExam({ ...newExam, stage, grade: '', template: forcedTemplate });
                }}
                className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-sm">
                <option value="">اختر المرحلة</option>
                {Object.keys(STAGES).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">الصف الدراسي</label>
              <select value={newExam.grade}
                onChange={e => setNewExam({ ...newExam, grade: e.target.value })}
                disabled={!newExam.stage}
                className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-sm disabled:opacity-40">
                <option value="">اختر الصف</option>
                {(STAGES[newExam.stage] || []).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            {newExam.template !== 'nafs' && newExam.template !== 'custom' && (
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">المادة</label>
                <select value={newExam.subject}
                  onChange={e => setNewExam({ ...newExam, subject: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-sm">
                  <option value="">اختر المادة</option>
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">قالب التصميم</label>
                <select value={newExam.template}
                onChange={e => setNewExam({ ...newExam, template: e.target.value })}
                className="w-full p-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-sm">
                {templateOptionsByStage(newExam.stage, customTemplates).map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">عدد الأسئلة</label>
              <input type="number" value={newExam.qCount}
                onChange={e => setNewExam({ ...newExam, qCount: parseInt(e.target.value) || 30 })}
                className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-sm" />
            </div>
          </div>
          {newExam.stage && newExam.grade && (newExam.subject || newExam.template === 'nafs' || isTemplateCustom(newExam.template)) && (
            <div className="mt-4 p-3 bg-indigo-50 rounded-xl text-sm text-indigo-700 font-bold">
              سيُحفظ باسم: {newExam.template === 'nafs' ? `اختبار نافس - ${newExam.grade}` : `${newExam.subject} - ${newExam.grade}`}
            </div>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setIsAdding(false)} className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors">إلغاء</button>
            <button onClick={handleAddExam}
              disabled={!newExam.stage || !newExam.grade || (newExam.template !== 'nafs' && newExam.template !== 'custom' && !newExam.subject)}
              className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {newExam.id ? 'تحديث الاختبار' : 'حفظ الاختبار'}
            </button>
          </div>
        </div>
      )}

      {/* Answer keys editor */}
      {editingExam ? (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-indigo-200 animate-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-2xl font-black text-indigo-900">{editingExam.title}</h2>
              <p className="text-xs text-gray-400 mt-1">{editingExam.stage} · {editingExam.grade} · {editingExam.subject}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingExam(null)} className="px-5 py-2 text-gray-500 font-bold">إلغاء</button>
              <button onClick={saveKeys} className="flex items-center gap-2 px-7 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-md shadow-green-100">
                <Save size={17} /> حفظ
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
            {Array.from({ length: editingExam.qCount }).map((_, i) => {
              const q = (i+1).toString();
              const isElite = editingExam.template === 'elite';
              return (
                <div key={q} className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-[11px] font-black text-indigo-400 mb-2 text-center">س{q}</div>
                  <div className="flex gap-1 justify-center">
                    {['A','B','C','D'].map(o => (
                      <button key={o} onClick={() => handleKeyChange(q, o)}
                        className={`w-8 h-8 rounded-lg text-xs font-black transition-all
                          ${editingExam.keys[q] === o ? 'bg-indigo-600 text-white scale-110 shadow-md' : 'bg-white text-gray-400 border border-gray-100 hover:bg-indigo-50'}`}>
                        {isElite ? (o === 'A' ? 'أ' : o === 'B' ? 'ب' : o === 'C' ? 'ج' : 'د') : o}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Filter bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap gap-3 items-center">
            <span className="text-xs font-black text-gray-400 uppercase tracking-wider">تصفية:</span>
            <select value={filterStage} onChange={e => { setFilterStage(e.target.value); setFilterGrade('All'); }}
              className="p-2.5 bg-slate-50 border border-gray-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-400">
              <option value="All">كل المراحل</option>
              {Object.keys(STAGES).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}
              disabled={filterStage === 'All'}
              className="p-2.5 bg-slate-50 border border-gray-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-400 disabled:opacity-40">
              <option value="All">كل الصفوف</option>
              {filterGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
              className="p-2.5 bg-slate-50 border border-gray-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-400">
              <option value="All">كل المواد</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={() => setShowSubjectManager(true)}
              title="إدارة المواد"
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors whitespace-nowrap">
              <Plus size={13}/> إدارة المواد
            </button>
            {(filterStage !== 'All' || filterGrade !== 'All' || filterSubject !== 'All') && (
              <button onClick={() => { setFilterStage('All'); setFilterGrade('All'); setFilterSubject('All'); }}
                className="text-xs text-red-400 hover:text-red-600 font-bold px-2 py-1 hover:bg-red-50 rounded-lg transition-colors">
                مسح التصفية ×
              </button>
            )}
            <span className="mr-auto text-xs text-gray-400 font-bold">{visibleExams.length} اختبار</span>
          </div>

          {/* Exam cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibleExams.map(exam => (
              <div key={exam.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:border-indigo-200 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-r-3xl" />
                <div className="flex justify-between items-start mb-3">
                  <div className="w-11 h-11 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center">
                    <FileText size={22} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditMetadata(exam)}
                      className="p-2 text-indigo-400 hover:text-white hover:bg-indigo-500 rounded-xl transition-all border border-indigo-50 hover:border-indigo-500">
                      <Edit2 size={17} />
                    </button>
                    <button onClick={() => handleDelete(exam.id)}
                      className="p-2 text-red-300 hover:text-white hover:bg-red-500 rounded-xl transition-all border border-red-50 hover:border-red-500">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {exam.stage && <span className="px-2 py-0.5 bg-violet-50 text-violet-600 text-[11px] font-bold rounded-lg">{exam.stage}</span>}
                  {exam.grade && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[11px] font-bold rounded-lg">{exam.grade}</span>}
                  {exam.subject && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[11px] font-bold rounded-lg">{exam.subject}</span>}
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-1 truncate">{exam.title}</h3>
                <p className="text-xs text-gray-400 mb-5">{exam.qCount} سؤالاً</p>
                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <div>
                    {Object.keys(exam.keys||{}).length === exam.qCount
                      ? <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg"><CheckCircle2 size={11}/> مكتمل</span>
                      : <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg"><XCircle size={11}/> نموذج ناقص</span>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <button onClick={() => setEditingExam({ ...exam })} className="text-xs font-bold text-indigo-500 hover:underline">تعديل نموذج الإجابة</button>
                    <div className="flex gap-1.5">
                      <button onClick={() => openBulkModal(exam)}
                        className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 border border-indigo-100 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors">
                        <Users size={11}/> طباعة الأوراق
                      </button>
                      {/* ── Scanner button ── */}
                      <button
                        onClick={() => scannerAvailable && openScanModal(exam)}
                        title={scannerAvailable ? 'مسح أوراق الإجابة بالسكانر' : 'لا يوجد سكانر متصل'}
                        className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg transition-all border
                          ${scannerAvailable
                            ? 'text-teal-600 border-teal-100 hover:bg-teal-50 cursor-pointer'
                            : 'text-gray-300 border-gray-100 cursor-not-allowed'}`}>
                        <ScanLine size={11}/> مسح بالسكانر
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {visibleExams.length === 0 && !loading && (
              <div className="col-span-full py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300">
                <FileText size={48} className="mb-4 opacity-20"/>
                <p className="font-bold">لا يوجد اختبارات</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Bulk Print Modal ── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 border border-white/40">
            <div className="p-6 bg-gradient-to-l from-indigo-700 to-violet-600 text-white flex justify-between items-center shrink-0 rounded-t-3xl">
              <div>
                <h3 className="text-xl font-bold">طباعة أوراق الطلاب</h3>
                <p className="text-indigo-100 text-xs mt-0.5">{selectedBulkExam?.title}</p>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="p-2 hover:bg-white/10 rounded-xl border border-white/10"><X size={22}/></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1 bg-gradient-to-b from-slate-50/70 to-white">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white border border-gray-100 rounded-2xl p-3">
                  <div className="text-[11px] font-black text-gray-400 mb-1">إجمالي طلاب المرحلة/الصف</div>
                  <div className="text-lg font-black text-gray-800">{filteredModalStudents.length}</div>
                </div>
                <div className="bg-white border border-indigo-100 rounded-2xl p-3">
                  <div className="text-[11px] font-black text-indigo-400 mb-1">المحدد للطباعة</div>
                  <div className="text-lg font-black text-indigo-700">{selectedStudentIds.size}</div>
                </div>
                <div className="bg-white border border-emerald-100 rounded-2xl p-3">
                  <div className="text-[11px] font-black text-emerald-400 mb-1">القالب الحالي</div>
                  <div className="text-sm font-black text-emerald-700 truncate">
                    {(() => {
                      if (selectedTemplate === 'nafs') return 'قالب نافس';
                      const id = getCustomTemplateIdFromValue(selectedTemplate);
                      if (!id) return 'قالب مخصص';
                      const tpl = customTemplates.find(t => t.id === id);
                      return tpl?.name || 'قالب مخصص محفوظ';
                    })()}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="bg-white border border-gray-100 rounded-2xl p-3">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">تصفية حسب الصف</label>
                  <select value={selectedClass} onChange={e => handleClassChange(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-gray-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none">
                    <option value="All">جميع الطلاب</option>
                    {grades.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="bg-white border border-indigo-100 rounded-2xl p-3">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">قالب التصميم</label>
                  <select value={selectedTemplate} onChange={e => handleTemplateSelectChange(e.target.value)}
                    className="w-full p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none">
                    {templateOptionsByStage(selectedBulkExam?.stage, customTemplates).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {isTemplateCustom(selectedTemplate) && (
                    <button
                      onClick={openCustomEditorForCurrentTemplate}
                      className="mt-2 w-full py-2 text-xs font-bold text-indigo-600 border border-indigo-200 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">
                      ✏️ تعديل القالب الحالي
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="bg-white border border-gray-100 rounded-2xl p-3">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">تاريخ الاختبار</label>
                  <div className="relative">
                    <input type="text" value={examDate} onChange={e => setExamDate(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-gray-200 rounded-xl font-bold text-sm text-right focus:ring-2 focus:ring-indigo-300 focus:outline-none" placeholder="مثلاً: 15 / 09 / 1446"/>
                    <input type="date"
                      title="اختر التاريخ من التقويم"
                      className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 cursor-pointer w-6 h-6 z-10"
                      onChange={e => {
                        if (!e.target.value) return;
                        const d = new Date(e.target.value);
                        if (!isNaN(d.getTime())) {
                            const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                            setExamDay(days[d.getDay()]);
                            setExamDate(d.toLocaleDateString('ar-SA'));
                        }
                      }}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-3">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">اليوم</label>
                  <input type="text" value={examDay} onChange={e => setExamDay(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-gray-200 rounded-xl font-bold text-sm text-right focus:ring-2 focus:ring-indigo-300 focus:outline-none" placeholder="مثلاً: الأحد"/>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-3">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={15}/>
                  <input type="text" value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                    placeholder="ابحث عن طالب..." className="w-full pr-9 pl-4 py-2.5 bg-slate-50 border border-gray-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none"/>
                </div>
                <button onClick={toggleAll}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm border transition-all
                    ${allFilteredSel ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-200'}`}>
                  {allFilteredSel ? <CheckSquare size={15}/> : <Square size={15}/>}
                  {allFilteredSel ? 'إلغاء الكل' : 'تحديد الكل'}
                </button>
              </div>
              <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white">
                <div className="bg-slate-50 px-4 py-2 flex justify-between border-b border-gray-100">
                  <span className="text-xs font-black text-gray-400">الطلاب ({filteredModalStudents.length})</span>
                  <span className="text-xs font-bold text-indigo-600">{selectedStudentIds.size} محدد</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                  {filteredModalStudents.length === 0
                    ? <div className="py-10 text-center text-gray-400 text-sm">لا يوجد طلاب</div>
                    : filteredModalStudents.map(s => {
                      const sel = selectedStudentIds.has(s.id);
                      return (
                        <button key={s.id} onClick={() => toggleStudent(s.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-right transition-colors ${sel ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${sel ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                            {sel && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-800 text-sm truncate">{s.name}</div>
                            <div className="text-xs text-gray-400">{s.grade || s.classroom || ''}</div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
            <div className="p-5 border-t shrink-0 bg-white">
              <button onClick={handleBulkPrint} disabled={isGenerating || selectedStudentIds.size === 0}
                className={`w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-3 transition-all shadow-lg
                  ${isGenerating || selectedStudentIds.size === 0 ? 'bg-gray-300 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 shadow-indigo-200'}`}>
                {isGenerating ? <><Loader2 size={20} className="animate-spin"/> جاري التوليد...</> : <><Download size={20}/> تحميل PDF لـ {selectedStudentIds.size} طالب</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Scanner Modal ══ */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95">

            {/* Header */}
            <div className="p-6 bg-gradient-to-l from-teal-600 to-emerald-600 text-white flex justify-between items-center shrink-0 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                  <ScanLine size={22}/>
                </div>
                <div>
                  <h3 className="text-xl font-bold">مسح أوراق الإجابة</h3>
                  <p className="text-teal-100 text-xs mt-0.5">{scanningExam?.title}</p>
                </div>
              </div>
              <button onClick={() => setShowScanModal(false)} className="p-2 hover:bg-white/10 rounded-xl"><X size={22}/></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">

              {/* ── idle: setup ── */}
              {scanPhase === 'idle' && (
                <div className="space-y-5">
                  {/* Scanner info */}
                  <div className={`p-4 rounded-2xl border flex items-center gap-3
                    ${scannerAvailable ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-100'}`}>
                    {scannerAvailable
                      ? <Wifi size={20} className="text-emerald-600 shrink-0"/>
                      : <WifiOff size={20} className="text-red-400 shrink-0"/>}
                    <div className="flex-1">
                      <p className={`font-bold text-sm ${scannerAvailable ? 'text-emerald-800' : 'text-red-500'}`}>
                        {scannerAvailable
                          ? `سكانر متصل: ${scannerNames[0] || 'جهاز مسح ضوئي'}`
                          : 'لا يوجد سكانر متصل'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {scannerAvailable
                          ? 'ضع أوراق الإجابة في السكانر ثم اضغط بدء المسح'
                          : 'تأكد من توصيل السكانر بالجهاز وتشغيله'}
                      </p>
                    </div>
                    {!scannerAvailable && (
                      <button onClick={checkScanner}
                        className="text-xs font-bold text-indigo-600 hover:underline shrink-0 px-3 py-1.5 bg-white rounded-lg border border-indigo-100">
                        إعادة الفحص
                      </button>
                    )}
                  </div>

                  {/* Pages count */}
                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">عدد الأوراق للمسح</label>
                    <div className="flex flex-wrap gap-2">
                      {[1,2,3,4,5,10,15,20,25,30].map(n => (
                        <button key={n} onClick={() => setScanPages(n)}
                          className={`w-12 h-10 rounded-xl font-bold text-sm transition-all border
                            ${scanPages === n
                              ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-100'
                              : 'bg-slate-50 text-gray-600 border-gray-200 hover:border-teal-300'}`}>
                          {n}
                        </button>
                      ))}
                      <input
                        type="number" min={1} max={200} value={scanPages}
                        onChange={e => setScanPages(Math.max(1, parseInt(e.target.value)||1))}
                        className="w-20 h-10 px-3 bg-slate-50 border border-gray-200 rounded-xl font-bold text-sm text-center focus:ring-2 focus:ring-teal-400"/>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      سيتم مسح {scanPages} {scanPages === 1 ? 'ورقة' : 'أوراق'} متتالية
                    </p>
                  </div>

                  {/* Key status */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                    {Object.keys(scanningExam?.keys||{}).length >= (scanningExam?.qCount||30)
                      ? <CheckCircle2 size={18} className="text-green-600 shrink-0"/>
                      : <AlertCircle size={18} className="text-amber-500 shrink-0"/>}
                    <div>
                      <p className="font-bold text-sm text-gray-700">
                        نموذج الإجابة: {Object.keys(scanningExam?.keys||{}).length}/{scanningExam?.qCount||30} سؤال
                      </p>
                      <p className="text-xs text-gray-400">
                        {Object.keys(scanningExam?.keys||{}).length >= (scanningExam?.qCount||30)
                          ? 'النموذج مكتمل — سيتم احتساب الدرجات تلقائياً'
                          : 'النموذج غير مكتمل — ستظهر الإجابات بدون درجات'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── scanning ── */}
              {scanPhase === 'scanning' && (
                <div className="flex flex-col items-center justify-center py-16 gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 bg-teal-50 rounded-3xl flex items-center justify-center">
                      <ScanLine size={44} className="text-teal-500 animate-pulse"/>
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-teal-600 rounded-xl flex items-center justify-center">
                      <Loader2 size={16} className="text-white animate-spin"/>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-gray-800">جاري المسح...</p>
                    <p className="text-sm text-gray-400 mt-1">يرجى الانتظار — لا تحرك الورقة</p>
                    <p className="text-xs text-gray-300 mt-0.5">{scanPages} {scanPages===1?'ورقة':'أوراق'}</p>
                  </div>
                  <div className="w-64 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full animate-pulse" style={{width:'60%'}}/>
                  </div>
                </div>
              )}

              {/* ── results ── */}
              {scanPhase === 'results' && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 bg-teal-50 border border-teal-100 rounded-2xl text-center">
                      <div className="text-2xl font-black text-teal-700">{scanResults.length}</div>
                      <div className="text-xs text-teal-600 font-bold mt-0.5">ورقة تم مسحها</div>
                    </div>
                    <div className="p-4 bg-green-50 border border-green-100 rounded-2xl text-center">
                      <div className="text-2xl font-black text-green-700">
                        {scanResults.filter(r => r.score !== null && r.score >= 60).length}
                      </div>
                      <div className="text-xs text-green-600 font-bold mt-0.5">ناجح (≥ 60%)</div>
                    </div>
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-center">
                      <div className="text-2xl font-black text-red-600">
                        {scanResults.filter(r => r.score !== null && r.score < 60).length}
                      </div>
                      <div className="text-xs text-red-500 font-bold mt-0.5">راسب (&lt; 60%)</div>
                    </div>
                  </div>

                  {/* Errors */}
                  {scanErrors.length > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                      <p className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-2">
                        <AlertCircle size={15}/> تحذيرات ({scanErrors.length})
                      </p>
                      <ul className="space-y-1">
                        {scanErrors.map((err, i) => (
                          <li key={i} className="text-xs text-amber-600">• {err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Results list */}
                  {scanResults.length > 0 ? (
                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2.5 flex justify-between border-b border-gray-100">
                        <span className="text-xs font-black text-gray-500">نتائج المسح</span>
                        <span className="text-xs text-gray-400">
                          {scanResults.filter(r => r.matched_student).length} طالب تم التعرف عليه
                        </span>
                      </div>
                      <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                        {scanResults.map((r, idx) => (
                          <div key={idx} className={`flex items-center gap-4 px-4 py-3 border-r-4 ${scoreBg(r.score)}`}>
                            <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-xs font-black text-gray-500 border border-gray-100 shrink-0">
                              {r.page}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm text-gray-800 truncate">
                                {r.matched_student?.name || (r.student_id ? `رقم QR: ${r.student_id}` : 'غير معروف')}
                              </div>
                              <div className="text-xs text-gray-400">
                                {r.matched_student?.grade || r.matched_student?.classroom || ''}
                              </div>
                            </div>
                            <div className="text-left shrink-0">
                              {r.score !== null && r.score !== undefined ? (
                                <>
                                  <div className={`text-2xl font-black ${scoreColor(r.score)}`}>{r.score}%</div>
                                  <div className="text-xs text-gray-400 text-center">{r.correct}/{r.total}</div>
                                </>
                              ) : (
                                <div className="text-sm text-gray-300 font-bold">—</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-300">
                      <ScanLine size={40} className="mx-auto mb-3 opacity-30"/>
                      <p className="font-bold text-sm">لم يتم مسح أي ورقة بنجاح</p>
                    </div>
                  )}

                  {savedCount > 0 && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-2 text-sm font-bold text-green-700">
                      <Check size={16}/> تم حفظ {savedCount} نتيجة بنجاح
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t shrink-0 flex gap-3">
              {scanPhase === 'idle' && (
                <>
                  <button onClick={() => setShowScanModal(false)}
                    className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors">
                    إلغاء
                  </button>
                  <button onClick={handleStartScan}
                    disabled={!scannerAvailable || isScanning}
                    className={`flex-1 py-3 rounded-2xl font-bold text-white flex items-center justify-center gap-3 transition-all shadow-lg
                      ${!scannerAvailable || isScanning
                        ? 'bg-gray-300 cursor-not-allowed shadow-none'
                        : 'bg-teal-600 hover:bg-teal-700 hover:-translate-y-0.5 shadow-teal-200'}`}>
                    <ScanLine size={20}/>
                    بدء المسح &nbsp;({scanPages} {scanPages===1?'ورقة':'أوراق'})
                  </button>
                </>
              )}

              {scanPhase === 'results' && (
                <>
                  <button onClick={() => setScanPhase('idle')}
                    className="px-5 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors flex items-center gap-2">
                    <ChevronRight size={16}/> مسح جديد
                  </button>
                  {scanResults.length > 0 && savedCount === 0 && (
                    <button onClick={handleSaveAllResults} disabled={savingResults}
                      className={`flex-1 py-3 rounded-2xl font-bold text-white flex items-center justify-center gap-3 transition-all
                        ${savingResults ? 'bg-gray-300' : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100'}`}>
                      {savingResults
                        ? <><Loader2 size={18} className="animate-spin"/> جاري الحفظ...</>
                        : <><Save size={18}/> حفظ النتائج ({scanResults.length})</>}
                    </button>
                  )}
                  {savedCount > 0 && (
                    <button onClick={() => setShowScanModal(false)}
                      className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-colors">
                      إغلاق
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Custom Template Editor Modal ══ */}
      {showCustomEditor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl animate-in zoom-in-95 overflow-hidden">
            {/* Header */}
            <div className="p-5 bg-gradient-to-l from-indigo-700 to-violet-600 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">✏️ تخصيص نصوص القالب</h3>
                <p className="text-indigo-200 text-xs mt-0.5">نسخة مبنية على قالب نافس — عدّل ما تريد فقط</p>
              </div>
              <button onClick={() => setShowCustomEditor(false)} className="p-2 hover:bg-white/10 rounded-xl">
                <X size={20}/>
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Text Fields */}
              {[
                { key: 'school_name',  label: 'اسم المدرسة (السطر الأول)',   placeholder: 'مدارس نخبة الشمال الأهلية والعالمية' },
                { key: 'exam_name',    label: 'اسم الاختبار (السطر الثاني)', placeholder: 'الاختبار المحاكي لاختبار نافس 2026' },
                { key: 'year',         label: 'العام الدراسي (السطر الثالث)',placeholder: 'العام الدراسي ١٤٤٧ هــ' },
                { key: 'principal',    label: 'اسم المدير (أسفل يسار)',       placeholder: 'مدير المدرسة : محمد نصر الدين' },
                { key: 'footer',       label: 'نص التذييل (أسفل وسط)',        placeholder: 'نظام التصحيح الآلي...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">{label}</label>
                  <input
                    type="text"
                    value={customConfig[key]}
                    onChange={e => setCustomConfig(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-sm font-bold text-right focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    dir="rtl"
                  />
                </div>
              ))}

              {/* Toggle options */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-gray-100">
                <p className="text-xs font-black text-gray-500 uppercase tracking-wider">حقول إضافية</p>
                {[
                  { key: 'show_class_row',   label: 'إظهار حقل الصف' },
                  { key: 'show_subject_row', label: 'إظهار حقل المادة' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer group">
                    <div
                      onClick={() => setCustomConfig(p => ({ ...p, [key]: !p[key] }))}
                      className={`w-11 h-6 rounded-full transition-all flex items-center px-0.5 ${customConfig[key] ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${customConfig[key] ? 'translate-x-5' : 'translate-x-0'}`}/>
                    </div>
                    <span className="text-sm font-bold text-gray-700">{label}</span>
                  </label>
                ))}
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-gray-100">
                <p className="text-xs font-black text-gray-500 uppercase tracking-wider">الشعار</p>
                <div className="flex items-center gap-3">
                  <label className="px-4 py-2.5 text-xs font-bold text-indigo-700 border border-indigo-200 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer">
                    رفع شعار
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => handleCustomLogoChange(e.target.files?.[0])}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setCustomConfig(p => ({ ...p, logoDataUrl: '' }))}
                    disabled={!customConfig.logoDataUrl}
                    className="px-4 py-2.5 text-xs font-bold text-red-700 border border-red-200 bg-red-50 rounded-xl hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    حذف الشعار
                  </button>
                </div>
                {customConfig.logoDataUrl ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-2 w-fit">
                    <img src={customConfig.logoDataUrl} alt="شعار القالب" className="h-16 object-contain" />
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">لم يتم اختيار شعار مخصص، سيتم استخدام الشعار الافتراضي.</p>
                )}
              </div>

              <div className="bg-indigo-50/60 rounded-2xl p-4 space-y-3 border border-indigo-100">
                <p className="text-xs font-black text-indigo-700">💾 حفظ القالب باسم</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTemplateName}
                    onChange={e => setCustomTemplateName(e.target.value)}
                    placeholder="اسم القالب (مثال: نافس - الصف الرابع)"
                    className="flex-1 p-3 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-right"
                    dir="rtl"
                  />
                  <button
                    type="button"
                    onClick={handleSaveNamedCustomTemplate}
                    className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
                  >
                    حفظ
                  </button>
                </div>
                <div className="flex gap-2">
                  <select
                    value={selectedCustomTemplateId}
                    onChange={e => handleLoadNamedCustomTemplate(e.target.value)}
                    className="flex-1 p-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-bold"
                  >
                    <option value="">اختر قالبًا محفوظًا...</option>
                    {customTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleDeleteNamedCustomTemplate}
                    disabled={!selectedCustomTemplateId}
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded-xl text-xs font-bold"
                  >
                    حذف
                  </button>
                </div>
              </div>

              {/* Reset button */}
              <button
                onClick={() => setCustomConfig({ ...defaultCustomConfig })}
                className="w-full py-2 text-xs font-bold text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                ↺ إعادة تعيين إلى القيم الافتراضية
              </button>
            </div>

            {/* Footer */}
            <div className="p-5 border-t flex gap-3">
              <button onClick={() => setShowCustomEditor(false)}
                className="px-5 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors">
                إلغاء
              </button>
              <button onClick={handleApplyCustomEditor}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100">
                ✓ حفظ وتطبيق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Subject Manager Modal ══ */}
      {showSubjectManager && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl animate-in zoom-in-95 overflow-hidden">

            {/* Header */}
            <div className="p-5 bg-gradient-to-l from-violet-700 to-indigo-600 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">📚 إدارة المواد الدراسية</h3>
                <p className="text-indigo-200 text-xs mt-0.5">{subjects.length} مادة — محفوظة تلقائياً</p>
              </div>
              <button onClick={() => setShowSubjectManager(false)} className="p-2 hover:bg-white/10 rounded-xl">
                <X size={20}/>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Add new subject */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">إضافة مادة جديدة</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubjectInput}
                    onChange={e => setNewSubjectInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddSubject()}
                    placeholder="اكتب اسم المادة ثم اضغط إضافة..."
                    dir="rtl"
                    className="flex-1 p-3 bg-slate-50 border border-gray-200 rounded-xl text-sm font-bold text-right focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                  />
                  <button
                    onClick={handleAddSubject}
                    disabled={!newSubjectInput.trim() || subjects.includes(newSubjectInput.trim())}
                    className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all flex items-center gap-1.5">
                    <Plus size={16}/> إضافة
                  </button>
                </div>
                {newSubjectInput.trim() && subjects.includes(newSubjectInput.trim()) && (
                  <p className="text-xs text-red-500 mt-1 font-bold">⚠️ هذه المادة موجودة مسبقاً</p>
                )}
              </div>

              {/* Current subjects list */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-bold text-gray-500">المواد الحالية ({subjects.length})</label>
                  <button onClick={handleResetSubjects} className="text-xs text-gray-400 hover:text-gray-600 font-bold flex items-center gap-1">
                    ↺ إعادة تعيين
                  </button>
                </div>
                <div className="border border-gray-100 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                  {subjects.length === 0 ? (
                    <div className="py-10 text-center text-gray-300 text-sm font-bold">لا توجد مواد</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {subjects.map((sub, idx) => (
                        <div key={sub} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 group transition-colors">
                          <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-500 text-xs font-black flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="flex-1 font-bold text-gray-800 text-sm">{sub}</span>
                          <button
                            onClick={() => handleDeleteSubject(sub)}
                            className="p-1.5 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                            <Trash2 size={15}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t">
              <button
                onClick={() => setShowSubjectManager(false)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100">
                ✓ تم — حفظ التغييرات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OMRExams;

