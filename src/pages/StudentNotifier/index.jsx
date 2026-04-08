import React, { useState, useEffect, useRef } from 'react';
import { getStudents, getAppSettings, saveAppSettings } from '../../utils/dataService';
import { Send, Phone, User, Loader2, Image as ImageIcon, MessageSquare, CheckCircle, AlertCircle, Settings, UploadCloud, Users, CheckSquare, ChevronRight } from 'lucide-react';
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
        
        // Process each file
        for(let file of files) {
            const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
            
            // Fuzzy Match: find student who has this exact name, or if filename contains student name
            let bestMatchId = null;
            const matchedStudent = students.find(s => s.name === fileName || fileName.includes(s.name) || s.name.includes(fileName));
            if(matchedStudent) {
                bestMatchId = matchedStudent.id;
            }

            // Create object URL for quick preview
            const preview = URL.createObjectURL(file);

            newResultFiles.push({
                id: Math.random().toString(36).substr(2, 9),
                file,
                fileName,
                preview,
                matchedStudentId: bestMatchId,
                status: 'pending', // pending, sending, success, error
                msg: ''
            });
        }

        setResultFiles(prev => [...prev, ...newResultFiles]);
        // reset input
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
        if(readyFiles.length === 0) return alert('لا يوجد مسودات جاهزة للإرسال أو لم تقم بربط الصور بالطلاب.');

        setBulkSending(true);

        for(let rf of readyFiles) {
            // Update individual status to sending
            setResultFiles(prev => prev.map(f => f.id === rf.id ? { ...f, status: 'sending', msg: 'جاري الإرسال...' } : f));

            try {
                const student = students.find(s => s.id === rf.matchedStudentId);
                if(!student || !student.phone) throw new Error('لا يوجد رقم جوال صالح.');

                // Convert File to Base64
                const base64Data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                    reader.readAsDataURL(rf.file);
                });

                const caption = (appConfig?.messages?.result || "إشعار درجات نتيجة الاختبار للطالب: *{name}*").replace('{name}', student.name);

                const res = await fetch('http://localhost:3001/send-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: student.phone, imageBase64: base64Data, caption })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'خطأ في الخادم');

                setResultFiles(prev => prev.map(f => f.id === rf.id ? { ...f, status: 'success', msg: 'تم الإرسال ✓' } : f));

            } catch (error) {
                setResultFiles(prev => prev.map(f => f.id === rf.id ? { ...f, status: 'error', msg: error.message } : f));
            }
            
            // Add a small delay between messages to respect rate limits
            await new Promise(r => setTimeout(r, 1000));
        }

        setBulkSending(false);
    };

    // --- Committees Functions ---

    const generateAndSendSeatCard = async (student) => {
        if (!student.phone) {
            setStatusMap(prev => ({ ...prev, [student.id]: { status: 'error', msg: 'رقم الجوال مفقود' }}));
            return;
        }

        setSendingId(student.id);
        
        try {
            // Load the image template
            const img = new Image();
            // Since it's in public folder we can fetch via relative URL
            img.src = '/committee_number.jpg';
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error('لم نتمكن من تحميل صورة قالب اللجنة'));
            });

            // Draw to canvas
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            
            ctx.drawImage(img, 0, 0);

            // Generate base scaling factor
            const scaleFactor = 30; // base equivalent for rem -> px on high-res template

            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';

            // Function to convert % to px
            const getX = (pct) => canvas.width - (canvas.width * (pct / 100));
            const getY = (pct) => canvas.height * (pct / 100);

            // Print Name
            ctx.font = `bold ${config.name.fontSize * scaleFactor}px Arial`;
            ctx.fillStyle = '#111827';
            ctx.fillText(student.name || '', getX(config.name.right), getY(config.name.top));

            // Print Seat Number
            ctx.font = `900 ${config.seatNumber.fontSize * scaleFactor}px Arial`;
            ctx.fillStyle = '#4338ca'; // indigo-700
            ctx.fillText(student.seatNumber?.toString() || '', getX(config.seatNumber.right), getY(config.seatNumber.top));

            // Print Grade
            ctx.font = `bold ${(config.grade?.fontSize || 1) * scaleFactor}px Arial`;
            ctx.fillStyle = '#1f2937';
            ctx.fillText(student.grade || '', getX(config.grade?.right || 30), getY(config.grade?.top || 65));

            // Optional: Print Committee if needed
            if (student.committee && config.committee) {
                ctx.font = `bold ${config.committee.fontSize * scaleFactor}px Arial`;
                ctx.fillStyle = '#065f46';
                ctx.fillText(student.committee, getX(config.committee.right), getY(config.committee.top));
            }

            // Export base64
            const base64Data = canvas.toDataURL('image/jpeg', 0.9);

            // Send to whatsapp server
            const caption = (appConfig?.messages?.committee || "أهلاً بك 🎓\nهذه بطاقة الجلوس وتحديد قاعة الاختبار للطالب: *{name}*.\nنتمنى لك التوفيق!").replace('{name}', student.name);
            
            const res = await fetch('http://localhost:3001/send-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: student.phone, imageBase64: base64Data, caption })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'خطأ في خادم الإرسال');
            
            setStatusMap(prev => ({ ...prev, [student.id]: { status: 'success', msg: 'تم الإرسال بنجاح' }}));

        } catch (error) {
            console.error('Send Error:', error);
            setStatusMap(prev => ({ ...prev, [student.id]: { status: 'error', msg: error.message }}));
        } finally {
            setSendingId(null);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in pb-20">
            {/* Hidden Canvas for Drawing */}
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                        <MessageSquare className="text-indigo-600" /> العمليات المدرسية المشتركة (مركز الإشعارات)
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">مدير الإرسال الشامل لإشعارات اللجان و شهادات ونتائج نظام نور</p>
                </div>
            </div>

            {/* WhatsApp Status UI */}
            <WhatsAppStatus />
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('committees')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all ${
                        activeTab === 'committees' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <ImageIcon size={18} />
                    بطاقات اللجان
                </button>
                <button
                    onClick={() => setActiveTab('results')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all ${
                        activeTab === 'results' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <CheckSquare size={18} />
                    إرسال الشهادات والنتائج الجاهزة
                </button>
            </div>

            {/* COMMITTEES TAB */}
            {activeTab === 'committees' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <p className="text-gray-600 font-medium">سيقوم هذا القسم برسم (اسم الطالب ورقم جلوسه) على صورة قالب اللجنة، وإرسالها مصممة له.</p>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`flex items-center gap-2 px-6 py-2.5 border rounded-xl font-bold transition-all ${
                                showSettings ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 shadow-sm'
                            }`}
                        >
                            <Settings size={18} />
                            <span>إعدادات قالب اللجنة</span>
                        </button>
                    </div>

            {showSettings && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">ضبط إحداثيات وأحجام نصوص البطاقة المدمجة</h3>
                        <p className="text-xs text-gray-400">تُحفظ تلقائياً وتطبق هنا وفي صفحة بطاقات الجلوس</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {['name', 'seatNumber', 'grade', 'committee'].map((field) => {
                            const labels = {
                                name: 'اسم الطالب',
                                seatNumber: 'رقم الجلوس',
                                grade: 'المرحلة / الصف',
                                committee: 'رقم/اسم اللجنة'
                            };
                            return (
                                <div key={field} className="space-y-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                                    <h4 className="font-bold text-indigo-700 border-b border-gray-200 pb-2">{labels[field]}</h4>
                                    
                                    <div>
                                        <label className="text-xs text-gray-500 font-bold flex justify-between mb-1">
                                            <span>أعلى/أسفل (Top)</span>
                                            <span className="text-indigo-600 font-mono">{config[field]?.top || 0}%</span>
                                        </label>
                                        <input 
                                            type="range" min="0" max="100" step="0.5"
                                            value={config[field]?.top || 0}
                                            onChange={(e) => handleConfigChange(field, 'top', e.target.value)}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs text-gray-500 font-bold flex justify-between mb-1">
                                            <span>يمين/يسار (Right)</span>
                                            <span className="text-indigo-600 font-mono">{config[field]?.right || 0}%</span>
                                        </label>
                                        <input 
                                            type="range" min="0" max="100" step="0.5"
                                            value={config[field]?.right || 0}
                                            onChange={(e) => handleConfigChange(field, 'right', e.target.value)}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-gray-500 font-bold flex justify-between mb-1">
                                            <span>حجم الخط (Scale)</span>
                                            <span className="text-emerald-600 font-mono">{config[field]?.fontSize || 1}x</span>
                                        </label>
                                        <input 
                                            type="range" min="0.5" max="3" step="0.1"
                                            value={config[field]?.fontSize || 1}
                                            onChange={(e) => handleConfigChange(field, 'fontSize', e.target.value)}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Live Preview Block */}
                    <div className="mt-8 border-t border-gray-100 pt-6">
                        <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <ImageIcon size={18} className="text-gray-400" /> معاينة حية لشكل البطاقة:
                        </h4>
                        <div className="flex justify-center bg-gray-50/50 p-6 rounded-xl border border-dashed border-gray-200">
                            <div
                                className="relative overflow-hidden rounded-lg shadow-sm border border-gray-300 bg-white"
                                style={{
                                    width: '100%',
                                    maxWidth: '400px', // Scaling down for preview naturally, the text fontSize shrinks relatively
                                    aspectRatio: '1.6',
                                    backgroundImage: "url('/رقم اللجنة-D4cvHd1Y.jpeg')",
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    backgroundRepeat: 'no-repeat'
                                }}
                            >
                                <div 
                                    className="absolute font-bold text-gray-900 whitespace-nowrap"
                                    style={{ top: `${config.name?.top || 0}%`, right: `${config.name?.right || 0}%`, fontSize: `${config.name?.fontSize || 1}rem`, transform: 'translateY(-50%)' }}
                                >
                                    اسم الطالب للتجربة
                                </div>
                                <div 
                                    className="absolute font-black text-indigo-700 whitespace-nowrap"
                                    style={{ top: `${config.seatNumber?.top || 0}%`, right: `${config.seatNumber?.right || 0}%`, fontSize: `${config.seatNumber?.fontSize || 1}rem`, transform: 'translateY(-50%)' }}
                                >
                                    88293
                                </div>
                                <div 
                                    className="absolute font-semibold text-gray-800 whitespace-nowrap"
                                    style={{ top: `${config.grade?.top || 0}%`, right: `${config.grade?.right || 0}%`, fontSize: `${config.grade?.fontSize || 1}rem`, transform: 'translateY(-50%)' }}
                                >
                                    الصف الثالث المتقدم
                                </div>
                                <div 
                                    className="absolute font-bold text-emerald-800 whitespace-nowrap"
                                    style={{ top: `${config.committee?.top || 0}%`, right: `${config.committee?.right || 0}%`, fontSize: `${config.committee?.fontSize || 1}rem`, transform: 'translateY(-50%)' }}
                                >
                                    1
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-50 bg-slate-50 flex items-center justify-between">
                    <h3 className="font-bold text-gray-700">قائمة إرسال الإشعارات المشتركة</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-slate-50 text-gray-500 text-xs font-bold uppercase">
                            <tr>
                                <th className="px-6 py-4">اسم الطالب</th>
                                <th className="px-6 py-4">بيانات اللجنة</th>
                                <th className="px-6 py-4">رقم الجوال</th>
                                <th className="px-6 py-4">إرسال بطاقة اللجنة</th>
                                <th className="px-6 py-4">حالة الإرسال</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="5" className="text-center py-10 text-gray-400">جاري التحميل...</td></tr>
                            ) : students.length === 0 ? (
                                <tr><td colSpan="5" className="text-center py-10 text-gray-400">لا يوجد طلاب</td></tr>
                            ) : students.map((student) => (
                                <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-800">{student.name}</div>
                                        <div className="text-xs text-gray-400 mt-1">{student.grade} - فصل {student.class}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {student.committee ? (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm font-bold text-indigo-700">لجنة: {student.committee}</span>
                                                <span className="text-xs text-gray-500 font-mono">جلوس: {student.seatNumber || '—'}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-300 italic">غير موزع</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {student.phone ? (
                                            <span className="flex items-center gap-1.5 text-sm font-mono text-emerald-600 font-bold" dir="ltr">
                                                <Phone size={13} /> {student.phone}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-red-400 font-medium">غير مسجل</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            disabled={!student.phone || sendingId === student.id}
                                            onClick={() => generateAndSendSeatCard(student)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all
                                                ${!student.phone 
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                                }`}
                                        >
                                            {sendingId === student.id 
                                                ? <Loader2 size={16} className="animate-spin" /> 
                                                : <ImageIcon size={16} />
                                            }
                                            إرسال البطاقة
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        {statusMap[student.id] && (
                                            <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1.5 rounded-lg inline-flex
                                                ${statusMap[student.id].status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
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

            {/* RESULTS DISPATCHER TAB */}
            {activeTab === 'results' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                    
                    <div className="bg-emerald-50/50 p-8 rounded-2xl border border-emerald-100 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                            <UploadCloud size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">استيراد الشهادات وصور النتائج الجاهزة</h2>
                        <p className="text-gray-500 max-w-xl text-sm mb-6 leading-relaxed">
                            قم برفع صور شهادات نظام نور (أو أي صور نتائج أخرى). سيحاول النظام <b>آلياً ترتيبها، ومطابقة اسم الصورة باسم الطالب</b> لسحب رقم الجوال.
                        </p>
                        
                        <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2">
                            <input 
                                type="file" 
                                multiple 
                                accept="image/*" 
                                onChange={handleFilesUpload}
                                className="hidden"
                            />
                            <ImageIcon size={20} />
                            تحديد ورفع الصور
                        </label>
                    </div>

                    {resultFiles.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 border-b border-gray-50 bg-slate-50 flex items-center justify-between">
                                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                    <Users size={18} className="text-indigo-500" />
                                    مطابقة وتأكيد إرسال النتائج ({resultFiles.length} صورة)
                                </h3>
                                <button
                                    onClick={sendBulkResults}
                                    disabled={bulkSending}
                                    className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold text-sm shadow-sm hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {bulkSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    إرسال لكل الطلاب المطابقين
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-right">
                                    <thead className="bg-slate-50 text-gray-500 text-xs font-bold uppercase">
                                        <tr>
                                            <th className="px-6 py-4 w-24">معاينة</th>
                                            <th className="px-6 py-4">اسم ملف الصورة</th>
                                            <th className="px-6 py-4">الطالب المطابق (رقم الجوال)</th>
                                            <th className="px-6 py-4 w-40">حالة الربط</th>
                                            <th className="px-6 py-4">الإرسال</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {resultFiles.map((rf) => (
                                            <tr key={rf.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-3">
                                                    <div className="w-12 h-16 rounded-md overflow-hidden border shadow-sm flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setPreviewImage(rf.preview)}>
                                                        <img src={rf.preview} alt="preview" className="w-full h-full object-cover" />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 font-mono text-sm text-gray-600 max-w-[150px] truncate" title={rf.fileName} dir="ltr">
                                                    {rf.fileName}
                                                </td>
                                                <td className="px-6 py-3">
                                                    <select
                                                        value={rf.matchedStudentId || ''}
                                                        onChange={(e) => handleMatchChange(rf.id, e.target.value)}
                                                        className={`w-full p-2 border rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500
                                                            ${rf.matchedStudentId ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}
                                                        `}
                                                    >
                                                        <option value="" disabled>-- إختر الطالب لربط الصورة --</option>
                                                        {students.map(s => (
                                                            <option key={s.id} value={s.id}>
                                                                {s.name} {s.phone ? `(${s.phone})` : '(بدون جوال)'}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-6 py-3 text-sm">
                                                    {rf.matchedStudentId ? (
                                                        <span className="text-emerald-600 font-bold flex items-center gap-1"><CheckCircle size={14}/> جاهز للإرسال</span>
                                                    ) : (
                                                        <span className="text-red-500 font-bold flex items-center gap-1"><AlertCircle size={14}/> يحتاج لربط</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-3">
                                                    {rf.status !== 'pending' && (
                                                        <div className={`text-xs font-bold px-2 py-1.5 rounded-lg inline-flex items-center gap-1.5
                                                            ${rf.status === 'success' ? 'bg-green-50 text-green-700' : 
                                                              rf.status === 'sending' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                                                            {rf.status === 'sending' && <Loader2 size={12} className="animate-spin" />}
                                                            {rf.msg}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-3 text-left">
                                                    <button onClick={() => removeFile(rf.id)} className="text-xs text-red-400 hover:text-red-600 font-bold bg-red-50 px-2 py-1 rounded">
                                                        إزالة
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

            {/* FULLSCREEN IMAGE MODAL */}
            {previewImage && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-5xl w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <button 
                            onClick={() => setPreviewImage(null)}
                            className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                        <img 
                            src={previewImage} 
                            alt="Full View" 
                            className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentNotifier;
