import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, FileText, CheckCircle2, XCircle, Download, Users, X, Loader2, Search, CheckSquare, Square, ScanLine, Wifi, WifiOff, AlertCircle, ChevronRight, ChevronDown, Check, Edit2, Settings, Layout, BookOpen, Clock, Calendar, Image as ImageIcon, Layers, FileStack, Printer, RefreshCw, BarChart2, Trophy, Flag, ShieldCheck, Languages } from 'lucide-react';
import { getOmrExams, saveOmrExam, deleteOmrExam, getStudents, saveOmrResult, OMR_API_BASE } from '../../utils/dataService';

/* ── Constants ── */
const STAGES = {
  'ابتدائي': ['الأول الابتدائي', 'الثاني الابتدائي', 'الثالث الابتدائي', 'الرابع الابتدائي', 'الخامس الابتدائي', 'السادس الابتدائي'],
  'متوسط': ['الأول المتوسط', 'الثاني المتوسط', 'الثالث المتوسط'],
  'ثانوي': ['الأول الثانوي', 'الثاني الثانوي', 'الثالث الثانوي'],
};
const SUBJECTS_KEY = 'omr_subjects';
const CUSTOM_TEMPLATES_KEY = 'omr_custom_templates';
const CUSTOM_TEMPLATE_PREFIX = 'custom:';
const DEFAULT_SUBJECTS = [
  { id: '1', name: 'لغة عربية', grades: ['All'] },
  { id: '2', name: 'رياضيات', grades: ['All'] },
  { id: '3', name: 'علوم', grades: ['All'] },
  { id: '4', name: 'دراسات اجتماعية', grades: ['All'] },
  { id: '5', name: 'تربية إسلامية', grades: ['All'] },
  { id: '6', name: 'لغة إنجليزية', grades: ['All'] },
  { id: '7', name: 'حاسب آلي', grades: ['All'] },
  { id: '8', name: 'تربية وطنية', grades: ['All'] },
  { id: '9', name: 'تربية بدنية', grades: ['All'] },
  { id: '10', name: 'تربية فنية', grades: ['All'] },
];

// Robust grade key extractor — works regardless of "ال" prefix or shorthand
const toGradeKey = (text = '') => {
  if (!text) return '';

  // 1. Basic normalization
  let s = String(text)
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/١/g, '1').replace(/٢/g, '2').replace(/٣/g, '3')
    .replace(/٤/g, '4').replace(/٥/g, '5').replace(/٦/g, '6')
    .replace(/٧/g, '7').replace(/٨/g, '8').replace(/٩/g, '9').replace(/٠/g, '0')
    .replace(/\s+/g, ' ').trim();

  // 2. Handle pure shorthand (1م, 2ث, 3ب etc.)
  const noSpace = s.replace(/\s/g, '');
  const shorthandMap = {
    '1م': '1متوسط', '2م': '2متوسط', '3م': '3متوسط',
    '1ث': '1ثانوي',  '2ث': '2ثانوي',  '3ث': '3ثانوي',
    '1ب': '1ابتدائي','2ب': '2ابتدائي','3ب': '3ابتدائي',
    '4ب': '4ابتدائي','5ب': '5ابتدائي','6ب': '6ابتدائي',
  };
  if (shorthandMap[noSpace]) return shorthandMap[noSpace];

  // 3. Word-level analysis — remove "ال" from the start of each word
  const words = s.split(' ').map(w => w.startsWith('ال') ? w.slice(2) : w).filter(Boolean);

  // 4. Map ordinal words → number
  const ordinalMap = {
    'اول': 1, 'اولى': 1, '1': 1,
    'ثاني': 2, 'ثانيه': 2, 'ثان': 2, '2': 2,
    'ثالث': 3, 'ثالثه': 3, '3': 3,
    'رابع': 4, 'رابعه': 4, '4': 4,
    'خامس': 5, 'خامسه': 5, '5': 5,
    'سادس': 6, 'سادسه': 6, '6': 6,
  };

  // 5. Map stage words → canonical stage name
  const stageMap = {
    'ابتدائي': 'ابتدائي', 'ابتدائيه': 'ابتدائي',
    'متوسط': 'متوسط', 'متوسطه': 'متوسط',
    'ثانوي': 'ثانوي', 'ثانويه': 'ثانوي',
  };

  let num = null;
  let stage = null;

  for (const w of words) {
    if (ordinalMap[w] !== undefined && num === null) num = ordinalMap[w];
    if (stageMap[w] && !stage) stage = stageMap[w];
  }

  // Also try numeric prefix directly in the original (for "3م"-style missed above)
  if (num === null) {
    const numMatch = noSpace.match(/^([1-6])/);
    if (numMatch) num = parseInt(numMatch[1]);
  }

  if (num !== null && stage) return `${num}${stage}`;

  // 6. Fallback: just return cleaned no-space lowercase
  return noSpace.toLowerCase();
};

const normalizeText = toGradeKey; // backward-compat alias

const isLevelMatch = (v1, v2) => {
  if (!v1 || !v2) return false;
  if (v1 === 'All' || v2 === 'All') return true;
  return toGradeKey(v1) === toGradeKey(v2);
};

const normalizeStage = (s = '') => {
  const v = normalizeText(s);
  if (v.includes('ابتدائي')) return 'ابتدائي';
  if (v.includes('متوسط')) return 'متوسط';
  if (v.includes('ثانوي')) return 'ثانوي';
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

const getSubjectIcon = (subject = '', size = 24) => {
  const s = String(subject).toLowerCase();
  if (s.includes('رياضيات')) return <BarChart2 size={size} />;
  if (s.includes('علوم')) return <Layers size={size} />;
  if (s.includes('إسلامية') || s.includes('قرآن')) return <BookOpen size={size} />;
  if (s.includes('انجليزي') || s.includes('english')) return <Languages size={size} />;
  if (s.includes('عربي') || s.includes('لغتي')) return <FileText size={size} />;
  if (s.includes('اجتماعيات') || s.includes('تاريخ')) return <Layout size={size} />;
  if (s.includes('حاسب') || s.includes('رقمي')) return <ScanLine size={size} />;
  if (s.includes('بدنية') || s.includes('رياضة')) return <Trophy size={size} />;
  if (s.includes('وطنية')) return <Flag size={size} />;
  if (s.includes('فنية')) return <ImageIcon size={size} />;
  if (s.includes('نافس') || s.includes('مجمع')) return <ShieldCheck size={size} />;
  return <BookOpen size={size} />;
};

const OMRExams = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [students, setStudents] = useState([]);
  const [activeTab, setActiveTab] = useState('exams'); // 'exams' | 'subjects'
  const [scannerAvailable, setScannerAvailable] = useState(false);

  /* Filter bar */
  const [filterStage, setFilterStage] = useState('All');
  const [filterGrade, setFilterGrade] = useState('All');
  const [filterSubject, setFilterSubject] = useState('All');

  /* New exam form */
  const [newExam, setNewExam] = useState({ stage: '', grade: '', subject: '', qCount: 30, template: 'nafs', title: '', classroom: '' });

  /* Dynamic subjects list (saved in localStorage) */
  const [subjects, setSubjects] = useState(() => {
    try {
      const saved = localStorage.getItem(SUBJECTS_KEY);
      if (!saved) return [...DEFAULT_SUBJECTS];
      const parsed = JSON.parse(saved);
      if (parsed.length > 0 && typeof parsed[0] === 'string') {
        return parsed.map((s, idx) => ({ id: `migrated-${idx}`, name: s, grades: ['All'] }));
      }
      return parsed;
    } catch { return [...DEFAULT_SUBJECTS]; }
  });
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [newSubjectGrades, setNewSubjectGrades] = useState(['All']);

  const saveSubjects = (list) => {
    setSubjects(list);
    localStorage.setItem(SUBJECTS_KEY, JSON.stringify(list));
  };
  const handleAddSubject = () => {
    const trimmed = newSubjectInput.trim();
    if (!trimmed || subjects.find(s => s.name === trimmed)) return;
    const newSub = {
      id: Date.now().toString(),
      name: trimmed,
      grades: [...newSubjectGrades]
    };
    saveSubjects([...subjects, newSub]);
    setNewSubjectInput('');
    setNewSubjectGrades(['All']);
  };
  const handleDeleteSubject = (id) => {
    const sub = subjects.find(s => s.id === id);
    if (!sub) return;
    if (!window.confirm(`حذف مادة "‏${sub.name}"؟`)) return;
    saveSubjects(subjects.filter(s => s.id !== id));
  };

  /* Custom template config */
  const defaultCustomConfig = {
    school_name: 'مدارس نخبة الشمال الأهلية والعالمية',
    exam_name: 'الأختبار المحاكي لاختبار نافس 2026 (اختبار مجمع)',
    year: 'العام الدراسي ١٤٤٧ هــ',
    principal: 'مدير المدرسة : محمد نصر الدين',
    footer: 'نظام التصحيح الآلي بمدارس نخبة الشمال الأهلية والعالمية',
    show_class_row: false,
    show_subject_row: false,
    logoDataUrl: '',
  };
  const [customConfig, setCustomConfig] = useState({ ...defaultCustomConfig });
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [customTemplates, setCustomTemplates] = useState(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [selectedCustomTemplateId, setSelectedCustomTemplateId] = useState('');

  /* Bulk print modal */
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedBulkExam, setSelectedBulkExam] = useState(null);
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [studentSearch, setStudentSearch] = useState('');
  const [modalStage, setModalStage] = useState('All');
  const [examDate, setExamDate] = useState(() => new Date().toLocaleDateString('ar-SA'));
  const [examDay, setExamDay] = useState(() => {
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return days[new Date().getDay()];
  });
  const [dateType, setDateType] = useState('gregorian'); // 'gregorian' or 'hijri'
  const [dateInputValue, setDateInputValue] = useState(() => new Date().toISOString().split('T')[0]);

  const formatDate = (dateStr, type) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (type === 'hijri') {
        return d.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return d.toLocaleDateString('ar-EG', { day: 'numeric', month: '2-digit', year: 'numeric' });
  };

  const handleDateChange = (val, type = dateType) => {
    setDateInputValue(val);
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      setExamDate(formatDate(val, type));
      const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      setExamDay(days[d.getDay()]);
    }
  };

  const handleDateTypeChange = (type) => {
    setDateType(type);
    handleDateChange(dateInputValue, type);
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [printProgress, setPrintProgress] = useState({ done: 0, total: 0, currentName: '' });
  const [printElapsed, setPrintElapsed] = useState(0);          // seconds ticking up
  const [printTotalTime, setPrintTotalTime] = useState(null);   // final duration in seconds
  const printStartRef = React.useRef(null);                     // Date.now() when print started
  const timerRef = React.useRef(null);                          // setInterval handle
  const [selectedTemplate, setSelectedTemplate] = useState('nafs');

  // Helper: format seconds → "MM:SS"
  const fmtTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

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
  const getCustomTemplateIdFromValue = (value) => String(value || '').startsWith(CUSTOM_TEMPLATE_PREFIX) ? String(value).slice(CUSTOM_TEMPLATE_PREFIX.length) : '';

  const handleSaveNamedCustomTemplate = () => {
    const name = customTemplateName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const existing = customTemplates.find(t => t.name === name);
    if (existing) {
      const updated = customTemplates.map(t => t.id === existing.id ? { ...t, config: { ...customConfig }, updatedAt: now } : t);
      persistCustomTemplates(updated);
      return;
    }
    const id = Date.now().toString();
    const next = [...customTemplates, { id, name, config: { ...customConfig }, createdAt: now, updatedAt: now }];
    persistCustomTemplates(next);
    setSelectedCustomTemplateId(id);
    setSelectedTemplate(`${CUSTOM_TEMPLATE_PREFIX}${id}`);
  };

  const handleLoadNamedCustomTemplate = (id) => {
    setSelectedCustomTemplateId(id);
    const tpl = customTemplates.find(t => t.id === id);
    if (!tpl) return;
    setCustomTemplateName(tpl.name);
    setCustomConfig({ ...defaultCustomConfig, ...(tpl.config || {}) });
  };

  const handleTemplateSelectChange = (value) => {
    setSelectedTemplate(value);
    if (!isTemplateCustom(value)) { setSelectedCustomTemplateId(''); return; }
    const id = getCustomTemplateIdFromValue(value);
    if (id) handleLoadNamedCustomTemplate(id);
  };

  const openCustomEditorForCurrentTemplate = () => {
    const id = getCustomTemplateIdFromValue(selectedTemplate);
    if (id) handleLoadNamedCustomTemplate(id);
    setShowCustomEditor(true);
  };

  const handleCustomLogoChange = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setCustomConfig(prev => ({ ...prev, logoDataUrl: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const handleApplyCustomEditor = () => {
    if (selectedCustomTemplateId) {
      const now = new Date().toISOString();
      const updated = customTemplates.map(t => t.id === selectedCustomTemplateId ? { ...t, config: { ...customConfig }, updatedAt: now } : t);
      persistCustomTemplates(updated);
    } else if (customTemplateName.trim()) {
      handleSaveNamedCustomTemplate();
    }
    setShowCustomEditor(false);
  };

  const checkScanner = async () => {
    try {
      const res = await fetch(`${OMR_API_BASE}/scanner-status`);
      if (res.ok) {
        const data = await res.json();
        setScannerAvailable(data.available);
      } else { setScannerAvailable(false); }
    } catch { setScannerAvailable(false); }
  };

  const visibleExams = useMemo(() => exams.filter(e => {
    if (filterStage !== 'All' && e.stage !== filterStage) return false;
    if (filterGrade !== 'All' && e.grade !== filterGrade) return false;
    if (filterSubject !== 'All' && e.subject !== filterSubject) return false;
    return true;
  }), [exams, filterStage, filterGrade, filterSubject]);

  const filterGrades = filterStage !== 'All' ? STAGES[filterStage] || [] : [];

  const handleAddExam = async () => {
    if (!newExam.stage || !newExam.grade || !newExam.subject) return;
    
    // Use manually entered title if provided, otherwise generate it
    const isNafs = newExam.template === 'nafs';
    const finalSubject = isNafs ? 'اختبار مجمع' : newExam.subject;
    const generatedTitle = isNafs ? `اختبار نافس - ${newExam.grade}` : `${finalSubject} - ${newExam.grade}`;
    const title = newExam.title || generatedTitle;

    const payload = { 
      ...newExam, 
      subject: finalSubject, 
      title, 
      classroom: newExam.classroom || '',
      qCount: parseInt(newExam.qCount) || 30,
      updatedAt: new Date().toISOString() 
    };

    if (!newExam.id) { 
      payload.createdAt = new Date().toISOString(); 
      payload.keys = {}; 
    }
    
    await saveOmrExam(payload);
    setIsAdding(false);
    setNewExam({ stage: '', grade: '', subject: '', qCount: 30, template: 'nafs', title: '', classroom: '' });
    load();
  };

  const openEditModal = (exam) => {
    setNewExam({ ...exam });
    setIsAdding(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الاختبار؟')) { await deleteOmrExam(id); load(); }
  };

  const handleKeyChange = (q, v) => setEditingExam(p => ({ ...p, keys: { ...(p.keys || {}), [String(q)]: v } }));
  
  const openExamKeys = (exam) => {
    const existingWeights = exam.weights || {};
    const count = parseInt(exam.qCount) || 30;
    const initialWeights = {};
    for (let i = 1; i <= count; i++) {
        // Convert existing weights to strings for the input fields
        const w = existingWeights[String(i)];
        initialWeights[String(i)] = (w !== undefined && w !== null) ? String(w) : "1";
    }
    setEditingExam({ ...exam, weights: initialWeights });
  };

  const handleWeightChange = (q, v) => {
    setEditingExam(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        weights: {
          ...(prev.weights || {}),
          [String(q)]: v
        }
      };
    });
  };

  const resetWeights = () => {
    setEditingExam(prev => {
      if (!prev) return prev;
      const newWeights = {};
      const count = parseInt(prev.qCount) || 30;
      for (let i = 1; i <= count; i++) newWeights[String(i)] = "1";
      return { ...prev, weights: newWeights };
    });
  };

  const saveKeys = async () => { 
    if (!editingExam) return;
    const finalWeights = {};
    const count = parseInt(editingExam.qCount) || 30;
    
    // Ensure all questions have a weight, defaulting to 1
    for (let i = 1; i <= count; i++) {
      const rawVal = editingExam.weights?.[String(i)];
      const parsed = parseFloat(rawVal);
      finalWeights[String(i)] = isNaN(parsed) ? 1 : parsed;
    }

    await saveOmrExam({ ...editingExam, weights: finalWeights }); 
    setEditingExam(null); 
    load(); 
  };

  const stageStudents = useMemo(() => {
    if (!selectedBulkExam) return students;
    return students.filter(s => {
      if (modalStage === 'All') return true;
      if (!s.stage) return true; // Don't hide students with missing stage data
      return isLevelMatch(s.stage, modalStage);
    });
  }, [students, selectedBulkExam, modalStage]);

  const filteredModalStudents = useMemo(() => {
    return stageStudents.filter(s => {
      // 1. Grade Match (Primary)
      const gradeMatch = !selectedBulkExam?.grade || isLevelMatch(s.grade, selectedBulkExam.grade) || isLevelMatch(s.stage, selectedBulkExam.grade);
      
      // 2. Room/Class Match (Optional Filter)
      const roomMatch = selectedClass === 'All' || 
                        isLevelMatch(s.classroom, selectedClass) || 
                        isLevelMatch(s.class, selectedClass);
      
      // 3. Search text
      const searchMatch = !studentSearch || s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.id.includes(studentSearch);
      
      return gradeMatch && roomMatch && searchMatch;
    });
  }, [stageStudents, selectedClass, studentSearch, selectedBulkExam]);

  const openBulkModal = (exam) => {
    setSelectedBulkExam(exam);
    setModalStage(normalizeStage(exam.stage || 'All'));
    // Default the class selection to the classroom specified in the exam, or 'All'
    setSelectedClass(exam.classroom || 'All');
    setSelectedStudentIds(new Set());
    setShowBulkModal(true);
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

  const allFilteredSel = filteredModalStudents.length > 0 && filteredModalStudents.every(s => selectedStudentIds.has(s.id));

  const handleBulkPrint = async () => {
    if (!selectedBulkExam || selectedStudentIds.size === 0) return;
    setIsGenerating(true);
    setPrintProgress({ done: 0, total: selectedStudentIds.size, currentName: '' });
    setPrintTotalTime(null);

    // Start stopwatch
    printStartRef.current = Date.now();
    setPrintElapsed(0);
    timerRef.current = setInterval(() => {
      setPrintElapsed(Math.floor((Date.now() - printStartRef.current) / 1000));
    }, 1000);

    const target = stageStudents.filter(s => selectedStudentIds.has(s.id));

    // Determine the effective template config for custom templates
    let effectiveCustomConfig = { ...customConfig };
    if (String(selectedTemplate).startsWith(CUSTOM_TEMPLATE_PREFIX)) {
      const id = getCustomTemplateIdFromValue(selectedTemplate);
      const tpl = customTemplates.find(t => t.id === id);
      if (tpl && tpl.config) effectiveCustomConfig = { ...defaultCustomConfig, ...tpl.config };
    }

    try {
      let url, body;
      if (isTemplateCustom(selectedTemplate)) {
        url  = `${OMR_API_BASE}/generate-custom-batch-stream`;
        body = JSON.stringify({
          subject: selectedBulkExam.subject,
          template_config: effectiveCustomConfig,
          num_questions: selectedBulkExam.qCount || 30,
          students: target.map(s => ({ id: s.id, name: s.name, class_name: selectedBulkExam.grade, date: examDate, day: examDay }))
        });
      } else {
        url  = `${OMR_API_BASE}/generate-batch-stream`;
        body = JSON.stringify({
          subject: selectedBulkExam.subject,
          template: selectedTemplate,
          num_questions: selectedBulkExam.qCount || 30,
          students: target.map(s => ({ id: s.id, name: s.name, class_name: selectedBulkExam.grade, date: examDate, day: examDay }))
        });
      }

      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Read NDJSON stream line by line
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let pdfB64 = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === 'progress') {
              setPrintProgress({ done: evt.done, total: evt.total, currentName: evt.name || '' });
            } else if (evt.type === 'done') {
              pdfB64 = evt.pdf;
            } else if (evt.type === 'error') {
              throw new Error(evt.msg);
            }
          } catch { /* ignore JSON parse errors on partial lines */ }
        }
      }

      if (pdfB64) {
        const byteChars = atob(pdfB64);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: 'application/pdf' });
        const a_el = document.createElement('a');
        a_el.href = URL.createObjectURL(blob);
        a_el.download = `OMR_${selectedBulkExam.title}.pdf`;
        a_el.click();
        // Record final elapsed time before clearing
        const finalSec = Math.floor((Date.now() - printStartRef.current) / 1000);
        setPrintTotalTime(finalSec);
      } else {
        throw new Error('لم يتم استلام ملف PDF');
      }
    } catch (err) {
      alert(`فشل توليد الملف: ${err.message || ''}`);
    } finally {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setIsGenerating(false);
      setPrintProgress({ done: 0, total: 0, currentName: '' });
      setPrintElapsed(0);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10 font-main overflow-x-hidden pt-2">
      {/* ── Main Dashboard Header ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 font-header leading-[1.1] tracking-tighter mb-4 text-right">
            نظام <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">التصحيح الذكي</span>
          </h1>
          <div className="flex items-center gap-4 text-slate-400 font-bold bg-white/50 w-fit px-5 py-2 rounded-2xl border border-slate-100/50 shadow-sm backdrop-blur-sm mr-auto lg:mr-0 ml-auto lg:flex-row-reverse">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             إدارة وتصحيح الاختبارات المؤتمتة (OMR)
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center p-2 bg-slate-100/80 backdrop-blur-md rounded-3xl border border-white shadow-xl">
            <button onClick={() => setActiveTab('exams')} className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black transition-all duration-300 ${activeTab === 'exams' ? 'bg-white text-indigo-600 shadow-lg scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
              <FileStack size={20} /> الاختبارات
            </button>
            <button onClick={() => setActiveTab('subjects')} className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black transition-all duration-300 ${activeTab === 'subjects' ? 'bg-white text-violet-600 shadow-lg scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
              <BookOpen size={18} /> المقررات
            </button>
          </div>
          <button onClick={() => { setActiveTab('exams'); setIsAdding(true); }} className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 active:scale-95">
            <Plus size={20} className="text-indigo-400" /> اختبار جديد
          </button>
        </div>
      </div>

      {activeTab === 'exams' ? (
        <>
          {/* ── Filter Bar ── */}
          <div className="luxury-card p-6 border-none bg-white shadow-2xl ring-1 ring-slate-100 flex flex-col md:flex-row gap-6 items-center justify-between mb-10 animate-in slide-in-from-bottom-4 duration-500">
            <div className="relative flex-1 w-full group">
              <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
              <input type="text" placeholder="ابحث عن اختبار معين..." className="w-full pr-14 pl-8 py-4 bg-slate-50/50 border-2 border-transparent rounded-2xl outline-none focus:bg-white focus:border-indigo-100 focus:ring-8 focus:ring-indigo-50 font-bold transition-all text-right shadow-inner" />
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              {[
                { val: filterStage, set: setFilterStage, options: ['All', ...Object.keys(STAGES)], label: 'المرحلة' },
                { val: filterGrade, set: setFilterGrade, options: ['All', ...filterGrades], label: 'الصف' },
                { val: filterSubject, set: setFilterSubject, options: ['All', ...subjects.map(s => s.name)], label: 'المادة' }
              ].map((f, i) => (
                <div key={i} className="relative group min-w-[140px]">
                  <select value={f.val} onChange={e => f.set(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50/50 border-none rounded-xl font-black text-[11px] outline-none focus:ring-4 focus:ring-indigo-50 transition-all appearance-none cursor-pointer text-slate-600">
                    <option value="All">{f.label}: الكل</option>
                    {f.options.filter(o => o !== 'All').map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-hover:text-indigo-400 transition-colors" size={14} />
                </div>
              ))}
            </div>
          </div>

          {/* ── Exam Grid ── */}
          {loading ? (
             <div className="flex flex-col items-center justify-center py-40 gap-6">
                <div className="w-20 h-20 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-slate-400 font-black">جاري التحميل...</p>
             </div>
          ) : visibleExams.length === 0 ? (
            <div className="luxury-card p-20 text-center bg-slate-50/50 border-2 border-dashed border-slate-200">
               <FileStack size={48} className="mx-auto text-slate-200 mb-4" />
               <h3 className="text-xl font-black text-slate-400">لا توجد اختبارات مسجلة</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {visibleExams.map(exam => (
                <div key={exam.id} className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-500"></div>
                  <div className="luxury-card h-full bg-white border-2 border-transparent group-hover:border-indigo-100 rounded-[2rem] shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden flex flex-col relative z-10 text-right">
                    <div className="p-6 pb-4">
                      <div className="flex justify-between items-start mb-6">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 ${exam.template === 'nafs' ? 'bg-indigo-600 text-white shadow-indigo-100' : 'bg-purple-600 text-white shadow-purple-100'}`}>
                          {getSubjectIcon(exam.subject, 24)}
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => openEditModal(exam)} className="p-2.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all active:scale-90" title="تعديل البيانات">
                            <Settings size={18} />
                          </button>
                          <button onClick={() => handleDelete(exam.id)} className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all active:scale-90" title="حذف">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2 mb-4">
                        <div className="flex flex-wrap gap-1.5 mb-2 justify-end items-center">
                          <span className="px-3 py-1 rounded-lg bg-slate-50 text-slate-500 text-[9px] font-black uppercase tracking-widest">{exam.stage}</span>
                          <span className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-widest">{exam.grade}</span>
                        </div>
                        <h3 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight line-clamp-2">{exam.title}</h3>
                      </div>
                    </div>
                    <div className="p-5 pt-0 flex gap-2.5 mt-auto">
                      <button onClick={() => openBulkModal(exam)} className="flex-1 py-3.5 bg-slate-900 text-white rounded-xl font-black text-[9px] hover:bg-black transition-all flex flex-col items-center justify-center gap-1.5"><Printer size={16} /> طباعة</button>
                      <button onClick={() => openExamKeys(exam)} className="flex-1 py-3.5 bg-white text-slate-900 border border-slate-100 rounded-xl font-black text-[9px] hover:border-indigo-100 transition-all flex flex-col items-center justify-center gap-1.5"><Edit2 size={16} /> المفتاح</button>
                      <button onClick={() => navigate(`/omr-scanner/${exam.id}`)} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-black text-[9px] hover:bg-indigo-700 transition-all flex flex-col items-center justify-center gap-1.5 shadow-xl shadow-indigo-100"><ScanLine size={16} /> تصحيح</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showBulkModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
              <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 border-none overflow-hidden relative">
                <div className="p-10 pb-8 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100"><Printer size={28} /></div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 font-header leading-tight text-right">طباعة بيانات الطلاب</h3>
                      <p className="text-slate-400 text-xs mt-1 font-bold italic truncate max-w-xs">{selectedBulkExam?.title}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowBulkModal(false)} className="p-4 bg-slate-50 text-slate-300 hover:bg-rose-50 hover:text-rose-500 rounded-2.5xl transition-all shadow-sm"><X size={24} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-10 pt-0 space-y-8 custom-scrollbar">
                   <div className="luxury-card p-8 bg-slate-50 border-none shadow-sm flex flex-col md:flex-row gap-8 items-center">
                      <div className="flex-1 w-full space-y-3">
                         <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">القالب المستخدم</label>
                         <div className="flex items-center gap-4">
                            <select value={selectedTemplate} onChange={e => handleTemplateSelectChange(e.target.value)} className="flex-1 px-8 py-5 bg-white border-none rounded-[2rem] outline-none focus:ring-4 focus:ring-indigo-100 transition-all font-black text-slate-700 text-right shadow-sm">
                              {templateOptionsByStage(selectedBulkExam?.stage, customTemplates).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {isTemplateCustom(selectedTemplate) && (
                              <button onClick={openCustomEditorForCurrentTemplate} className="p-5 bg-white text-indigo-600 border border-indigo-100 rounded-[2rem] hover:bg-indigo-50 transition-all shadow-sm"><Edit2 size={24} /></button>
                            )}
                         </div>
                      </div>
                      
                      <div className="flex-1 w-full space-y-3">
                         <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">فلترة حسب الفصل (اختياري)</label>
                         <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full px-8 py-5 bg-white border-none rounded-[2rem] outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-black text-slate-700 text-right shadow-sm">
                            <option value="All">عرض كل الطلاب بالمرحلة/الصف</option>
                            {[...new Set(stageStudents.map(s => s.classroom || s.class || s.grade).filter(Boolean))].map(room => (
                               <option key={room} value={room}>فصل: {room}</option>
                            ))}
                         </select>
                      </div>
                   </div>

                   {/* ── Exam Timing (Date/Day) ── */}
                   <div className="luxury-card p-8 bg-slate-50 border-none shadow-sm space-y-6">
                      <div className="flex items-center justify-between px-1">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm transition-all hover:scale-110 active:scale-90"><Calendar size={20} /></div>
                            <h4 className="font-black text-slate-800 text-sm">توقيت الاختبار</h4>
                         </div>
                         <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                            <button onClick={() => handleDateTypeChange('gregorian')} className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${dateType === 'gregorian' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-105' : 'text-slate-400 hover:bg-slate-50'}`}>ميلادي</button>
                            <button onClick={() => handleDateTypeChange('hijri')} className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${dateType === 'hijri' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-105' : 'text-slate-400 hover:bg-slate-50'}`}>هجري</button>
                         </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">تاريخ الاختبار</label>
                            <div className="relative group">
                               <input 
                                 type="date" 
                                 value={dateInputValue} 
                                 onChange={(e) => handleDateChange(e.target.value)}
                                 className="w-full px-6 py-4 bg-white border-2 border-transparent rounded-[2rem] outline-none focus:border-indigo-100 focus:ring-8 focus:ring-indigo-50 font-black text-slate-700 text-right shadow-sm transition-all" 
                               />
                            </div>
                         </div>
                         <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">يوم الاختبار</label>
                            <div className="relative group">
                               <input 
                                 type="text" 
                                 value={examDay} 
                                 onChange={(e) => setExamDay(e.target.value)}
                                 placeholder="مثلاً: الأحد"
                                 className="w-full px-6 py-4 bg-white border-2 border-transparent rounded-[2rem] outline-none focus:border-indigo-100 focus:ring-8 focus:ring-indigo-50 font-black text-slate-700 text-right shadow-sm transition-all" 
                               />
                            </div>
                         </div>
                      </div>
                   </div>
                   <div className="space-y-6">
                      <div className="flex items-center justify-between px-2">
                         <h4 className="text-xl font-black text-slate-800">اختيار الطلاب ({selectedStudentIds.size})</h4>
                         <button onClick={toggleAll} className="px-6 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-black hover:bg-slate-200 transition-all">{allFilteredSel ? 'إلغاء الكل' : 'تحديد الكل'}</button>
                      </div>
                      
                      {/* ── DEBUG PANEL (remove after fixing) ── */}
                      {filteredModalStudents.length === 0 && students.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm font-mono text-right space-y-2">
                          <p className="font-black text-amber-800 mb-3">🔍 تشخيص — لماذا لا يظهر الطلاب؟</p>
                          <p className="text-amber-700">الاختبار: الصف = <strong>"{selectedBulkExam?.grade}"</strong> | المرحلة = <strong>"{selectedBulkExam?.stage}"</strong></p>
                          <p className="text-amber-700">إجمالي الطلاب: <strong>{students.length}</strong> | بعد فلتر المرحلة: <strong>{stageStudents.length}</strong></p>
                          <p className="text-amber-700">نماذج من بيانات الطلاب الموجودة:</p>
                          {students.slice(0, 5).map((s, i) => (
                            <div key={i} className="bg-white rounded-xl p-2 border border-amber-100 text-xs">
                              <span className="text-slate-600">{s.name} — </span>
                              <span>grade: <strong>"{s.grade}"</strong></span> | 
                              <span> stage: <strong>"{s.stage}"</strong></span> | 
                              <span> class: <strong>"{s.class}"</strong></span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredModalStudents.map(s => (
                          <div key={s.id} onClick={() => toggleStudent(s.id)} className={`p-6 rounded-[2.5rem] border-2 cursor-pointer transition-all flex items-center justify-between group ${selectedStudentIds.has(s.id) ? 'bg-indigo-50 border-indigo-300 shadow-lg scale-[1.02]' : 'bg-white border-slate-50 hover:border-slate-100'}`}>
                             <div className="text-right"><span className="font-black text-slate-800 group-hover:text-indigo-700 transition-colors block">{s.name}</span><span className="text-[10px] text-slate-400 font-bold block mt-1">{s.id}</span></div>
                             <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${selectedStudentIds.has(s.id) ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-200'}`}>{selectedStudentIds.has(s.id) ? <Check size={20} strokeWidth={4} /> : <div className="w-2 h-2 rounded-full bg-slate-200" />}</div>
                          </div>
                        ))}
                      </div>
                   </div>
                </div>
                 <div className="p-8 border-t border-slate-50 bg-slate-50/50 flex flex-col gap-4">
                    {/* â”€â”€ Success banner after print â”€â”€ */}
                    {printTotalTime !== null && !isGenerating && (
                      <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-2xl animate-in fade-in duration-500">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                            <CheckCircle2 size={20} strokeWidth={2.5} />
                          </div>
                          <div>
                            <p className="font-black text-emerald-700 text-sm">{'\u062a\u0645\u062a \u0627\u0644\u0637\u0628\u0627\u0639\u0629 \u0628\u0646\u062c\u0627\u062d \u2714'}</p>
                            <p className="text-[10px] text-emerald-500 font-bold">{printProgress.total || selectedStudentIds.size} {'\u0648\u0631\u0642\u0629'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-emerald-500 font-bold">{'\u0627\u0633\u062a\u063a\u0631\u0642 \u0627\u0644\u062a\u0648\u0644\u064a\u062f'}</p>
                          <p className="font-black text-emerald-700 text-xl tabular-nums">{fmtTime(printTotalTime)}</p>
                        </div>
                      </div>
                    )}
                    {isGenerating ? (
                      <div className="flex flex-col gap-4 w-full animate-in fade-in duration-300">
                        {/* Top row: spinner + label + timer */}
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                              <Loader2 size={18} className="animate-spin text-indigo-600" />
                            </div>
                            <span className="font-black text-slate-700 text-sm">{'\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u0648\u0644\u064a\u062f...'}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            {/* Live stopwatch */}
                            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl">
                              <Clock size={13} className="text-slate-400" />
                              <span className="text-xs font-black text-slate-600 tabular-nums">{fmtTime(printElapsed)}</span>
                            </div>
                            {/* Percentage */}
                            <span className="text-2xl font-black text-indigo-600 tabular-nums">
                              {printProgress.total > 0 ? `${Math.round((printProgress.done / printProgress.total) * 100)}\u066a` : '0\u066a'}
                            </span>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="relative w-full h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div
                            className="absolute inset-y-0 right-0 bg-gradient-to-l from-indigo-500 via-violet-500 to-indigo-400 rounded-full transition-all duration-500 ease-out"
                            style={{ width: printProgress.total > 0 ? `${(printProgress.done / printProgress.total) * 100}%` : '0%' }}
                          >
                            <div className="absolute inset-0 bg-white/30 animate-pulse rounded-full" />
                          </div>
                        </div>
                        {/* Bottom row: current student + count */}
                        <div className="flex items-center justify-between px-1">
                          <p className="text-[11px] text-slate-400 font-bold truncate max-w-[60%] text-right" dir="rtl">
                            {printProgress.currentName ? `\u23f3 ${printProgress.currentName}` : '\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u0647\u064a\u0626\u0629...'}
                          </p>
                          <span className="text-xs font-black text-slate-500 tabular-nums">
                            {printProgress.done} / {printProgress.total} {'\u0648\u0631\u0642\u0629'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-4">
                        <button onClick={() => setShowBulkModal(false)} className="px-10 py-5 bg-white text-slate-400 rounded-2xl font-black hover:bg-slate-50 transition-all border border-slate-100">{'\u0625\u0644\u063a\u0627\u0621'}</button>
                        <button onClick={handleBulkPrint} disabled={selectedStudentIds.size === 0} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed">
                          <Printer size={22} /> {'\u0628\u062f\u0621 \u0627\u0644\u0637\u0628\u0627\u0639\u0629'} ({selectedStudentIds.size})
                        </button>
                      </div>
                    )}
                 </div>
               </div>
            </div>
          )}

          {isAdding && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
              <div className="bg-white w-full max-w-2xl rounded-[3.5rem] shadow-2xl animate-in zoom-in-95 overflow-hidden border-none flex flex-col relative">
                <div className="p-10 pb-6 flex justify-between items-center bg-indigo-600 text-white">
                   <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/30 shadow-xl"><Plus size={28} /></div>
                      <div>
                         <h3 className="text-2xl font-black font-header tracking-tight">{newExam.id ? 'تحرير الاختبار' : 'اختبار جديد'}</h3>
                         <p className="text-indigo-100 text-xs font-bold mt-1">إدخال البيانات الأساسية للاختبار</p>
                      </div>
                   </div>
                   <button onClick={() => setIsAdding(false)} className="p-3 bg-white/20 text-white hover:bg-white/40 rounded-2xl transition-all"><X size={20} /></button>
                </div>
                <div className="p-10 space-y-6">
                    <div className="space-y-6">
                      <div className="space-y-3">
                         <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">اسم الاختبار</label>
                         <input 
                            type="text" 
                            value={newExam.title} 
                            onChange={e => setNewExam({...newExam, title: e.target.value})} 
                            placeholder="سيتم التوليد تلقائياً إذا ترك فارغاً..."
                            className="w-full px-8 py-5 bg-slate-50 border-none rounded-[2rem] outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-black text-slate-700 text-right shadow-sm"
                         />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-8">
                         <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">المرحلة الدراسية</label>
                            <select value={newExam.stage} onChange={e => setNewExam({...newExam, stage: e.target.value, grade: ''})} className="w-full px-8 py-5 bg-slate-50 border-none rounded-[2rem] outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-black text-slate-700 text-right shadow-sm">
                              <option value="">اختر المرحلة...</option>
                              {Object.keys(STAGES).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                         </div>
                         <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">الصف الدراسي</label>
                            <select value={newExam.grade} onChange={e => setNewExam({...newExam, grade: e.target.value, subject: ''})} className="w-full px-8 py-5 bg-slate-50 border-none rounded-[2rem] outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-black text-slate-700 text-right shadow-sm" disabled={!newExam.stage}>
                              <option value="">اختر الصف...</option>
                              {(STAGES[newExam.stage] || []).map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                         <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">الفصل (Class / Room)</label>
                            <input 
                               type="text" 
                               value={newExam.classroom || ""} 
                               onChange={e => setNewExam({...newExam, classroom: e.target.value})} 
                               placeholder="مثلاً: أ أو 1/1"
                               className="w-full px-8 py-5 bg-slate-50 border-none rounded-[2rem] outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-black text-slate-700 text-right shadow-sm"
                            />
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-3">
                           <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">المادة الدراسية</label>
                           <select value={newExam.subject} onChange={e => setNewExam({...newExam, subject: e.target.value})} className="w-full px-8 py-5 bg-slate-50 border-none rounded-[2rem] outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-black text-slate-700 text-right shadow-sm" disabled={!newExam.grade}>
                             <option value="">اختر المادة...</option>
                             {subjects.filter(s => s.grades.includes('All') || s.grades.includes(newExam.grade)).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                           </select>
                        </div>
                        <div className="space-y-3">
                           <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">عدد الأسئلة</label>
                           <input 
                              type="number" 
                              min="1" 
                              max="100" 
                              value={newExam.qCount} 
                              onChange={e => setNewExam({...newExam, qCount: e.target.value})} 
                              className="w-full px-8 py-5 bg-slate-50 border-none rounded-[2rem] outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-black text-slate-700 text-right shadow-sm"
                           />
                        </div>
                      </div>
                    </div>
                </div>
                <div className="p-10 pt-6 border-t border-slate-50 flex gap-4 bg-slate-50/50">
                   <button onClick={() => setIsAdding(false)} className="px-10 py-4 bg-white text-slate-400 rounded-2xl font-black hover:bg-slate-50 transition-all border border-slate-100 shadow-sm">إلغاء</button>
                   <button onClick={handleAddExam} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 shadow-xl active:scale-95 transition-all">حفظ وإضافة</button>
                </div>
              </div>
            </div>
          )}

          {editingExam && (
            <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
               <div className="bg-white w-full max-w-4xl rounded-[3.5rem] shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 overflow-hidden border-none text-right">
                  <div className="p-8 pb-6 flex justify-between items-center bg-purple-600 text-white shrink-0">
                    <div className="flex items-center gap-5"><div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20"><Edit2 size={28} /></div><div><h3 className="text-2xl font-black font-header tracking-tight">إعداد مفتاح الإجابات</h3><p className="text-purple-100 text-xs font-bold mt-1">{editingExam?.title}</p></div></div>
                    <button onClick={() => setEditingExam(null)} className="p-3 bg-white/20 text-white hover:bg-white/40 rounded-2xl transition-all"><X size={20} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-10 custom-scrollbar grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Array.from({ length: editingExam.qCount || 30 }, (_, i) => i + 1).map(q => (
                       <div key={q} className="p-6 bg-slate-50 rounded-[2.5rem] space-y-4 border border-slate-100 hover:border-purple-200 transition-all shadow-sm">
                          <div className="flex justify-between items-center px-1">
                             <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">سؤال {q}</span>
                             <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase">النقاط</span>
                                <input 
                                   type="text" 
                                   inputMode="decimal"
                                   placeholder="1"
                                   value={editingExam.weights?.[String(q)] || ""} 
                                   onChange={e => handleWeightChange(q, e.target.value)}
                                   className="w-14 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-center focus:ring-4 focus:ring-purple-100 focus:border-purple-400 outline-none transition-all shadow-sm"
                                />
                             </div>
                          </div>
                          <div className="flex justify-between items-center gap-2">
                            {['A', 'B', 'C', 'D'].map(opt => (
                               <button 
                                  key={opt} 
                                  onClick={() => handleKeyChange(q, opt)} 
                                  className={`flex-1 h-10 rounded-xl font-black text-xs transition-all border-2 ${editingExam.keys?.[String(q)] === opt ? 'bg-purple-600 border-purple-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-purple-200'}`}
                               >
                                  {opt}
                               </button>
                            ))}
                          </div>
                       </div>
                    ))}
                  </div>
                  <div className="p-8 border-t border-slate-50 flex gap-4 bg-slate-50/50">
                    <button onClick={resetWeights} className="px-6 py-4 bg-white text-indigo-600 rounded-2xl font-black border border-indigo-100 shadow-sm transition-all hover:bg-indigo-50 flex items-center gap-2">
                       <RefreshCw size={16} /> توحيد الدرجات (1)
                    </button>
                    <div className="flex-1"></div>
                    <button onClick={() => setEditingExam(null)} className="px-8 py-4 bg-white text-slate-400 rounded-2xl font-black border border-slate-100 shadow-sm transition-all hover:bg-slate-50">تجاهل</button>
                    <button onClick={saveKeys} className="px-10 py-4 bg-purple-600 text-white rounded-2xl font-black hover:bg-purple-700 shadow-xl transition-all">حفظ مفتاح الإجابة</button>
                  </div>
               </div>
            </div>
          )}

          {showCustomEditor && (
            <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
               <div className="bg-white w-full max-w-3xl rounded-[3.5rem] shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 border-none text-right overflow-hidden">
                  <div className="p-10 pb-8 bg-indigo-600 text-white flex justify-between items-center"><div className="flex items-center gap-6"><div className="w-16 h-16 bg-white/20 rounded-2.5xl flex items-center justify-center backdrop-blur-sm border border-white/30"><Layout size={32} /></div><div><h3 className="text-3xl font-black font-header tracking-tight">تخصيص قالب الورقة</h3><p className="text-indigo-100 text-sm font-bold mt-1">تعديل النصوص والشعار والمظهر العام</p></div></div><button onClick={() => setShowCustomEditor(false)} className="p-4 bg-white/20 text-white hover:bg-white/40 rounded-2.5xl transition-all"><X size={24} /></button></div>
                  <div className="flex-1 overflow-y-auto p-12 custom-scrollbar space-y-8">
                     <div className="space-y-6"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">شعار المدرسة</label><div className="flex items-center gap-8 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100"><div className="w-32 h-32 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden relative group">{customConfig.logoDataUrl ? <img src={customConfig.logoDataUrl} className="w-full h-full object-contain p-2" /> : <ImageIcon className="text-slate-200" size={48} />}<input type="file" onChange={e => handleCustomLogoChange(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" /></div><div className="flex-1 space-y-4"><p className="text-sm font-bold text-slate-500">اضغط لرفع شعار بصيغة PNG أو JPG</p>{customConfig.logoDataUrl && <button onClick={() => setCustomConfig({...customConfig, logoDataUrl: ''})} className="text-rose-500 font-black text-xs hover:underline">إزالة الشعار</button>}</div></div></div>
                     <div className="grid grid-cols-1 gap-6">{[{ key: 'school_name', label: 'اسم المدرسة / الإدارة' }, { key: 'exam_name', label: 'عنوان الاختبار أو المجمع' }, { key: 'year', label: 'العام الدراسي والترم' }, { key: 'principal', label: 'اسم المدير أو المراقب' }, { key: 'footer', label: 'تذييل الورقة (Footer)' }].map(f => (<div key={f.key} className="space-y-3"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">{f.label}</label><input type="text" value={customConfig[f.key]} onChange={e => setCustomConfig({...customConfig, [f.key]: e.target.value})} className="w-full px-8 py-5 bg-slate-50 border-none rounded-[2rem] font-black text-slate-700 text-right outline-none focus:bg-white transition-all shadow-sm" /></div>))}</div>
                  </div>
                  <div className="p-10 border-t border-slate-50 flex gap-6 bg-slate-50/50"><button onClick={() => setShowCustomEditor(false)} className="px-10 py-5 bg-white text-slate-400 rounded-2.5xl font-black border border-slate-100 shadow-sm transition-all hover:bg-slate-50">تجاهل</button><button onClick={handleApplyCustomEditor} className="flex-1 py-5 bg-indigo-600 text-white rounded-2.5xl font-black hover:bg-indigo-700 shadow-xl transition-all">اعتماد القالب</button></div>
               </div>
            </div>
          )}
        </>
      ) : (
        /* ── Subjects Tab (Integrated Subject Manager) ── */
        <div className="luxury-card bg-white border-none shadow-2xl animate-in slide-in-from-right-8 duration-500 overflow-hidden flex flex-col relative min-h-[700px]">
          <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-l from-indigo-500 via-purple-500 to-indigo-500"></div>
          <div className="p-10 pb-6 flex justify-between items-center shrink-0">
             <div className="flex items-center gap-5">
               <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 shadow-sm border border-purple-100"><BookOpen size={28} /></div>
               <div>
                  <h3 className="text-3xl font-black text-slate-900 font-header leading-[1.1] tracking-tight text-right">إدارة المقررات</h3>
                  <p className="text-slate-400 text-xs mt-1 font-bold italic px-1 text-right">إضافة وتنسيق المواد وربطها بالصفوف</p>
               </div>
             </div>
          </div>
          <div className="p-10 pt-0 flex flex-col flex-1">
              <div className="p-8 bg-slate-50/50 rounded-[2.5rem] mb-10 border border-slate-100 shadow-inner">
                 <div className="relative group mb-6">
                    <input type="text" value={newSubjectInput} onChange={e => setNewSubjectInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddSubject()} placeholder="أدخل اسم المادة الجديدة هنا..." className="w-full pr-10 pl-40 py-5 bg-white border-2 border-transparent rounded-[2rem] outline-none focus:border-purple-100 focus:ring-8 focus:ring-purple-50/50 font-black text-lg transition-all text-right shadow-sm" />
                    <button onClick={handleAddSubject} className="absolute left-3 top-1/2 -translate-y-1/2 px-8 py-3 bg-purple-600 text-white rounded-[1.5rem] font-black text-sm hover:bg-purple-700 transition-all shadow-xl active:scale-95">إضافة المادة</button>
                 </div>
                 <div className="space-y-5">
                    <div className="flex flex-wrap gap-2.5 px-2 justify-end">
                      <button onClick={() => setNewSubjectGrades(['All'])} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all border-2 ${newSubjectGrades.includes('All') ? 'bg-purple-600 text-white border-purple-600 shadow-xl' : 'bg-white text-slate-400 border-slate-100'}`}>جميع الصفوف</button>
                      {Object.values(STAGES).flat().map(grade => (
                        <button key={grade} onClick={() => {
                            if (newSubjectGrades.includes('All')) { setNewSubjectGrades([grade]); }
                            else {
                                if (newSubjectGrades.includes(grade)) {
                                    const next = newSubjectGrades.filter(g => g !== grade);
                                    setNewSubjectGrades(next.length === 0 ? ['All'] : next);
                                } else { setNewSubjectGrades([...newSubjectGrades, grade]); }
                            }
                        }} className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all border-2 ${newSubjectGrades.includes(grade) ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200'}`}>{grade}</button>
                      ))}
                    </div>
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar space-y-6 max-h-[500px]">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {subjects.map(sub => (
                       <div key={sub.id} className="flex flex-col p-6 bg-slate-50/50 border border-slate-100 rounded-[2.5rem] hover:bg-white hover:border-purple-200 transition-all duration-500 group relative text-right">
                          <div className="flex items-start justify-between mb-5">
                            <button onClick={() => handleDeleteSubject(sub.id)} className="p-2.5 text-slate-200 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                            <div className="flex items-center gap-3">
                              <div className="text-right"><span className="font-black text-slate-800 text-lg block leading-none mb-1.5">{sub.name}</span><span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">{sub.grades.includes('All') ? 'كافة الصفوف' : `${sub.grades.length} صفوف`}</span></div>
                              <div className="w-12 h-12 bg-white rounded-2xl shadow-md flex items-center justify-center text-purple-500">{getSubjectIcon(sub.name, 24)}</div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 justify-end">
                             {sub.grades.includes('All') ? <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-500 text-[9px] font-black uppercase">عام</span> : sub.grades.map(g => <span key={g} className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-500 text-[9px] font-black">{g}</span>)}
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OMRExams;
