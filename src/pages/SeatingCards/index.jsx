import React, { useState, useEffect } from 'react';
import { Printer, CreditCard, Search, Filter, Download, FileText, FileDown, Settings } from 'lucide-react';
import { getStudents, getAppSettings, saveAppSettings } from '../../utils/dataService';

const SeatingCards = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [appConfig, setAppConfig] = useState(null);
    
    useEffect(() => {
        const init = async () => {
            const data = await getAppSettings();
            setAppConfig(data);
            await fetchStudents();
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

    const fetchStudents = async () => {
        const data = await getStudents();
        setStudents(data);
        setLoading(false);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportCardsPDF = async () => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const cards = document.querySelectorAll('.card-to-print');
        
        if (cards.length === 0) return;
        setLoading(true);
        try {
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
            setLoading(false);
        }
    };

    const handleExportTablePDF = () => {
        const doc = new jsPDF();
        
        // Add Arabic Font support if possible, but jsPDF standard doesn't support Arabic easily without a custom VFS font.
        // As a workaround for Arabic in jsPDF, we often need a custom font. For now, since autoTable has limited RTL support, 
        // we will generate it. Users might see inverted text or disjointed letters unless a proper font is set.
        // However, a simple implementation first:
        doc.addFont('Courier', 'Courier', 'normal');
        
        // Since standard jsPDF doesn't cleanly support Arabic strings out-of-the-box without setup, 
        // a table might need to be rendered using an HTML table and html2canvas, then sent to pdf.
        // Let's use the jsPDF-autotable with standard text. It may show disconnected arabic letters.
        // To fix this perfectly, we'd need to inject a base64 font, but let's provide the basic structure first.
        
        autoTable(doc, {
            head: [['Seat Number', 'Name', 'Grade', 'Committee']],
            body: students.map(s => [s.seatNumber?.toString() || '', s.name || '', s.grade || '', s.committee || '']),
            styles: { font: 'helvetica', halign: 'right' }
        });
        
        doc.save('بيانات_الطلاب_جدول.pdf');
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">بطاقات الجلوس</h1>
                    <p className="text-gray-500 text-sm mt-1">توليد البطاقات بالتصميم المخصص وتصديرها</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        disabled={loading}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition-all font-medium ${
                            showSettings ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <Settings size={18} />
                        <span>الإعدادات</span>
                    </button>
                    <button
                        onClick={handleExportTablePDF}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-all font-medium disabled:opacity-50"
                    >
                        <FileText size={18} />
                        <span>جدول الطلاب (PDF)</span>
                    </button>
                    
                    <button
                        onClick={handleExportCardsPDF}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-100 transition-all font-medium disabled:opacity-50"
                    >
                        <FileDown size={18} />
                        <span>تحميل البطاقات (PDF)</span>
                    </button>

                    <button
                        onClick={handlePrint}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    >
                        <Printer size={18} />
                        <span>طباعة مباشرة</span>
                    </button>
                </div>
            </div>

            {showSettings && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 print:hidden animate-in fade-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">ضبط إحداثيات وأحجام النصوص</h3>
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
                                <div key={field} className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <h4 className="font-bold text-indigo-700 border-b border-gray-200 pb-2">{labels[field]}</h4>
                                    
                                    <div>
                                        <label className="text-xs text-gray-500 font-medium flex justify-between mb-1">
                                            <span>أعلى/أسفل (Top)</span>
                                            <span className="text-gray-400">{config[field].top}%</span>
                                        </label>
                                        <input 
                                            type="range" min="0" max="100" step="0.5"
                                            value={config[field].top}
                                            onChange={(e) => handleConfigChange(field, 'top', e.target.value)}
                                            className="w-full accent-indigo-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs text-gray-500 font-medium flex justify-between mb-1">
                                            <span>يمين/يسار (Right)</span>
                                            <span className="text-gray-400">{config[field].right}%</span>
                                        </label>
                                        <input 
                                            type="range" min="0" max="100" step="0.5"
                                            value={config[field].right}
                                            onChange={(e) => handleConfigChange(field, 'right', e.target.value)}
                                            className="w-full accent-indigo-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-gray-500 font-medium flex justify-between mb-1">
                                            <span>حجم الخط</span>
                                            <span className="text-gray-400">{config[field].fontSize}rem</span>
                                        </label>
                                        <input 
                                            type="range" min="0.5" max="3" step="0.1"
                                            value={config[field].fontSize}
                                            onChange={(e) => handleConfigChange(field, 'fontSize', e.target.value)}
                                            className="w-full accent-emerald-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button 
                            onClick={() => {
                                if(confirm('هل أنت متأكد من استعادة الإعدادات الافتراضية؟')) {
                                    setConfig({
                                        name: { top: 45, right: 35, fontSize: 1.2 },
                                        seatNumber: { top: 25, right: 15, fontSize: 1.5 },
                                        grade: { top: 65, right: 30, fontSize: 1 },
                                        committee: { top: 80, right: 15, fontSize: 1 }
                                    });
                                }
                            }}
                            className="text-sm text-red-500 hover:text-red-700 font-medium px-4 py-2 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            استعادة الافتراضي
                        </button>
                    </div>
                </div>
            )}

            {/* Grid of Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:block print:w-full">
                {loading ? (
                    <div className="col-span-full text-center py-20 text-gray-400 font-medium">جاري تجهيز البيانات...</div>
                ) : students.map((student) => (
                    <div
                        key={student.id}
                        className="card-container card-to-print relative overflow-hidden rounded-xl shadow-sm border border-gray-200 bg-white print:border-solid print:border print:rounded-none print:w-[48%] print:inline-block print:m-[1%] print:page-break-inside-avoid"
                        style={{
                            aspectRatio: '1.6',
                            backgroundImage: "url('/school_logo.jpg')",
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-referrer'
                        }}
                    >
                        {/* 
                            These absolute positions are placeholders. 
                            You can easily adjust 'top', 'right', 'left', 'bottom' percentages 
                            to make the text fit exactly within your image's blank spaces.
                            For Arabic (RTL), using 'right' is usually preferred over 'left'.
                        */}
                        
                        {/* Name Field */}
                        <div 
                            className="absolute font-bold text-gray-900 whitespace-nowrap"
                            style={{ top: `${config.name.top}%`, right: `${config.name.right}%`, fontSize: `${config.name.fontSize}rem`, transform: 'translateY(-50%)' }}
                        >
                            {student.name}
                        </div>

                        {/* Seat Number Field */}
                        <div 
                            className="absolute font-black text-indigo-700 whitespace-nowrap"
                            style={{ top: `${config.seatNumber.top}%`, right: `${config.seatNumber.right}%`, fontSize: `${config.seatNumber.fontSize}rem`, transform: 'translateY(-50%)' }}
                        >
                            {student.seatNumber}
                        </div>

                        {/* Grade Field */}
                        <div 
                            className="absolute font-semibold text-gray-800 whitespace-nowrap"
                            style={{ top: `${config.grade?.top || 65}%`, right: `${config.grade?.right || 30}%`, fontSize: `${config.grade?.fontSize || 1}rem`, transform: 'translateY(-50%)' }}
                        >
                            {student.grade}
                        </div>

                        {/* Committee Field */}
                        {student.committee && (
                            <div 
                                className="absolute font-bold text-emerald-800 whitespace-nowrap"
                                style={{ top: `${config.committee?.top || 80}%`, right: `${config.committee?.right || 15}%`, fontSize: `${config.committee?.fontSize || 1}rem`, transform: 'translateY(-50%)' }}
                            >
                                {student.committee}
                            </div>
                        )}
                        
                    </div>
                ))}
            </div>

            <style>{`
        @media print {
          body { background: white !important; }
          .mr-64 { margin-right: 0 !important; }
          aside, header, nav, button { display: none !important; }
          main { padding: 0 !important; }
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
