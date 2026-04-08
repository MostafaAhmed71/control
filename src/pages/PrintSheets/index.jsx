import React, { useState, useEffect } from 'react';
import { Printer, FileText, Search, Download } from 'lucide-react';
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
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">طباعة كشوف اللجان</h1>
                    <p className="text-gray-500 text-sm mt-1">تجهيز وطباعة قوائم الطلاب حسب اللجان</p>
                </div>

                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
                        <Download size={18} />
                        <span>تحميل PDF</span>
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                    >
                        <Printer size={18} />
                        <span>طباعة القوائم</span>
                    </button>
                </div>
            </div>

            <div className="glass-morphism rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:border-none print:shadow-none print:bg-white print:overflow-visible">
                <div className="p-4 border-b border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden bg-white">
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

                {loading ? (
                    <div className="text-center py-20 text-gray-400">جاري التحميل...</div>
                ) : (
                    <div className="print:p-0">
                        {Object.keys(groupedByCommittee).length === 0 ? (
                            <div className="text-center py-20 text-gray-500 font-medium">لا توجد بيانات تطابق الفرز الحالي.</div>
                        ) : (
                            Object.entries(groupedByCommittee).sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true })).map(([committeeId, committeeStudents], idx) => {
                                // Find stage and grade for header from the first student
                                const stageText = [...new Set(committeeStudents.map(s => s.stage).filter(Boolean))].join(' و ');
                                const gradeText = [...new Set(committeeStudents.map(s => s.grade).filter(Boolean))].join(' و ');

                                return (
                                    <div key={idx} className="p-8 print:p-0 page-break-after print:mb-0 mb-8 bg-white print:w-full print:h-[297mm]">
                                        <div className="hidden print:block mb-8 text-center border-b-2 border-indigo-600 pb-4">
                                            <h2 className="text-2xl font-bold text-gray-900 uppercase">كشف الطلاب - {appConfig?.platformName || 'مدارس نخبة الشمال الأهلية والعالمية'}</h2>
                                            <div className="flex justify-center gap-10 mt-2 text-gray-600 font-bold">
                                                <span>اللجنة: رقم ({committeeId})</span>
                                                {stageText && <span>المرحلة: {stageText}</span>}
                                                {gradeText && <span>الصف: {gradeText}</span>}
                                            </div>
                                        </div>

                                        <table className="w-full text-right border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50 print:bg-gray-100">
                                                    <th className="px-6 py-4 border border-gray-200 font-bold text-gray-700">م</th>
                                                    <th className="px-6 py-4 border border-gray-200 font-bold text-gray-700">اسم الطالب</th>
                                                    <th className="px-6 py-4 border border-gray-200 font-bold text-gray-700">رقم الجلوس</th>
                                                    <th className="px-6 py-4 border border-gray-200 font-bold text-gray-700">الفصل</th>
                                                    <th className="px-6 py-4 border border-gray-200 font-bold text-gray-700">ملاحظات</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[...committeeStudents].sort((a, b) => a.seatNumber - b.seatNumber).map((student, index) => (
                                                    <tr key={student.id} className="hover:bg-gray-50 print:hover:bg-transparent">
                                                        <td className="px-6 py-3 border border-gray-200 text-sm text-gray-600 w-12 text-center">{index + 1}</td>
                                                        <td className="px-6 py-3 border border-gray-200 text-sm font-medium text-gray-800">{student.name}</td>
                                                        <td className="px-6 py-3 border border-gray-200 text-sm font-bold text-indigo-600">{student.seatNumber}</td>
                                                        <td className="px-6 py-3 border border-gray-200 text-sm text-gray-600">{student.class}</td>
                                                        <td className="px-6 py-3 border border-gray-200 w-32"></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="hidden print:flex justify-between mt-12 px-8">
                                            <div className="text-center">
                                                <p className="font-bold">مراقب اللجنة</p>
                                                <div className="mt-8 border-b border-gray-400 w-40"></div>
                                            </div>
                                            <div className="text-center">
                                                <p className="font-bold">مسؤول الكنترول</p>
                                                <div className="mt-8 border-b border-gray-400 w-40"></div>
                                            </div>
                                            <div className="text-center">
                                                <p className="font-bold">مدير المدرسة</p>
                                                <p className="mt-2 font-black text-lg">{appConfig?.managerName || 'أ. محمد نصر الدين'}</p>
                                                <div className="mt-4 border-b border-gray-400 w-40 mx-auto"></div>
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
          @page { size: A4 portrait; margin: 20mm; }
          body { background: white !important; }
          .mr-64 { margin-right: 0 !important; }
          aside, header, nav, button, select, label { display: none !important; }
          main { padding: 0 !important; }
          table { width: 100% !important; border: 1pt solid black !important; }
          th, td { border: 0.5pt solid black !important; padding: 8pt !important; }
          .glass-morphism { background: none !important; backdrop-filter: none !important; border: none !important; }
          .page-break-after { page-break-after: always; }
          .page-break-after:last-child { page-break-after: auto; }
        }
      `}</style>
        </div>
    );
};

export default PrintSheets;
