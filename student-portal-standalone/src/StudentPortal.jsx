import React, { useState, useEffect } from 'react';
import { getOmrResults, getAppSettings, getStudents } from './dataService';
import { Search, Printer, CheckCircle, AlertCircle } from 'lucide-react';

const getGradeLabel = (pct) => {
  if (pct >= 90) return { label: 'ممتاز', color: '#16a34a', bg: '#dcfce7' };
  if (pct >= 80) return { label: 'جيد جداً', color: '#2563eb', bg: '#dbeafe' };
  if (pct >= 70) return { label: 'جيد', color: '#7c3aed', bg: '#ede9fe' };
  if (pct >= 50) return { label: 'مقبول', color: '#d97706', bg: '#fef3c7' };
  return { label: 'ضعيف', color: '#dc2626', bg: '#fee2e2' };
};

const getLetterAr = (l) => ({ A: 'أ', B: 'ب', C: 'ج', D: 'د', E: 'هـ' }[l] || l || '—');

const ResultSlip = ({ result, schoolName }) => {
  const g = getGradeLabel(result.percentage);
  const gradeHexColor = g.color;

  const details = result.details || {};
  const qs = Object.keys(details).sort((a, b) => parseInt(a) - parseInt(b));

  const col1 = qs.filter(q => parseInt(q) <= 15);
  const col2 = qs.filter(q => parseInt(q) > 15);
  const maxRows = Math.max(col1.length, col2.length, 1);

  const rows = Array.from({ length: maxRows }, (_, i) => {
    const q1 = col1[i]; const q2 = col2[i];
    return { q1, d1: q1 ? details[q1] : null, q2, d2: q2 ? details[q2] : null };
  });

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 mb-8 max-w-3xl mx-auto print:shadow-none print:border-none print:w-full">
      <div className="bg-gradient-to-br from-slate-900 to-indigo-900 text-white p-6 md:p-8 flex justify-between items-center print:bg-slate-900 print:text-black">
        <div>
          <h2 className="text-2xl font-black tracking-tight">{schoolName}</h2>
          <p className="text-indigo-200 text-sm mt-1 font-medium">نظام التصحيح الآلي OMR — نتيجة الاختبار</p>
        </div>
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 px-5 text-center border border-white/20">
          <div className="text-3xl font-black">{result.score}<span className="text-lg opacity-70">/{result.total}</span></div>
          <div className="text-sm font-bold text-indigo-100">{parseFloat(result.percentage).toFixed(1)}%</div>
        </div>
      </div>

      <div className="p-6 md:p-8">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 print:bg-transparent">
          <div>
            <span className="block text-slate-500 text-xs font-bold mb-1">اسم الطالب</span>
            <strong className="text-slate-900 text-lg">{result.studentName || result.studentId}</strong>
          </div>
          <div>
            <span className="block text-slate-500 text-xs font-bold mb-1">الصف</span>
            <strong className="text-slate-900">{result.studentGrade || '—'}</strong>
          </div>
          <div>
            <span className="block text-slate-500 text-xs font-bold mb-1">الاختبار</span>
            <strong className="text-slate-900">{result.examTitle || '—'}</strong>
          </div>
          <div>
            <span className="block text-slate-500 text-xs font-bold mb-1">رقم الهوية</span>
            <strong className="text-slate-700 font-mono tracking-wider">{result.studentId}</strong>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-6 mb-8 bg-white border-2 rounded-xl p-5" style={{ borderColor: `${gradeHexColor}33` }}>
          <div className="text-5xl font-black leading-none" style={{ color: gradeHexColor }}>
            {result.score}<span className="text-2xl text-slate-400">/{result.total}</span>
          </div>
          <div className="flex-1 w-full">
            <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${result.percentage}%`, backgroundColor: gradeHexColor }}></div>
            </div>
            <div className="mt-2 text-sm font-bold flex justify-between" style={{ color: gradeHexColor }}>
              <span>{g.label}</span>
              <span>{parseFloat(result.percentage).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm text-center">
            <thead>
              <tr className="bg-slate-800 text-white print:bg-slate-200 print:text-black">
                <th className="p-3 border border-slate-700 w-12">النتيجة</th>
                <th className="p-3 border border-slate-700 w-12">الصواب</th>
                <th className="p-3 border border-slate-700 w-12">إجابتك</th>
                <th className="p-3 border border-slate-700 bg-slate-900 print:bg-slate-300">السؤال</th>
                <th className="w-4 bg-slate-100 print:bg-transparent"></th>
                <th className="p-3 border border-slate-700 w-12">النتيجة</th>
                <th className="p-3 border border-slate-700 w-12">الصواب</th>
                <th className="p-3 border border-slate-700 w-12">إجابتك</th>
                <th className="p-3 border border-slate-700 bg-slate-900 print:bg-slate-300">السؤال</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ q1, d1, q2, d2 }, idx) => (
                <tr key={idx} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                  {q2 ? (
                    <>
                      <td className={`p-2 border border-slate-200 font-bold ${d2.is_correct ? 'text-emerald-600' : 'text-red-500'}`}>
                        {d2.is_correct ? `+${d2.weight}` : '✗'}
                      </td>
                      <td className="p-2 border border-slate-200">{getLetterAr(d2.correct_option)}</td>
                      <td className="p-2 border border-slate-200 font-bold">{getLetterAr(d2.student_answer)}</td>
                      <td className="p-2 border border-slate-200 bg-slate-50 font-bold text-slate-800">{q2}</td>
                    </>
                  ) : <td colSpan="4" className="border border-slate-200"></td>}
                  <td className="bg-slate-100 border-x border-slate-200"></td>
                  {q1 ? (
                    <>
                      <td className={`p-2 border border-slate-200 font-bold ${d1.is_correct ? 'text-emerald-600' : 'text-red-500'}`}>
                        {d1.is_correct ? `+${d1.weight}` : '✗'}
                      </td>
                      <td className="p-2 border border-slate-200">{getLetterAr(d1.correct_option)}</td>
                      <td className="p-2 border border-slate-200 font-bold">{getLetterAr(d1.student_answer)}</td>
                      <td className="p-2 border border-slate-200 bg-slate-50 font-bold text-slate-800">{q1}</td>
                    </>
                  ) : <td colSpan="4" className="border border-slate-200"></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default function StudentPortal() {
  const [studentId, setStudentId] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState(null);

  useEffect(() => { getAppSettings().then(setConfig); }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;
    setLoading(true); setError(''); setResults(null);
    try {
      const allResults = await getOmrResults();
      const allStudents = await getStudents();
      const student = allStudents.find(s => s.nationalId && s.nationalId.trim() === studentId.trim());
      let matching = [];
      if (student) {
        matching = allResults.filter(r => 
          r.approved === true && (
            r.studentId === student.id ||
            r.studentId === student.seatNumber ||
            r.studentName === student.name
          )
        );
      } else {
        matching = allResults.filter(r => (r.studentId === studentId.trim() || r.nationalId === studentId.trim()) && r.approved === true);
      }
      if (matching.length > 0) { setResults(matching); } 
      else { setError('عذراً، لم نتمكن من العثور على أي نتائج معتمدة لهذا الرقم.'); }
    } catch (err) { setError('حدث خطأ أثناء البحث عن النتيجة.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans p-4" dir="rtl">
      <div className="print:hidden">
        <header className="max-w-4xl mx-auto py-8 text-center">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">بوابة نتائج النخبة</h1>
            <p className="text-slate-500 font-bold mt-2">{config?.schoolName || 'نظام الرصد الذكي'}</p>
        </header>
        <main className="max-w-2xl mx-auto mt-10">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 border border-slate-100 text-center">
                <h2 className="text-3xl font-black mb-4">استعلام عن النتيجة</h2>
                <form onSubmit={handleSearch} className="flex flex-col gap-4 mt-8">
                    <input 
                      type="text" 
                      placeholder="أدخل رقم الهوية ..." 
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl py-4 px-6 text-xl font-bold focus:border-indigo-500 outline-none transition-all"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                    />
                  <button type="submit" disabled={loading} className="bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl active:scale-95 disabled:opacity-50">
                    {loading ? 'جاري البحث...' : 'عــرض النـتـيـجـة'}
                  </button>
                </form>
                {error && <div className="mt-6 text-rose-600 bg-rose-50 p-4 rounded-xl font-bold border border-rose-100">{error}</div>}
          </div>
        </main>
      </div>
      {results && results.length > 0 && (
        <div className="max-w-4xl mx-auto mt-12 pb-20 print:m-0">
          <div className="print:hidden flex justify-between items-center mb-8 bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
             <span className="font-bold">تم العثور على {results.length} نتائج</span>
             <button onClick={() => window.print()} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold">طباعة</button>
          </div>
          {results.map((r, i) => <ResultSlip key={i} result={r} schoolName={config?.schoolName || 'مدرسة النخبة'} />)}
        </div>
      )}
    </div>
  );
}
