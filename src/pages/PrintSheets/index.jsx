import React, { useState, useEffect } from 'react';
import { Printer, FileText, Search, Download, Users, SlidersHorizontal, ChevronRight, Layout, CheckCircle2 } from 'lucide-react';
import { getStudents, getAppSettings } from '../../utils/dataService';

const PrintSheets = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStage, setSelectedStage] = useState('الكل');
    const [selectedGrade, setSelectedGrade] = useState('الكل');
    const [selectedCommittee, setSelectedCommittee] = useState('الكل');
    const [appConfig, setAppConfig] = useState(null);

    useEffect(() => {
        const init = async () => {
            const config = await getAppSettings();
            setAppConfig(config);
            await fetchStudents();
        };
        init();
    }, []);

    const fetchStudents = async () => {
        const data = await getStudents();
        setStudents(data);
        setLoading(false);
    };

    // Cascading resets
    useEffect(() => {
        setSelectedGrade('الكل');
        setSelectedCommittee('الكل');
    }, [selectedStage]);

    useEffect(() => {
        setSelectedCommittee('الكل');
    }, [selectedGrade]);

    // Derived options
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

    // Filter students
    const filteredStudents = students.filter(s => {
        const matchStage = selectedStage === 'الكل' || s.stage === selectedStage;
        const matchGrade = selectedGrade === 'الكل' || s.grade === selectedGrade;
        const matchCommittee = selectedCommittee === 'الكل' || s.committee === selectedCommittee;
        return matchStage && matchGrade && matchCommittee;
    });

    // Group by committee for rendering
    const groupedByCommittee = filteredStudents.reduce((acc, student) => {
        const committee = student.committee || 'غير محدد';
        if (!acc[committee]) {
            acc[committee] = [];
        }
        acc[committee].push(student);
        return acc;
    }, {});

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-700 font-alexandria pb-20">
            {/* ── Page Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2.5xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                            <Printer size={24} />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 font-header tracking-tight">كشوف طباعة اللجان</h1>
                    </div>
                    <p className="text-slate-400 font-medium text-sm flex items-center gap-2">
                        <Users size={16} className="text-indigo-400" />
                        تجهيز واعتماد قوائم الطلاب وتصنيفها آلياً حسب اللجان
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button className="px-6 py-4 bg-white text-slate-600 rounded-3xl font-black text-sm hover:bg-slate-50 transition-all shadow-sm border border-slate-100 flex items-center gap-3">
                        <Download size={20} className="text-indigo-500" /> تصدير PDF
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-8 py-4 bg-indigo-600 text-white rounded-3xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 flex items-center gap-3"
                    >
                        <Printer size={20} /> بدء الطباعة الفورية
                    </button>
                </div>
            </div>

            {/* ── Dynamic Filters ── */}
            <div className="luxury-card p-2 bg-white/60 backdrop-blur-xl border-white print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                    <div className="flex items-center gap-4 px-6 py-4 bg-slate-50/50 rounded-2.5xl">
                       <Layout size={20} className="text-indigo-400" />
                       <div className="flex-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">المرحلة الدراسية</span>
                          <select
                              className="w-full bg-transparent font-black text-sm text-slate-800 outline-none border-none p-0 cursor-pointer"
                              value={selectedStage}
                              onChange={(e) => setSelectedStage(e.target.value)}
                          >
                              {stages.map(s => <option key={s} value={s}>{s === 'الكل' ? 'جميع المراحل المتاحة' : s}</option>)}
                          </select>
                       </div>
                    </div>

                    <div className="flex items-center gap-4 px-6 py-4 bg-slate-50/50 rounded-2.5xl">
                       <SlidersHorizontal size={20} className="text-violet-400" />
                       <div className="flex-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">الصف الدراسي</span>
                          <select
                              className="w-full bg-transparent font-black text-sm text-slate-800 outline-none border-none p-0 cursor-pointer"
                              value={selectedGrade}
                              onChange={(e) => setSelectedGrade(e.target.value)}
                          >
                              {grades.map(g => <option key={g} value={g}>{g === 'الكل' ? 'جميع الصفوف المختارة' : g}</option>)}
                          </select>
                       </div>
                    </div>

                    <div className="flex items-center gap-4 px-6 py-4 bg-slate-50/50 rounded-2.5xl">
                       <CheckCircle2 size={20} className="text-emerald-400" />
                       <div className="flex-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">اللجنة المختارة</span>
                          <select
                              className="w-full bg-transparent font-black text-sm text-slate-800 outline-none border-none p-0 cursor-pointer"
                              value={selectedCommittee}
                              onChange={(e) => setSelectedCommittee(e.target.value)}
                          >
                              {committees.map(c => <option key={c} value={c}>{c === 'الكل' ? 'توزيع اللجان بالكامل' : `اللجنة: ${c}`}</option>)}
                          </select>
                       </div>
                    </div>

                    <div className="px-6 py-4 bg-indigo-600/5 rounded-2.5xl border border-indigo-100 flex flex-col justify-center">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">إجمالي الطلاب بالقائمة</span>
                        <span className="text-2xl font-black text-indigo-700 font-header">{filteredStudents.length}</span>
                    </div>
                </div>
            </div>

            {/* ── Printing Content Area ── */}
            <div className="space-y-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-40 opacity-20">
                        <Printer size={64} className="animate-pulse mb-4" />
                        <p className="font-black text-xl">جاري تحضير الكشوف...</p>
                    </div>
                ) : (
                    <div className="print:p-0">
                        {Object.keys(groupedByCommittee).length === 0 ? (
                            <div className="luxury-card py-24 text-center">
                                <Search size={48} className="mx-auto mb-4 text-slate-200" />
                                <p className="text-slate-500 font-black text-lg">لم يتم العثور على طلاب تطابق الفلترة المختارة</p>
                                <button onClick={() => {setSelectedStage('الكل'); setSelectedGrade('الكل'); setSelectedCommittee('الكل');}} className="mt-4 text-indigo-600 font-bold hover:underline">إعادة ضبط الفلاتر</button>
                            </div>
                        ) : (
                            Object.entries(groupedByCommittee).sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true })).map(([committeeId, committeeStudents], idx) => {
                                const stageText = [...new Set(committeeStudents.map(s => s.stage).filter(Boolean))].join(' و ');
                                const gradeText = [...new Set(committeeStudents.map(s => s.grade).filter(Boolean))].join(' و ');

                                return (
                                    <div key={idx} className="luxury-card p-0 overflow-hidden mb-12 page-break-after border-none shadow-premium bg-white print:shadow-none print:w-full">
                                        
                                        {/* Premium Header for Preview & Print */}
                                        <div className="p-10 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 print:border-slate-900 print:bg-white">
                                            <div className="flex items-center gap-6">
                                                <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center print:hidden">
                                                   <span className="text-4xl font-black text-indigo-600 font-header">{committeeId}</span>
                                                </div>
                                                <div className="text-center md:text-right">
                                                    <h2 className="text-2xl font-black text-slate-900 font-header tracking-tight">كشف توزيع الطلاب - لجنة ({committeeId})</h2>
                                                    <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest">{appConfig?.platformName || 'نظام إدارة الاختبارات الذكي'}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex gap-4">
                                                <div className="px-6 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col items-center min-w-[120px]">
                                                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">المرحلة</span>
                                                   <span className="text-sm font-black text-slate-700">{stageText || 'عام'}</span>
                                                </div>
                                                <div className="px-6 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col items-center min-w-[120px]">
                                                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الصف</span>
                                                   <span className="text-sm font-black text-slate-700">{gradeText || '—'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Premium Table */}
                                        <div className="p-8">
                                            <div className="premium-table-container rounded-3xl border border-slate-50 overflow-hidden">
                                                <table className="premium-table">
                                                    <thead>
                                                        <tr>
                                                            <th className="w-16">م</th>
                                                            <th>اسم الطالب الثلاثي</th>
                                                            <th>رقم الجلوس</th>
                                                            <th>الفصل</th>
                                                            <th>ملاحظات اللجنة</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {[...committeeStudents].sort((a, b) => a.seatNumber - b.seatNumber).map((student, index) => (
                                                            <tr key={student.id} className="group">
                                                                <td>
                                                                   <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 text-slate-400 font-black text-xs group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                                      {index + 1}
                                                                   </span>
                                                                </td>
                                                                <td>
                                                                    <span className="font-black text-slate-800 text-base">{student.name}</span>
                                                                </td>
                                                                <td>
                                                                    <div className="flex items-center gap-2">
                                                                       <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                                                       <span className="font-black text-indigo-700 text-lg">{student.seatNumber}</span>
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <span className="px-3 py-1 bg-slate-50 text-slate-500 rounded-lg text-xs font-black uppercase">{student.class || '—'}</span>
                                                                </td>
                                                                <td>
                                                                    <div className="min-h-[2.5rem] print:border-b print:border-dotted print:border-slate-300"></div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Accreditation Section */}
                                        <div className="p-10 pt-4 bg-slate-50/20 border-t border-slate-50 hidden print:grid grid-cols-3 gap-10">
                                            <div className="text-center space-y-10">
                                                <p className="font-black text-slate-900 text-sm">مراقب اللجنة</p>
                                                <div className="h-[2px] bg-slate-200 w-full mx-auto"></div>
                                            </div>
                                            <div className="text-center space-y-10">
                                                <p className="font-black text-slate-900 text-sm">مسؤول الكنترول</p>
                                                <div className="h-[2px] bg-slate-200 w-full mx-auto"></div>
                                            </div>
                                            <div className="text-center">
                                                <p className="font-black text-slate-900 text-sm mb-4">يعتمد، مدير المدرسة</p>
                                                <p className="font-black text-indigo-600 text-lg mb-6">{appConfig?.managerName || 'أ. محمد نصر الدين'}</p>
                                                <div className="h-[2px] bg-slate-200 w-full mx-auto"></div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            <style>{`
                @media print {
                  @page { size: A4 portrait; margin: 15mm; }
                  body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                  aside, footer, nav, header:not(.print-header), .print-hidden { display: none !important; }
                  main { padding: 0 !important; margin: 0 !important; }
                  .luxury-card { border: 2pt solid #f1f5f9 !important; box-shadow: none !important; border-radius: 0 !important; margin-bottom: 0 !important; }
                  .premium-table thead th { background-color: #f8fafc !important; color: #000 !important; font-weight: 900 !important; border-bottom: 2pt solid #000 !important; }
                  .premium-table tbody td { border-bottom: 1pt solid #e2e8f0 !important; color: #000 !important; padding: 10pt 6pt !important; }
                  .page-break-after { page-break-after: always; }
                  .page-break-after:last-child { page-break-after: auto; }
                  * { color: black !important; }
                  .text-indigo-600, .text-indigo-700 { color: #000 !important; }
                }
            `}</style>
        </div>
    );
};

export default PrintSheets;
