import React, { useState, useEffect } from 'react';
import { Search, FileText, ChevronDown, ChevronUp, Clock, User, Download } from 'lucide-react';
import { getOmrResults, deleteOmrResult } from '../../utils/dataService';

const OMRResults = () => {
    const [results, setResults] = useState([]);
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadResults();
    }, []);

    const loadResults = async () => {
        setLoading(true);
        const data = await getOmrResults();
        // Sort by timestamp desc
        data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setResults(data);
        setLoading(false);
    };

    const toggleRow = (id) => {
        const next = new Set(expandedRows);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedRows(next);
    };

    const filteredResults = results.filter(r => 
        r.studentId.includes(searchTerm) || 
        r.examTitle.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const exportToCSV = () => {
        if (filteredResults.length === 0) return;
        const headers = ["الرقم الجامعي", "الاختبار", "الدرجة", "الإجمالي", "النسبة", "التاريخ"];
        const rows = filteredResults.map(r => [
            r.studentId,
            r.examTitle,
            r.score,
            r.total,
            r.percentage + "%",
            new Date(r.timestamp).toLocaleString('ar-EG')
        ]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `OMR_Results_${new Date().toLocaleDateString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 pb-20">
            <div className="flex justify-between items-end bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">تقارير التصحيح</h1>
                    <p className="text-gray-500 mt-2 font-medium">سجل بجميع الطلاب الذين تم تصحيح أوراقهم</p>
                </div>
                <button 
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg"
                >
                    <Download size={18} />
                    تصدير Excel (CSV)
                </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-slate-50/50 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                          type="text" 
                          placeholder="ابحث برقم الطالب أو اسم الاختبار..." 
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pr-12 pl-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold"
                        />
                    </div>
                    <div className="text-sm font-bold text-gray-400">
                        عرض {filteredResults.length} نتيجة مصححة
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-slate-50 text-gray-500 text-xs uppercase tracking-widest font-black">
                            <tr>
                                <th className="px-6 py-4">الطالب</th>
                                <th className="px-6 py-4">الاختبار</th>
                                <th className="px-6 py-4">الدرجة</th>
                                <th className="px-6 py-4">النسبة</th>
                                <th className="px-6 py-4">المراجعة</th>
                                <th className="px-6 py-4">التاريخ</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredResults.map((res) => (
                                <React.Fragment key={res.id}>
                                    <tr className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => toggleRow(res.id)}>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black">
                                                    <User size={18} />
                                                </div>
                                                <span className="font-bold text-gray-800">{res.studentId}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <FileText size={16} className="text-gray-400" />
                                                <span className="font-medium text-gray-600">{res.examTitle}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 font-black text-gray-800">{res.score} / {res.total}</td>
                                        <td className="px-6 py-5">
                                            <span className={`px-3 py-1 rounded-full text-xs font-black ${parseFloat(res.percentage) >= 50 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                                {res.percentage}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            {Array.isArray(res.needsReviewQuestions) && res.needsReviewQuestions.length > 0 ? (
                                                <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700">
                                                    {res.needsReviewQuestions.length} سؤال
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1 rounded-full text-xs font-black bg-green-50 text-green-700">
                                                    آمن
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-sm text-gray-400 flex items-center gap-2 mt-2">
                                            <Clock size={14} />
                                            {new Date(res.timestamp).toLocaleDateString('ar-EG')}
                                        </td>
                                        <td className="px-6 py-5">
                                            {expandedRows.has(res.id) ? <ChevronUp size={20} className="text-indigo-600" /> : <ChevronDown size={20} className="text-gray-300 group-hover:text-indigo-400" />}
                                        </td>
                                    </tr>
                                    {expandedRows.has(res.id) && (
                                        <tr className="bg-indigo-50/30">
                                            <td colSpan="7" className="px-8 py-6">
                                                {res.adaptiveThresholds && (
                                                    <div className="mb-4 flex flex-wrap gap-2">
                                                        <span className="text-[11px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-lg">
                                                            Fill: {res.adaptiveThresholds.fill ?? '-'}
                                                        </span>
                                                        <span className="text-[11px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-lg">
                                                            Darkness: {res.adaptiveThresholds.darkness ?? '-'}
                                                        </span>
                                                        <span className="text-[11px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-lg">
                                                            Dominance: {res.adaptiveThresholds.dominance_ratio ?? '-'}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                                    {Object.entries(res.details || {}).map(([q, detail]) => (
                                                        <div
                                                            key={q}
                                                            className={`p-3 rounded-xl border text-center ${
                                                                Array.isArray(res.needsReviewQuestions) && res.needsReviewQuestions.includes(parseInt(q, 10))
                                                                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                                                                    : detail.is_correct
                                                                        ? 'bg-white border-green-200 text-green-700'
                                                                        : 'bg-white border-red-200 text-red-700'
                                                            }`}
                                                        >
                                                            <div className="text-[10px] font-black opacity-50 mb-1">سؤال {q}</div>
                                                            <div className="font-bold flex items-center justify-center gap-1">
                                                                {detail.student_answer || '?'}
                                                                {!detail.is_correct && <span className="text-[10px] text-gray-400">({detail.correct_option})</span>}
                                                            </div>
                                                            {res.confidence && typeof res.confidence[q] === 'number' && (
                                                                <div className="text-[10px] mt-1 opacity-80">
                                                                    ثقة {(res.confidence[q] * 100).toFixed(0)}%
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                    
                    {filteredResults.length === 0 && (
                        <div className="py-24 flex flex-col items-center justify-center text-gray-400 italic">
                            <Search size={48} className="mb-4 opacity-10" />
                            <p>لا توجد نتائج مطابقة للبحث</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OMRResults;
