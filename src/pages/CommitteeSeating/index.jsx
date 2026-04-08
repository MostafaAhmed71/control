import React, { useState, useEffect } from 'react';
import { Printer, Settings, Download, FileText, FileDown } from 'lucide-react';
import { getStudents } from '../../utils/dataService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const CommitteeSeating = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [selectedRowIdx, setSelectedRowIdx] = useState(0);
    const [selectedStage, setSelectedStage] = useState('الكل');
    const [selectedGrade, setSelectedGrade] = useState('الكل');
    const [selectedCommittee, setSelectedCommittee] = useState('الكل');
    
    // Default or saved configuration
    const [config, setConfig] = useState(() => {
        const saved = localStorage.getItem('committeeSeatingConfig2');
        const defaultConfig = {
            headerCommittee: { top: 16.5, right: 33, fontSize: 1.2, show: true },
            headerGrade: { top: 16.5, right: 65, fontSize: 1.1, show: true },
            headerCount: { top: 16.5, right: 88, fontSize: 1.2, show: true },
            table: { 
                startTop: 28, 
                rowHeight: 3.5, 
                indexRight: 7, indexTop: 0, indexShow: true,
                seatRight: 23, seatTop: 0, seatShow: true,
                nameRight: 55, nameTop: 0, nameShow: true,
                gradeRight: 85, gradeTop: 0, gradeShow: true,
                fontSize: 0.9,
                rowOverrides: {} 
            },
            maxRows: 20
        };

        if (!saved) return defaultConfig;
        
        const parsed = JSON.parse(saved);
        // Merge with defaults to ensure new properties exist
        return {
            ...defaultConfig,
            ...parsed,
            headerCommittee: { ...defaultConfig.headerCommittee, ...parsed.headerCommittee },
            headerGrade: { ...defaultConfig.headerGrade, ...parsed.headerGrade },
            headerCount: { ...defaultConfig.headerCount, ...parsed.headerCount },
            table: { 
                ...defaultConfig.table, 
                ...parsed.table,
                rowOverrides: parsed.table?.rowOverrides || {}
            }
        };
    });

    useEffect(() => {
        fetchStudents();
    }, []);

    // Save config on change
    useEffect(() => {
        localStorage.setItem('committeeSeatingConfig2', JSON.stringify(config));
    }, [config]);

    const handleConfigChange = (section, prop, value, isChecked = null) => {
        if (section === 'maxRows') {
            setConfig(prev => ({ ...prev, maxRows: parseInt(value) || 1 }));
            return;
        }

        if (section === 'rowOverride') {
            const { idx, field } = prop;
            const val = parseFloat(value);
            setConfig(prev => ({
                ...prev,
                table: {
                    ...prev.table,
                    rowOverrides: {
                        ...prev.table.rowOverrides,
                        [idx]: {
                            ...(prev.table.rowOverrides[idx] || { top: 0, right: 0, fontSize: 0 }),
                            [field]: val
                        }
                    }
                }
            }));
            return;
        }

        const finalValue = isChecked !== null ? isChecked : parseFloat(value);

        setConfig(prev => ({
            ...prev,
            [section]: { ...prev[section], [prop]: finalValue }
        }));
    };

    const fetchStudents = async () => {
        const data = await getStudents();
        setStudents(data);
        setLoading(false);
    };

    const handlePrint = () => {
        window.print();
    };

    const chunkArray = (arr, size) => {
        const chunked = [];
        for (let i = 0; i < arr.length; i += size) {
            chunked.push(arr.slice(i, i + size));
        }
        return chunked;
    };

    // Cascading resets
    useEffect(() => {
        setSelectedGrade('الكل');
        setSelectedCommittee('الكل');
    }, [selectedStage]);

    useEffect(() => {
        setSelectedCommittee('الكل');
    }, [selectedGrade]);

    const stages = ['الكل', ...new Set(students.map(s => s.stage).filter(Boolean))];
    
    const availableGrades = [...new Set(students
        .filter(s => selectedStage === 'الكل' || s.stage === selectedStage)
        .map(s => s.grade)
        .filter(Boolean))];
    const grades = ['الكل', ...availableGrades];

    const availableCommittees = [...new Set(students
        .filter(s => selectedStage === 'الكل' || s.stage === selectedStage)
        .filter(s => selectedGrade === 'الكل' || s.grade === selectedGrade)
        .map(s => s.committee)
        .filter(Boolean))];
    const committees = ['الكل', ...availableCommittees];

    const filteredStudents = students.filter(s => {
        const matchStage = selectedStage === 'الكل' || s.stage === selectedStage;
        const matchGrade = selectedGrade === 'الكل' || s.grade === selectedGrade;
        const matchCommittee = selectedCommittee === 'الكل' || s.committee === selectedCommittee;
        return matchStage && matchGrade && matchCommittee;
    });

    const getCommitteesData = () => {
        const grouped = {};
        filteredStudents.forEach(s => {
            if (!grouped[s.committee]) {
                grouped[s.committee] = [];
            }
            grouped[s.committee].push(s);
        });

        const pages = [];
        Object.keys(grouped).sort((a,b) => a.localeCompare(b, undefined, {numeric: true})).forEach(committeeId => {
            const committeeStudents = grouped[committeeId];
            const max = config.maxRows || 20;
            const chunks = chunkArray(committeeStudents, max);
            
            // Gather grades for header
            const gradesSet = new Set(committeeStudents.map(s => s.grade).filter(Boolean));
            const gradeText = Array.from(gradesSet).join(' و ') || 'غير محدد';
            
            chunks.forEach((chunk, chunkIndex) => {
                pages.push({
                    id: `${committeeId}-${chunkIndex}`,
                    committee: committeeId,
                    grade: gradeText,
                    totalCount: committeeStudents.length,
                    pageIndex: chunkIndex + 1,
                    totalPages: chunks.length,
                    globalStartIndex: chunkIndex * max, // For index numbering
                    students: chunk
                });
            });
        });

        return pages;
    };

    const handleExportCardsPDF = async () => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pages = document.querySelectorAll('.page-to-print');
        
        if (pages.length === 0) return;
        setIsExporting(true);
        try {
            // A4 size: ~210 x 297 mm
            const pdfWidth = 210;
            const pdfHeight = 297;

            for (let i = 0; i < pages.length; i++) {
                // scale: 2 for better resolution
                const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/jpeg', 0.95);

                if (i > 0) {
                    doc.addPage();
                }

                doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }
            doc.save('كشوف_اللجان.pdf');
        } catch(error) {
            console.error('Error generating PDF:', error);
            alert('حدث خطأ أثناء توليد ملف الـ PDF');
        } finally {
            setIsExporting(false);
        }
    };

    const pagesData = getCommitteesData();

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">طباعة كشوف اللجان</h1>
                    <p className="text-gray-500 text-sm mt-1">توليد كشوف بأرقام جلوس اللجان مع القالب المخصص</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        disabled={loading || isExporting}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition-all font-medium ${
                            showSettings ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <Settings size={18} />
                        <span>الإعدادات ⚙️</span>
                    </button>
                    
                    <button
                        onClick={handleExportCardsPDF}
                        disabled={loading || isExporting}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-100 transition-all font-medium disabled:opacity-50"
                    >
                        <FileDown size={18} />
                        <span>{isExporting ? 'جاري التحميل...' : 'تحميل بصيغة (PDF)'}</span>
                    </button>

                    <button
                        onClick={handlePrint}
                        disabled={loading || isExporting}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    >
                        <Printer size={18} />
                        <span>طباعة مباشرة</span>
                    </button>
                </div>
            </div>

            <div className="glass-morphism rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:hidden bg-white mb-2">
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-600">المرحلة:</label>
                        <select
                            className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                            value={selectedStage}
                            onChange={(e) => setSelectedStage(e.target.value)}
                        >
                            {stages.map(s => <option key={s} value={s}>{s === 'الكل' ? 'جميع المراحل' : s}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-600">الصف:</label>
                        <select
                            className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                            value={selectedGrade}
                            onChange={(e) => setSelectedGrade(e.target.value)}
                        >
                            {grades.map(g => <option key={g} value={g}>{g === 'الكل' ? 'جميع الصفوف' : g}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-600">اللجنة:</label>
                        <select
                            className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                            value={selectedCommittee}
                            onChange={(e) => setSelectedCommittee(e.target.value)}
                        >
                            {committees.map(c => <option key={c} value={c}>{c === 'الكل' ? 'جميع اللجان' : `لجنة ${c}`}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {showSettings && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 print:hidden animate-in fade-in slide-in-from-top-4 flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-gray-100 bg-indigo-50/50 p-4 rounded-xl">
                        <div>
                            <h3 className="text-lg font-bold text-indigo-900">إعدادات الصفحة العامة</h3>
                            <p className="text-xs text-indigo-600 mt-1">اضبط سعة الصفحة وقم بالتبديل بين الصفوف لتنسيقها</p>
                        </div>
                        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-indigo-100 shadow-sm">
                            <label className="text-sm font-bold text-gray-700 whitespace-nowrap">عدد الطلاب في الصفحة الواحد:</label>
                            <input 
                                type="number" 
                                min="1" max="100"
                                value={config.maxRows}
                                onChange={(e) => handleConfigChange('maxRows', null, e.target.value)}
                                className="w-16 px-2 py-1 border border-indigo-200 rounded text-center font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                        {/* Headers */}
                        {['headerCommittee', 'headerGrade', 'headerCount'].map((field) => {
                            const labels = {
                                headerCommittee: 'ترويسة: رقم اللجنة',
                                headerGrade: 'ترويسة: الصف',
                                headerCount: 'ترويسة: عدد الطلاب'
                            };
                            return (
                                <div key={field} className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                        <h4 className="font-bold text-indigo-700">{labels[field]}</h4>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <span className="text-xs text-gray-500 font-medium">إظهار</span>
                                            <input 
                                                type="checkbox" 
                                                checked={config[field].show}
                                                onChange={(e) => handleConfigChange(field, 'show', null, e.target.checked)}
                                                className="w-4 h-4 accent-indigo-600 rounded"
                                            />
                                        </label>
                                    </div>
                                    
                                    <div className={!config[field].show ? 'opacity-40 pointer-events-none' : ''}>
                                        <div className="mb-3">
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
                                        
                                        <div className="mb-3">
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
                                </div>
                            );
                        })}

                        {/* Table general config */}
                        <div className="space-y-4 bg-indigo-50 p-4 rounded-xl border border-indigo-100 md:col-span-2 xl:col-span-1">
                            <h4 className="font-bold text-indigo-800 border-b border-indigo-200 pb-2">إعدادات الجدول العامة</h4>
                            
                            <div className="grid grid-cols-2 gap-4 xl:grid-cols-1">
                                <div>
                                    <label className="text-xs text-gray-600 font-medium flex justify-between mb-1">
                                        <span>بداية الجدول (من أعلى)</span>
                                        <span className="text-gray-500">{config.table.startTop}%</span>
                                    </label>
                                    <input 
                                        type="range" min="0" max="100" step="0.5"
                                        value={config.table.startTop}
                                        onChange={(e) => handleConfigChange('table', 'startTop', e.target.value)}
                                        className="w-full accent-indigo-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                
                                <div>
                                    <label className="text-xs text-gray-600 font-medium flex justify-between mb-1">
                                        <span>ارتفاع الصف (Height)</span>
                                        <span className="text-gray-500">{config.table.rowHeight}%</span>
                                    </label>
                                    <input 
                                        type="range" min="1" max="10" step="0.1"
                                        value={config.table.rowHeight}
                                        onChange={(e) => handleConfigChange('table', 'rowHeight', e.target.value)}
                                        className="w-full accent-indigo-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-gray-600 font-medium flex justify-between mb-1">
                                        <span>حجم خط الجدول</span>
                                        <span className="text-gray-500">{config.table.fontSize}rem</span>
                                    </label>
                                    <input 
                                        type="range" min="0.5" max="2" step="0.05"
                                        value={config.table.fontSize}
                                        onChange={(e) => handleConfigChange('table', 'fontSize', e.target.value)}
                                        className="w-full accent-emerald-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* Row Specific Overrides */}
                        <div className="space-y-4 bg-pink-50 p-4 rounded-xl border border-pink-100 md:col-span-2 xl:col-span-4 flex flex-col">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-pink-200 pb-2">
                                <h4 className="font-bold text-pink-800 flex items-center gap-2">
                                    <span className="bg-pink-200 text-pink-800 w-6 h-6 flex items-center justify-center rounded-full text-xs">!</span>
                                    ضبط كل صف على حدة (Individual Row Adjust)
                                </h4>
                                <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-pink-100">
                                    <span className="text-xs font-bold text-gray-600">اختر رقم الطالب لتعديله:</span>
                                    <select 
                                        className="text-sm font-bold text-pink-600 outline-none cursor-pointer"
                                        value={selectedRowIdx}
                                        onChange={(e) => setSelectedRowIdx(parseInt(e.target.value))}
                                    >
                                        {Array.from({ length: config.maxRows }).map((_, i) => (
                                            <option key={i} value={i}>الطالب رقم {i + 1}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                                {['top', 'right', 'fontSize'].map(field => {
                                    const labels = { top: 'إزاحة رأسية (Top)', right: 'إزاحة أفقية (Right)', fontSize: 'تعديل حجم الخط' };
                                    const colors = { top: 'accent-pink-500', right: 'accent-indigo-500', fontSize: 'accent-emerald-500' };
                                    const value = config.table.rowOverrides[selectedRowIdx]?.[field] || 0;
                                    const isFont = field === 'fontSize';

                                    return (
                                        <div key={field} className="bg-white p-3 rounded-xl border border-pink-50 shadow-sm">
                                            <label className="text-xs text-gray-500 font-bold flex justify-between mb-2">
                                                <span>{labels[field]}</span>
                                                <span className="text-pink-600">{value > 0 ? `+${value}` : value}{isFont ? 'rem' : '%'}</span>
                                            </label>
                                            <input 
                                                type="range" 
                                                min={isFont ? -0.5 : -5} 
                                                max={isFont ? 1 : 5} 
                                                step={isFont ? 0.05 : 0.1}
                                                value={value}
                                                onChange={(e) => handleConfigChange('rowOverride', { idx: selectedRowIdx, field }, e.target.value)}
                                                className={`w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer ${colors[field]}`}
                                            />
                                            <div className="flex justify-between text-[8px] text-gray-300 mt-1 font-bold">
                                                <span>{isFont ? '-0.5rem' : '-5%'}</span>
                                                <span>إزاحة مخصصة للطالب {selectedRowIdx + 1}</span>
                                                <span>{isFont ? '+1rem' : '+5%'}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Table Columns Detailed Controls */}
                        <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100 md:col-span-2 xl:col-span-4 flex flex-col">
                            <h4 className="font-bold text-indigo-700 border-b border-gray-200 pb-2 w-full text-right">تحريك وتبديل أعمدة الجدول (شامل لكل الصفوف)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-6 w-full">
                                {[
                                    { id: 'index', label: 'التسلسل (م)' },
                                    { id: 'seat', label: 'رقم الجلوس' },
                                    { id: 'name', label: 'اسم الطالب' },
                                    { id: 'grade', label: 'الصف' }
                                ].map(col => (
                                    <div key={col.id} className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-sm font-bold text-gray-700">{col.label}</span>
                                            <input 
                                                type="checkbox" 
                                                checked={config.table[`${col.id}Show`]}
                                                onChange={(e) => handleConfigChange('table', `${col.id}Show`, null, e.target.checked)}
                                                className="w-4 h-4 accent-indigo-600 rounded"
                                            />
                                        </div>
                                        <div className={!config.table[`${col.id}Show`] ? 'opacity-30 pointer-events-none' : ''}>
                                            <div className="mb-2">
                                                <label className="text-[10px] text-gray-400 font-bold flex justify-between">
                                                    <span>إزاحة يمين</span>
                                                    <span>{config.table[`${col.id}Right`]}%</span>
                                                </label>
                                                <input 
                                                    type="range" min="0" max="100" step="0.5" 
                                                    value={config.table[`${col.id}Right`]}
                                                    onChange={(e) => handleConfigChange('table', `${col.id}Right`, e.target.value)}
                                                    className="w-full accent-indigo-500 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400 font-bold flex justify-between">
                                                    <span>إزاحة رأسية</span>
                                                    <span>{config.table[`${col.id}Top`]}%</span>
                                                </label>
                                                <input 
                                                    type="range" min="-5" max="5" step="0.1" 
                                                    value={config.table[`${col.id}Top`]}
                                                    onChange={(e) => handleConfigChange('table', `${col.id}Top`, e.target.value)}
                                                    className="w-full accent-pink-500 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                    
                    <div className="flex justify-end pt-2">
                        <button 
                            onClick={() => {
                                if(confirm('هل أنت متأكد من استعادة الإعدادات الافتراضية؟')) {
                                    localStorage.removeItem('committeeSeatingConfig2');
                                    window.location.reload();
                                }
                            }}
                            className="text-sm text-red-500 hover:text-red-700 font-medium px-4 py-2 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            إرجاع للإعدادات الافتراضية
                        </button>
                    </div>
                </div>
            )}

            {/* Render Output Container */}
            <div className="bg-gray-100 p-2 md:p-8 rounded-2xl flex flex-col items-center gap-8 print:block print:p-0 print:bg-white overflow-hidden w-full">
                {loading ? (
                    <div className="text-center py-20 text-gray-500 font-medium">جاري تجهيز الكشوف...</div>
                ) : pagesData.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 font-medium bg-white w-full rounded-xl">لا يوجد طلاب متوفرين لتوليد الكشوف.</div>
                ) : pagesData.map((page) => (
                    <div
                        key={page.id}
                        className="page-to-print relative bg-white shadow-xl mx-auto border border-gray-200 print:shadow-none print:border-none print:m-0"
                        style={{
                            width: '210mm',         // A4 width
                            height: '297mm',        // A4 height
                            backgroundImage: "url('/form_template.jpg')",
                            backgroundSize: '100% 100%',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                            pageBreakAfter: 'always',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Headers */}
                        {config.headerCommittee.show && (
                            <div 
                                className="absolute font-bold text-gray-900 w-auto text-right"
                                style={{ top: `${config.headerCommittee.top}%`, right: `${config.headerCommittee.right}%`, fontSize: `${config.headerCommittee.fontSize}rem`, transform: 'translateY(-50%)' }}
                            >
                                {page.committee}
                            </div>
                        )}
                        {config.headerGrade.show && (
                            <div 
                                className="absolute font-bold text-gray-900 w-auto text-center"
                                style={{ top: `${config.headerGrade.top}%`, right: `${config.headerGrade.right}%`, fontSize: `${config.headerGrade.fontSize}rem`, transform: 'translateY(-50%) translateX(50%)' }}
                            >
                                {page.grade}
                            </div>
                        )}
                        {config.headerCount.show && (
                            <div 
                                className="absolute font-bold text-gray-900 w-auto text-center"
                                style={{ top: `${config.headerCount.top}%`, right: `${config.headerCount.right}%`, fontSize: `${config.headerCount.fontSize}rem`, transform: 'translateY(-50%) translateX(50%)' }}
                            >
                                {page.totalCount}
                            </div>
                        )}

                        {/* Table Rows Wrapper */}
                        <div 
                            className="absolute w-full h-full font-semibold text-gray-900"
                            style={{ top: `${config.table.startTop}%`, fontSize: `${config.table.fontSize}rem` }}
                        >
                            {page.students.map((student, idx) => {
                                const rowOverride = config.table.rowOverrides[idx] || {};
                                const rowTop = rowOverride.top || 0;
                                const rowRight = rowOverride.right || 0;
                                const rowFont = rowOverride.fontSize || 0;
                                const rowStyle = { fontSize: `${config.table.fontSize + rowFont}rem` };

                                return (
                                    <React.Fragment key={student.id}>
                                        {/* Index */}
                                        {config.table.indexShow && (
                                            <div 
                                                className="absolute text-center whitespace-nowrap pt-[2px]"
                                                style={{ 
                                                    ...rowStyle,
                                                    top: `calc(${idx * config.table.rowHeight}% + ${config.table.indexTop + rowTop}%)`, 
                                                    right: `${config.table.indexRight + rowRight}%`, 
                                                    transform: 'translateX(50%)' 
                                                }}
                                            >
                                                {page.globalStartIndex + idx + 1}
                                            </div>
                                        )}
                                        {/* Seat Number */}
                                        {config.table.seatShow && (
                                            <div 
                                                className="absolute text-center whitespace-nowrap pt-[2px]"
                                                style={{ 
                                                    ...rowStyle,
                                                    top: `calc(${idx * config.table.rowHeight}% + ${config.table.seatTop + rowTop}%)`, 
                                                    right: `${config.table.seatRight + rowRight}%`, 
                                                    transform: 'translateX(50%)' 
                                                }}
                                            >
                                                {student.seatNumber}
                                            </div>
                                        )}
                                        {/* Name */}
                                        {config.table.nameShow && (
                                            <div 
                                                className="absolute text-right whitespace-nowrap pt-[2px]"
                                                style={{ 
                                                    ...rowStyle,
                                                    top: `calc(${idx * config.table.rowHeight}% + ${config.table.nameTop + rowTop}%)`, 
                                                    right: `${config.table.nameRight + rowRight}%` 
                                                }}
                                            >
                                                {student.name}
                                            </div>
                                        )}
                                        {/* Grade */}
                                        {config.table.gradeShow && (
                                            <div 
                                                className="absolute text-center whitespace-nowrap pt-[2px]"
                                                style={{ 
                                                    ...rowStyle,
                                                    top: `calc(${idx * config.table.rowHeight}% + ${config.table.gradeTop + rowTop}%)`, 
                                                    right: `${config.table.gradeRight + rowRight}%`, 
                                                    transform: 'translateX(50%)' 
                                                }}
                                            >
                                                {student.grade}
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    @page { size: A4 portrait; margin: 0; }
                    body { background: white !important; margin: 0; padding: 0; }
                    .mr-64 { margin-right: 0 !important; }
                    aside, header, nav, button, .print\\:hidden { display: none !important; }
                    main { padding: 0 !important; margin: 0 !important; }
                    
                    .page-to-print {
                        width: 210mm !important;
                        height: 297mm !important;
                        page-break-after: always;
                    }
                    .md\\:p-8 { padding: 0 !important; }
                    .bg-gray-100 { background: white !important; }
                }
            `}} />
        </div>
    );
};

export default CommitteeSeating;
