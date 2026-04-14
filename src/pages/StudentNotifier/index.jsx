import React, { useState, useEffect, useRef } from 'react';
import { getStudents, getAppSettings, saveAppSettings } from '../../utils/dataService';
import { Send, Phone, User, Loader2, Image as ImageIcon, MessageSquare, CheckCircle, AlertCircle, Settings, UploadCloud, Users, CheckSquare, ChevronRight, X, ShieldCheck, Zap, SlidersHorizontal, Eye, Maximize2, RotateCcw, Layout, FileStack } from 'lucide-react';
import WhatsAppStatus from '../../components/WhatsAppStatus';

const StudentNotifier = () => {
    const [activeTab, setActiveTab] = useState('committees'); // 'committees' | 'results'
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [sendingId, setSendingId] = useState(null);
    const [statusMap, setStatusMap] = useState({}); // student_id -> { status: 'success'|'error', msg: string }
    const [appConfig, setAppConfig] = useState(null);
    
    // --- Result Dispatcher State ---
    const [resultFiles, setResultFiles] = useState([]); // [{ file, preview, matchedStudentId, status, msg }]
    const [bulkSending, setBulkSending] = useState(false);
    const [previewImage, setPreviewImage] = useState(null); // URL of image to view in fullscreen
    
    // Canvas reference for drawing
    const canvasRef = useRef(null);

    useEffect(() => {
        const init = async () => {
            const data = await getAppSettings();
            setAppConfig(data);
            await loadStudents();
        };
        init();
    }, []);

    const config = appConfig?.seating;

    const handleConfigChange = async (field, prop, value) => {
        if (!appConfig) return;
        const newSeating = { ...appConfig.seating, [field]: { ...appConfig.seating[field], [prop]: parseFloat(value) } };
        const newFullConfig = { ...appConfig, seating: newSeating };
        setAppConfig(newFullConfig);
        await saveAppSettings(newFullConfig);
    };

    const loadStudents = async () => {
        setLoading(true);
        const data = await getStudents();
        setStudents(data);
        setLoading(false);
    };

    // --- Results Dispatcher Functions ---
    const handleFilesUpload = async (e) => {
        const files = Array.from(e.target.files);
        if(!files.length) return;

        const newResultFiles = [];
        for(let file of files) {
            const fileName = file.name.replace(/\.[^/.]+$/, ""); 
            let bestMatchId = null;
            const matchedStudent = students.find(s => s.name === fileName || fileName.includes(s.name) || s.name.includes(fileName));
            if(matchedStudent) bestMatchId = matchedStudent.id;

            const preview = URL.createObjectURL(file);
            newResultFiles.push({
                id: Math.random().toString(36).substr(2, 9),
                file,
                fileName,
                preview,
                matchedStudentId: bestMatchId,
                status: 'pending',
                msg: ''
            });
        }
        setResultFiles(prev => [...prev, ...newResultFiles]);
        e.target.value = null;
    };

    const handleMatchChange = (fileId, studentId) => {
        setResultFiles(prev => prev.map(f => f.id === fileId ? { ...f, matchedStudentId: studentId } : f));
    };

    const removeFile = (fileId) => {
        setResultFiles(prev => prev.filter(f => f.id !== fileId));
    };

    const sendBulkResults = async () => {
        const readyFiles = resultFiles.filter(f => f.matchedStudentId && f.status !== 'success');
        if(readyFiles.length === 0) return;

        setBulkSending(true);
        for(let rf of readyFiles) {
            setResultFiles(prev => prev.map(f => f.id === rf.id ? { ...f, status: 'sending', msg: 'جاري الإرسال...' } : f));

            try {
                const student = students.find(s => s.id === rf.matchedStudentId);
                if(!student || !student.phone) throw new Error('لا يوجد رقم جوال.');

                const base64Data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                    reader.readAsDataURL(rf.file);
                });

                const caption = (appConfig?.messages?.result || "درجات الطالب: *{name}*").replace('{name}', student.name);

                const res = await fetch('http://localhost:3001/send-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: student.phone, imageBase64: base64Data, caption })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'ERROR');

                setResultFiles(prev => prev.map(f => f.id === rf.id ? { ...f, status: 'success', msg: 'تم ✓' } : f));
            } catch (error) {
                setResultFiles(prev => prev.map(f => f.id === rf.id ? { ...f, status: 'error', msg: error.message } : f));
            }
            await new Promise(r => setTimeout(r, 1000));
        }
        setBulkSending(false);
    };

    const generateAndSendSeatCard = async (student) => {
        if (!student.phone) {
            setStatusMap(prev => ({ ...prev, [student.id]: { status: 'error', msg: 'رقم الجوال مفقود' }}));
            return;
        }

        setSendingId(student.id);
        try {
            const img = new Image();
            img.src = '/committee_number.jpg';
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error('Template Error'));
            });

            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const scaleFactor = 30; 
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const getX = (pct) => canvas.width - (canvas.width * (pct / 100));
            const getY = (pct) => canvas.height * (pct / 100);

            ctx.font = `bold ${config.name.fontSize * scaleFactor}px Arial`;
            ctx.fillStyle = '#111827';
            ctx.fillText(student.name || '', getX(config.name.right), getY(config.name.top));

            ctx.font = `900 ${config.seatNumber.fontSize * scaleFactor}px Arial`;
            ctx.fillStyle = '#4f46e5'; 
            ctx.fillText(student.seatNumber?.toString() || '', getX(config.seatNumber.right), getY(config.seatNumber.top));

            ctx.font = `bold ${(config.grade?.fontSize || 1) * scaleFactor}px Arial`;
            ctx.fillStyle = '#1f2937';
            ctx.fillText(`${student.grade} - فصل ${student.class}` || '', getX(config.grade?.right || 30), getY(config.grade?.top || 65));

            if (student.committee && config.committee) {
                ctx.font = `bold ${config.committee.fontSize * scaleFactor}px Arial`;
                ctx.fillStyle = '#065f46';
                ctx.fillText(student.committee, getX(config.committee.right), getY(config.committee.top));
            }

            const base64Data = canvas.toDataURL('image/jpeg', 0.9);
            const caption = (appConfig?.messages?.committee || "بطاقة جلوس الطالب: *{name}*").replace('{name}', student.name);
            
            const res = await fetch('http://localhost:3001/send-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: student.phone, imageBase64: base64Data, caption })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Server Error');
            setStatusMap(prev => ({ ...prev, [student.id]: { status: 'success', msg: 'تم بنجاح' }}));
        } catch (error) {
            setStatusMap(prev => ({ ...prev, [student.id]: { status: 'error', msg: error.message }}));
        } finally {
            setSendingId(null);
        }
    };

    if (!appConfig) return (
        <div className="flex flex-col items-center justify-center py-40 opacity-20 font-alexandria">
            <Loader2 size={64} className="animate-spin mb-4 text-slate-400" />
            <p className="font-black text-xl text-slate-600">جاري استدعاء مركز المراسلات...</p>
        </div>
    );

    return (
        <div className="space-y-10 animate-in fade-in duration-700 font-alexandria pb-20">
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

            {/* ── Page Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2.5xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                            <Send size={24} />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 font-header tracking-tight">مركز الإشعارات الموحد</h1>
                    </div>
                    <p className="text-slate-400 font-medium text-sm flex items-center gap-2">
                        <ShieldCheck size={16} className="text-indigo-400" />
                        مدير الإرسال الشامل لإذاعة نتائج الطلاب وتعريفات اللجان عبر القنوات الرقمية
                    </p>
                </div>
                <WhatsAppStatus />
            </div>

            {/* ── Navigation Tabs ── */}
            <div className="flex gap-4 p-2 bg-slate-100/50 rounded-[2rem] w-fit mx-auto md:mx-0 border border-slate-100">
                <button
                    onClick={() => setActiveTab('committees')}
                    className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-sm transition-all
                      ${activeTab === 'committees' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <ImageIcon size={20} /> بطاقات اللجان والجلوس
                </button>
                <button
                    onClick={() => setActiveTab('results')}
                    className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-sm transition-all
                      ${activeTab === 'results' ? 'bg-white text-emerald-600 shadow-sm border border-emerald-100' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <CheckSquare size={20} /> أرشيف النتائج والشهادات
                </button>
            </div>

            {/* ── TAB CONTENT: COMMITTEES ── */}
            {activeTab === 'committees' && (
                <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-700">
                    <div className="luxury-card p-6 bg-indigo-600 text-white flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative border-none shadow-indigo-100">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                        <div className="flex items-center gap-6 relative z-10">
                           <div className="w-16 h-16 bg-white/20 backdrop-blur-3xl rounded-[1.5rem] border border-white/20 flex items-center justify-center shadow-inner">
                              <Layout size={32} />
                           </div>
                           <div>
                              <h3 className="text-xl font-black font-header tracking-tight">مولد بطاقات الجلوس الذكي</h3>
                              <p className="text-indigo-100 font-medium text-xs opacity-80 mt-1">سيقوم النظام برسم بيانات كل طالب آلياً على القالب المعتمد وإرسالها فوراً</p>
                           </div>
                        </div>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`flex items-center gap-3 px-8 py-4 rounded-3xl font-black text-sm transition-all relative z-10
                              ${showSettings ? 'bg-white text-indigo-600 shadow-xl' : 'bg-indigo-700/50 text-white hover:bg-indigo-500'}`}
                        >
                            <Settings size={20} /> ضبط إحداثيات القالب
                        </button>
                    </div>

                    {showSettings && (
                        <div className="luxury-card p-10 bg-white border-white animate-in zoom-in-95 duration-500">
                            <div className="flex justify-between items-center mb-10">
                                <h4 className="text-2xl font-black text-slate-900 font-header">ستوديو المعايرة</h4>
                                <div className="px-4 py-2 bg-slate-50 text-[10px] font-black text-slate-400 rounded-full border border-slate-100 truncate uppercase tracking-widest">Real-time Layout Engine</div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
                                {['name', 'seatNumber', 'grade', 'committee'].map((field) => (
                                    <div key={field} className="space-y-6 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/30">
                                        <h5 className="font-black text-xs text-indigo-600 uppercase tracking-widest border-b border-indigo-100 pb-4">
                                            {field === 'name' ? 'حقل الاسم' : field === 'seatNumber' ? 'رقم الجلوس' : field === 'grade' ? 'المرحلة' : 'اللجنة'}
                                        </h5>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <div className="flex justify-between px-1"><span className="text-[10px] font-black text-slate-400">Top</span><span className="text-xs font-black text-indigo-600">{config[field]?.top}%</span></div>
                                                <input type="range" min="0" max="100" step="0.5" value={config[field]?.top} onChange={(e) => handleConfigChange(field, 'top', e.target.value)} className="premium-range" />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between px-1"><span className="text-[10px] font-black text-slate-400">Right</span><span className="text-xs font-black text-indigo-600">{config[field]?.right}%</span></div>
                                                <input type="range" min="0" max="100" step="0.5" value={config[field]?.right} onChange={(e) => handleConfigChange(field, 'right', e.target.value)} className="premium-range" />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between px-1"><span className="text-[10px] font-black text-slate-400">Size</span><span className="text-xs font-black text-emerald-600">x{config[field]?.fontSize}</span></div>
                                                <input type="range" min="0.5" max="3" step="0.1" value={config[field]?.fontSize} onChange={(e) => handleConfigChange(field, 'fontSize', e.target.value)} className="premium-range-success" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="bg-slate-50/50 p-8 rounded-[3rem] border border-slate-100 border-dashed flex flex-col items-center">
                                <h6 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Eye size={14} /> معاينة حية (قالب اللجنة الافتراضي)
                                </h6>
                                <div className="relative shadow-2xl rounded-2.5xl overflow-hidden border border-white" style={{ width: '100%', maxWidth: '500px', aspectRatio: '1.6', backgroundImage: "url('/committee_number.jpg')", backgroundSize: '100% 100%' }}>
                                     <div className="absolute font-black text-slate-900 leading-none" style={{ top: `${config.name.top}%`, right: `${config.name.right}%`, fontSize: `${config.name.fontSize}rem`, transform: 'translateY(-50%)' }}>محمد أحمد علي</div>
                                     <div className="absolute font-black text-indigo-600 leading-none" style={{ top: `${config.seatNumber.top}%`, right: `${config.seatNumber.right}%`, fontSize: `${config.seatNumber.fontSize}rem`, transform: 'translateY(-50%)' }}>88293</div>
                                     <div className="absolute font-black text-slate-600 leading-none" style={{ top: `${config.grade.top}%`, right: `${config.grade.right}%`, fontSize: `${config.grade.fontSize}rem`, transform: 'translateY(-50%)' }}>ثالث مدرسة متميز</div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="luxury-card p-0 bg-white border-none shadow-premium overflow-hidden">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                                   <Users size={18} />
                                </div>
                                <h3 className="font-header font-black text-slate-800">سجل إشعارات اللجان</h3>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-5">هوية الطالب</th>
                                        <th className="px-8 py-5">تمركز اللجنة</th>
                                        <th className="px-8 py-5">التحقق الهاتفي</th>
                                        <th className="px-8 py-5">الإجراء الرقمي</th>
                                        <th className="px-8 py-5">حالة البث</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {students.map((student) => (
                                        <tr key={student.id} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-6">
                                                <div className="font-header font-black text-slate-800">{student.name}</div>
                                                <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{student.grade} - {student.class}</div>
                                            </td>
                                            <td className="px-8 py-6">
                                                {student.committee ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs font-black text-indigo-600 uppercase tracking-tight">اللجنة: {student.committee}</span>
                                                        <span className="text-[10px] font-bold text-slate-400">جلوس: {student.seatNumber || '—'}</span>
                                                    </div>
                                                ) : <span className="text-[10px] font-bold text-slate-300 italic">غير مدرج</span>}
                                            </td>
                                            <td className="px-8 py-6">
                                                {student.phone ? (
                                                    <span className="text-xs font-black font-header text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100" dir="ltr">
                                                       {student.phone}
                                                    </span>
                                                ) : <span className="text-[10px] font-bold text-rose-300">بدون هاتف</span>}
                                            </td>
                                            <td className="px-8 py-6">
                                                <button
                                                    disabled={!student.phone || sendingId === student.id}
                                                    onClick={() => generateAndSendSeatCard(student)}
                                                    className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm flex items-center gap-2
                                                      ${!student.phone ? 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100' : 'bg-white text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white'}`}
                                                >
                                                    {sendingId === student.id ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                                                    إرسال البطاقة
                                                </button>
                                            </td>
                                            <td className="px-8 py-6">
                                                {statusMap[student.id] && (
                                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest border
                                                      ${statusMap[student.id].status === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                        {statusMap[student.id].status === 'success' ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
                                                        {statusMap[student.id].msg}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ── TAB CONTENT: RESULTS ── */}
            {activeTab === 'results' && (
                <div className="space-y-10 animate-in fade-in slide-in-from-left-8 duration-700">
                    <div className="luxury-card p-16 border-2 border-dashed border-emerald-200 bg-white/60 backdrop-blur-xl flex flex-col items-center justify-center text-center space-y-8 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                        <div className="w-24 h-24 bg-emerald-50 rounded-[2.5rem] flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform duration-700 shadow-sm border border-emerald-100 relative z-10">
                            <UploadCloud size={48} />
                        </div>
                        <div className="space-y-3 relative z-10">
                            <h2 className="text-3xl font-black text-slate-800 font-header tracking-tight">استيراد الشهادات والنتائج الرقمية</h2>
                            <p className="text-slate-400 font-bold text-sm max-w-xl mx-auto leading-relaxed">
                                قم برفع صور الشهادات (JPEG/PNG). سيقوم المحرك بمطابقة أسماء الملفات آلياً مع هوية الطلاب لسحب أرقام الهواتف وتجهيز حزم المراسلة.
                            </p>
                        </div>
                        <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 px-12 rounded-[2rem] shadow-xl shadow-emerald-100 transition-all active:scale-95 flex items-center gap-4 relative z-10 text-lg">
                            <input type="file" multiple accept="image/*" onChange={handleFilesUpload} className="hidden" />
                            <Zap size={24} /> تحميل وبدء المطابقة
                        </label>
                    </div>

                    {resultFiles.length > 0 && (
                        <div className="luxury-card p-0 bg-white border-none shadow-premium overflow-hidden animate-in slide-in-from-bottom-8 duration-700">
                            <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                                       <FileStack size={18} />
                                    </div>
                                    <h3 className="font-header font-black text-slate-800">حزمة المراسلة الجماعية ({resultFiles.length} وثيقة)</h3>
                                </div>
                                <button
                                    onClick={sendBulkResults}
                                    disabled={bulkSending}
                                    className="px-8 py-4 bg-slate-900 text-white rounded-3xl font-black text-sm shadow-xl hover:bg-black transition-all flex items-center gap-4 disabled:opacity-50"
                                >
                                    {bulkSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="text-emerald-400" />}
                                    بث النتائج لجميع الطلاب المطابقين
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-right">
                                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        <tr>
                                            <th className="px-8 py-5">معاينة الوثيقة</th>
                                            <th className="px-8 py-5">اسم الملف الرقمي</th>
                                            <th className="px-8 py-5">الطالب المطابق (سعر الربط)</th>
                                            <th className="px-8 py-5">حالة المطابقة</th>
                                            <th className="px-8 py-5">حالة البث</th>
                                            <th className="px-8 py-5"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {resultFiles.map((rf) => (
                                            <tr key={rf.id} className="hover:bg-slate-50/50 transition-colors group/row">
                                                <td className="px-8 py-4">
                                                    <div className="w-16 h-20 rounded-2xl overflow-hidden border-2 border-white shadow-md flex-shrink-0 cursor-pointer hover:scale-105 transition-transform relative group/img" onClick={() => setPreviewImage(rf.preview)}>
                                                        <img src={rf.preview} alt="preview" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white transition-opacity">
                                                           <Maximize2 size={16} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-4 font-mono text-[10px] font-black text-slate-500 max-w-[180px] truncate" dir="ltr">{rf.fileName}</td>
                                                <td className="px-8 py-4">
                                                    <select
                                                        value={rf.matchedStudentId || ''}
                                                        onChange={(e) => handleMatchChange(rf.id, e.target.value)}
                                                        className={`w-full max-w-[280px] px-4 py-3 border-none rounded-2xl text-[10px] font-black transition-all outline-none focus:ring-4
                                                            ${rf.matchedStudentId ? 'bg-emerald-50 text-emerald-700 focus:ring-emerald-100' : 'bg-rose-50 text-rose-700 focus:ring-rose-100'}
                                                        `}
                                                    >
                                                        <option value="" disabled>-- اختر الطالب لربط الوثيقة --</option>
                                                        {students.map(s => (
                                                            <option key={s.id} value={s.id}>{s.name} {s.phone ? `(${s.phone})` : '(بدون هاتف)'}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-8 py-4">
                                                    {rf.matchedStudentId ? (
                                                        <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">
                                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> Ready to Broadcast
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-[10px] font-black text-rose-400 uppercase tracking-widest leading-none italic">
                                                            Awaiting Linkage
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-8 py-4">
                                                    {rf.status !== 'pending' && (
                                                        <div className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border flex items-center gap-2
                                                          ${rf.status === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                                            rf.status === 'sending' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                            {rf.status === 'sending' && <Loader2 size={14} className="animate-spin" />}
                                                            {rf.msg}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-8 py-4">
                                                    <button onClick={() => removeFile(rf.id)} className="p-3 bg-slate-50 text-slate-300 hover:bg-rose-50 hover:text-rose-500 rounded-xl transition-all">
                                                       <X size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── FULLSCREEN IMAGE MODAL ── */}
            {previewImage && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/90 backdrop-blur-xl p-10 animate-in fade-in duration-300" onClick={() => setPreviewImage(null)}>
                    <div className="relative max-w-6xl w-full h-full flex flex-col items-center justify-center gap-6" onClick={(e) => e.stopPropagation()}>
                        <img src={previewImage} alt="Full View" className="max-w-full max-h-full rounded-[2rem] shadow-[0_40px_100px_rgba(0,0,0,0.5)] object-contain border-4 border-white/10" />
                        <button onClick={() => setPreviewImage(null)} className="px-10 py-4 bg-white text-slate-900 rounded-full font-black flex items-center gap-3 hover:bg-rose-500 hover:text-white transition-all shadow-2xl active:scale-95">
                           <X size={24} /> إغلاق المعاينة المكبرة
                        </button>
                    </div>
                </div>
            )}
            
            <style>{`
                .premium-range { -webkit-appearance: none; width: 100%; height: 6px; background: #f1f5f9; border-radius: 6px; outline: none; transition: all .2s; }
                .premium-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; background: #4f46e5; border-radius: 50%; cursor: pointer; border: 3px solid white; box-shadow: 0 4px 10px rgba(79,70,229,0.2); }
                .premium-range-success::-webkit-slider-thumb { background: #10b981; box-shadow: 0 4px 10px rgba(16,185,129,0.2); }
            `}</style>
        </div>
    );
};

export default StudentNotifier;
