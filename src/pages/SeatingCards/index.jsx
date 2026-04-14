import React, { useState, useEffect } from 'react';
import { Printer, CreditCard, Search, Filter, Download, FileText, FileDown, Settings, RotateCcw, Layout, UserCircle2, CheckCircle2, SlidersHorizontal, ChevronRight, X } from 'lucide-react';
import { getStudents, getAppSettings, saveAppSettings } from '../../utils/dataService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const SeatingCards = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [appConfig, setAppConfig] = useState(null);
    const [exporting, setExporting] = useState(false);
    
    useEffect(() => {
        const init = async () => {
            const data = await getAppSettings();
            setAppConfig(data);
            await fetchStudents();
        };
        init();
    }, []);

    const config = appConfig?.seating || {
        name: { top: 45, right: 35, fontSize: 1.2 },
        seatNumber: { top: 25, right: 15, fontSize: 1.5 },
        grade: { top: 65, right: 30, fontSize: 1 },
        committee: { top: 80, right: 15, fontSize: 1 }
    };

    const handleConfigChange = async (field, prop, value) => {
        if (!appConfig) return;
        const newSeating = { 
            ...config, 
            [field]: { ...config[field], [prop]: parseFloat(value) } 
        };
        const newFullConfig = { ...appConfig, seating: newSeating };
        setAppConfig(newFullConfig);
        await saveAppSettings(newFullConfig);
    };

    const fetchStudents = async () => {
        const data = await getStudents();
        setStudents(data);
        setLoading(false);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportCardsPDF = async () => {
        const cards = document.querySelectorAll('.card-to-print');
        if (cards.length === 0) return;
        
        setExporting(true);
        try {
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const cardsPerRow = 2;
            const rowsPerPage = 4;
            const marginX = 10;
            const marginY = 10;
            const spaceX = 10;
            const spaceY = 10;
            const imgWidth = 90; // mm

            for (let i = 0; i < cards.length; i++) {
                const canvas = await html2canvas(cards[i], { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                const col = i % cardsPerRow;
                const row = Math.floor((i % (cardsPerRow * rowsPerPage)) / cardsPerRow);

                if (i > 0 && i % (cardsPerRow * rowsPerPage) === 0) {
                    doc.addPage();
                }

                const x = marginX + col * (imgWidth + spaceX);
                const y = marginY + row * (imgHeight + spaceY);

                doc.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);
            }
            doc.save('بطاقات_الجلوس.pdf');
        } catch(error) {
            console.error('Error generating PDF:', error);
            alert('حدث خطأ أثناء توليد ملف الـ PDF');
        } finally {
            setExporting(false);
        }
    };

    const handleExportTablePDF = () => {
        const doc = new jsPDF();
        autoTable(doc, {
            head: [['رقم الجلوس', 'اسم الطالب', 'الصف', 'اللجنة']],
            body: students.map(s => [s.seatNumber?.toString() || '', s.name || '', s.grade || '', s.committee || '']),
            styles: { font: 'Courier', halign: 'right', fontSize: 10 },
            headStyles: { fillColor: [79, 70, 229] }
        });
        doc.save('بيانات_الطلاب_جدول.pdf');
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-700 font-alexandria pb-20">
            {/* ── Page Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2.5xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                            <CreditCard size={24} />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 font-header tracking-tight">بطاقات جلوس الطلاب</h1>
                    </div>
                    <p className="text-slate-400 font-medium text-sm flex items-center gap-2">
                        <Layout size={16} className="text-indigo-400" />
                        توليد وتخصيص بطاقات الجلوس الذكية وتصديرها طباعياً
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`flex items-center gap-3 px-6 py-4 rounded-3xl font-black text-sm transition-all shadow-sm border
                          ${showSettings ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-100' : 'bg-white text-slate-600 border-slate-100 hover:bg-slate-50'}`}
                    >
                        <Settings size={20} />
                        <span>أدوات الضبط</span>
                    </button>
                    
                    <button
                        onClick={handleExportCardsPDF}
                        disabled={exporting || loading}
                        className="px-6 py-4 bg-white text-slate-600 rounded-3xl font-black text-sm hover:bg-slate-50 transition-all shadow-sm border border-slate-100 flex items-center gap-3 disabled:opacity-50"
                    >
                        {exporting ? <RotateCcw size={20} className="animate-spin" /> : <Download size={20} className="text-blue-500" />}
                        <span>استخراج البطاقات</span>
                    </button>

                    <button
                        onClick={handlePrint}
                        className="px-8 py-4 bg-indigo-600 text-white rounded-3xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 flex items-center gap-3"
                    >
                        <Printer size={20} /> طباعة مباشرة
                    </button>
                </div>
            </div>

            {/* ── Settings Panel ── */}
            {showSettings && (
                <div className="luxury-card p-10 bg-white/80 backdrop-blur-xl border-white print:hidden animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-3">
                           <SlidersHorizontal size={24} className="text-indigo-500" />
                           <h3 className="text-xl font-black text-slate-900 font-header">ضبط أبعاد ومحتوى البطاقة</h3>
                        </div>
                        <button onClick={() => setShowSettings(false)} className="p-3 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-2xl transition-all">
                           <X size={20} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {['name', 'seatNumber', 'grade', 'committee'].map((field) => {
                            const labels = {
                                name: 'هوية الطالب',
                                seatNumber: 'رقم الجلوس',
                                grade: 'المرحلة والصف',
                                committee: 'مسمى اللجنة'
                            };
                            return (
                                <div key={field} className="space-y-6 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/50">
                                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-2">
                                       <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-indigo-400 border border-slate-100 shadow-sm">
                                          {field === 'name' ? <UserCircle2 size={16} /> : <FileText size={16} />}
                                       </div>
                                       <h4 className="font-black text-sm text-slate-700 uppercase tracking-tight">{labels[field]}</h4>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الموضع الرأسي</span>
                                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{config[field].top}%</span>
                                            </div>
                                            <input 
                                                type="range" min="0" max="100" step="0.5"
                                                value={config[field].top}
                                                onChange={(e) => handleConfigChange(field, 'top', e.target.value)}
                                                className="premium-range"
                                            />
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الموضع الأفقي</span>
                                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{config[field].right}%</span>
                                            </div>
                                            <input 
                                                type="range" min="0" max="100" step="0.5"
                                                value={config[field].right}
                                                onChange={(e) => handleConfigChange(field, 'right', e.target.value)}
                                                className="premium-range"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">حجم الخط</span>
                                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{config[field].fontSize}rem</span>
                                            </div>
                                            <input 
                                                type="range" min="0.5" max="3" step="0.1"
                                                value={config[field].fontSize}
                                                onChange={(e) => handleConfigChange(field, 'fontSize', e.target.value)}
                                                className="premium-range"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-10 flex justify-end">
                        <button 
                            onClick={() => {
                                if(confirm('هل أنت متأكد من استعادة التموضع الافتراضي للقالب؟')) {
                                    setAppConfig(prev => ({
                                        ...prev,
                                        seating: {
                                            name: { top: 45, right: 35, fontSize: 1.2 },
                                            seatNumber: { top: 25, right: 15, fontSize: 1.5 },
                                            grade: { top: 65, right: 30, fontSize: 1 },
                                            committee: { top: 80, right: 15, fontSize: 1 }
                                        }
                                    }));
                                }
                            }}
                            className="text-xs font-black text-rose-400 hover:text-rose-600 px-6 py-3 hover:bg-rose-50 rounded-2xl transition-all flex items-center gap-2 border border-dashed border-rose-100"
                        >
                            <RotateCcw size={14} /> استعادة ضبط المصنع للبطاقة
                        </button>
                    </div>
                </div>
            )}

            {/* ── Status Bar ── */}
            <div className="flex items-center justify-between px-8 py-4 bg-slate-900/5 rounded-3xl border border-slate-100 print:hidden">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-500" />
                        <span className="text-xs font-black text-slate-600 uppercase tracking-widest">الحالة: جاهز للتصدير</span>
                    </div>
                    <div className="h-4 w-[1px] bg-slate-200"></div>
                    <div className="flex items-center gap-2">
                        <UserCircle2 size={16} className="text-indigo-400" />
                        <span className="text-xs font-black text-slate-600 uppercase tracking-widest">إجمالي البطاقات: {students.length}</span>
                    </div>
                </div>
                <div className="text-[10px] font-black text-slate-400 opacity-60 uppercase tracking-[0.2em]">High Definition Printing Active</div>
            </div>

            {/* ── Grid of Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 print:block print:w-full">
                {loading ? (
                    <div className="col-span-full py-40 flex flex-col items-center justify-center opacity-20">
                        <Layout size={64} className="animate-pulse mb-4 text-slate-400" />
                        <p className="font-black text-xl text-slate-600">جاري مسح قواعد البيانات وتوليد البطاقات...</p>
                    </div>
                ) : students.length === 0 ? (
                    <div className="col-span-full luxury-card py-24 text-center">
                        <UserCircle2 size={48} className="mx-auto mb-4 text-slate-200" />
                        <p className="text-slate-500 font-black text-lg">لا يوجد طلاب مسجلين حالياً لتوليد بطاقاتهم</p>
                    </div>
                ) : students.map((student) => (
                    <div
                        key={student.id}
                        className="card-container card-to-print relative overflow-hidden rounded-[2rem] shadow-premium bg-white group hover:-translate-y-2 transition-all duration-500 active:scale-95 cursor-pointer border-none print:shadow-none print:w-[48%] print:inline-block print:m-[1%] print:page-break-inside-avoid print:border"
                        style={{
                            aspectRatio: '1.6',
                            backgroundImage: "url('/school_logo.jpg')",
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-referrer'
                        }}
                    >
                        {/* Overlay Gradient for interactivity */}
                        <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 transition-colors z-0"></div>

                        {/* Name Field */}
                        <div 
                            className="absolute font-black text-slate-900 whitespace-nowrap z-10 font-header"
                            style={{ top: `${config.name.top}%`, right: `${config.name.right}%`, fontSize: `${config.name.fontSize}rem`, transform: 'translateY(-50%)' }}
                        >
                            {student.name}
                        </div>

                        {/* Seat Number Field */}
                        <div 
                            className="absolute font-black text-indigo-700 whitespace-nowrap z-10 font-header drop-shadow-sm"
                            style={{ top: `${config.seatNumber.top}%`, right: `${config.seatNumber.right}%`, fontSize: `${config.seatNumber.fontSize}rem`, transform: 'translateY(-50%)' }}
                        >
                            {student.seatNumber}
                        </div>

                        {/* Grade Field */}
                        <div 
                            className="absolute font-black text-slate-700 whitespace-nowrap z-10 font-header"
                            style={{ top: `${config.grade?.top || 65}%`, right: `${config.grade?.right || 30}%`, fontSize: `${config.grade?.fontSize || 1}rem`, transform: 'translateY(-50%)' }}
                        >
                            {student.grade}
                        </div>

                        {/* Committee Field */}
                        {student.committee && (
                            <div 
                                className="absolute font-black text-emerald-800 whitespace-nowrap z-10 font-header"
                                style={{ top: `${config.committee?.top || 80}%`, right: `${config.committee?.right || 15}%`, fontSize: `${config.committee?.fontSize || 1}rem`, transform: 'translateY(-50%)' }}
                            >
                                {student.committee}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <style>{`
                .premium-range {
                  -webkit-appearance: none;
                  width: 100%;
                  height: 6px;
                  background: #f1f5f9;
                  border-radius: 5px;
                  outline: none;
                  transition: all .2s;
                }
                .premium-range::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 18px;
                  height: 18px;
                  background: #4f46e5;
                  border-radius: 50%;
                  cursor: pointer;
                  box-shadow: 0 0 10px rgba(79, 70, 229, 0.4);
                  border: 3px solid white;
                  transition: all .2s;
                }
                .premium-range::-webkit-slider-thumb:hover {
                   transform: scale(1.2);
                   box-shadow: 0 0 15px rgba(79, 70, 229, 0.6);
                }

                @media print {
                  @page { size: A4 portrait; margin: 10mm; }
                  body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                  aside, footer, nav, header:not(.print-header), .print-hidden { display: none !important; }
                  main { padding: 0 !important; margin: 0 !important; }
                  .card-container {
                    break-inside: avoid;
                    page-break-inside: avoid;
                  }
                }
            `}</style>
        </div>
    );
};

export default SeatingCards;
