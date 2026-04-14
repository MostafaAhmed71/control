import React, { useState, useEffect, useRef } from 'react';
import { getOmrResults, getAppSettings, getStudents } from './dataService';
import { Search, Printer, CheckCircle, AlertCircle, Download, GraduationCap, School, User, Award, Hash, BookOpen } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const getGradeLabel = (pct) => {
  if (pct >= 90) return { label: 'ممتاز', color: '#1e1b4b', bg: '#e0e7ff', icon: <Award className="w-5 h-5" /> };
  if (pct >= 80) return { label: 'جيد جداً', color: '#1e3a8a', bg: '#dbeafe', icon: <Award className="w-5 h-5" /> };
  if (pct >= 70) return { label: 'جيد', color: '#1d4ed8', bg: '#eff6ff', icon: <Award className="w-5 h-5" /> };
  if (pct >= 50) return { label: 'مقبول', color: '#4338ca', bg: '#eef2ff', icon: <Award className="w-5 h-5" /> };
  return { label: 'دون المستوى', color: '#dc2626', bg: '#fef2f2', icon: <AlertCircle className="w-5 h-5" /> };
};

const getLetterAr = (l) => ({ A: 'أ', B: 'ب', C: 'ج', D: 'د', E: 'هـ' }[l] || l || '—');

const ResultSlip = ({ result, schoolName }) => {
  const g = getGradeLabel(result.percentage);
  const slipRef = useRef();

  const handleDownload = async () => {
    const canvas = await html2canvas(slipRef.current, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`شهادة_${result.studentName || result.studentId}.pdf`);
  };

  const details = result.details || {};
  const qs = Object.keys(details).sort((a, b) => parseInt(a) - parseInt(b));
  const col1 = qs.filter(q => parseInt(q) <= 15);
  const col2 = qs.filter(q => parseInt(q) > 15);
  const maxRows = Math.max(col1.length, col2.length, 1);
  const rows = Array.from({ length: maxRows }, (_, i) => ({
    q1: col1[i], d1: col1[i] ? details[col1[i]] : null,
    q2: col2[i], d2: col2[i] ? details[col2[i]] : null
  }));

  return (
    <div className="mb-12 group">
      <div className="flex justify-end gap-3 mb-4 print:hidden">
        <button onClick={handleDownload} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95">
          <Download className="w-5 h-5" />
          تحميل PDF
        </button>
        <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-slate-200 active:scale-95">
          <Printer className="w-5 h-5" />
          طباعة
        </button>
      </div>

      <div ref={slipRef} className="luxury-card overflow-hidden border-2 border-slate-200/50 print:border-none print:shadow-none bg-white relative">
        {/* Certificate Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full opacity-50 -z-0"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-slate-50 rounded-tr-full opacity-50 -z-0"></div>
        
        <div className="relative z-10">
          {/* Header section with Logo */}
          <div className="bg-gradient-to-l from-indigo-950 to-indigo-900 text-white p-8 border-b-4 border-indigo-500 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-5 text-right">
              <div className="w-20 h-20 bg-white rounded-2xl p-1.5 shadow-2xl flex items-center justify-center overflow-hidden">
                <img src="/school_logo.jpeg" alt="Logo" className="w-full h-full object-contain" onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=S&background=1e1b4b&color=fff'; }} />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight font-header">{schoolName}</h2>
                <div className="flex items-center gap-2 mt-1 text-indigo-200">
                  <GraduationCap className="w-4 h-4" />
                  <span className="text-sm font-bold">بوابة استعلام النتائج - نظام النخبة</span>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 px-8 text-center border border-white/20 min-w-[160px]">
              <div className="text-4xl font-black">{result.score}<span className="text-xl opacity-60">/{result.total}</span></div>
              <div className="text-xs font-bold uppercase tracking-widest text-indigo-300 mt-1">الدرجة النهائية</div>
            </div>
          </div>

          <div className="p-8">
            {/* Student Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'اسم الطالب', value: result.studentName || result.studentId, icon: <User className="w-4 h-4" />, color: 'indigo' },
                { label: 'الصف الدراسي', value: result.studentGrade || '—', icon: <School className="w-4 h-4" />, color: 'slate' },
                { label: 'اسم الاختبار', value: result.examTitle || '—', icon: <BookOpen className="w-4 h-4" />, color: 'indigo' },
                { label: 'رقم الجلوس/الهوية', value: result.studentId, icon: <Hash className="w-4 h-4" />, color: 'slate' }
              ].map((item, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl bg-${item.color}-100 text-${item.color}-700 flex items-center justify-center shadow-sm`}>
                    {item.icon}
                  </div>
                  <div className="text-right">
                    <span className="block text-slate-500 text-[10px] font-black mb-0.5">{item.label}</span>
                    <strong className="text-slate-800 text-sm font-bold">{item.value}</strong>
                  </div>
                </div>
              ))}
            </div>

            {/* Visual Grade Metric */}
            <div className="flex flex-col md:flex-row items-center gap-8 mb-10 p-6 rounded-3xl bg-indigo-50/50 border border-indigo-100">
              <div className="flex flex-col items-center">
                 <div className="w-24 h-24 rounded-full border-8 border-white flex items-center justify-center shadow-xl text-3xl font-black transition-transform hover:scale-105" style={{ backgroundColor: g.bg, color: g.color }}>
                   {Math.round(result.percentage)}%
                 </div>
              </div>
              
              <div className="flex-1 w-full text-right">
                <div className="flex justify-between items-end mb-3">
                   <div className="flex items-center gap-2" style={{ color: g.color }}>
                     {g.icon}
                     <span className="text-xl font-black">{g.label}</span>
                   </div>
                   <span className="text-sm font-bold text-slate-500 text-left">مستوى الإنجاز العام</span>
                </div>
                <div className="h-4 bg-white rounded-full overflow-hidden shadow-inner p-1">
                  <div className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm" style={{ width: `${result.percentage}%`, backgroundColor: g.color }}></div>
                </div>
              </div>
            </div>

            {/* Answer Breakdown Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr className="bg-indigo-950 text-white print:bg-slate-100 print:text-black">
                    <th className="p-3 border-x border-indigo-900/50 w-16">النتيجة</th>
                    <th className="p-3 border-x border-indigo-900/50 w-16">النموذج</th>
                    <th className="p-3 border-x border-indigo-900/50 w-16">إجابتك</th>
                    <th className="p-3 border-x border-indigo-900/50 bg-indigo-900">سؤال</th>
                    <th className="w-3 bg-slate-200/50"></th>
                    <th className="p-3 border-x border-indigo-900/50 w-16">النتيجة</th>
                    <th className="p-3 border-x border-indigo-900/50 w-16">النموذج</th>
                    <th className="p-3 border-x border-indigo-900/50 w-16">إجابتك</th>
                    <th className="p-3 border-x border-indigo-900/50 bg-indigo-900">سؤال</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {rows.map(({ q1, d1, q2, d2 }, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      {q2 ? (
                        <>
                          <td className={`p-2 font-black ${d2.is_correct ? 'text-emerald-600 bg-emerald-50/30' : 'text-red-500 bg-red-50/30'}`}>
                            {d2.is_correct ? '✓' : '✗'}
                          </td>
                          <td className="p-2 border-x border-slate-100 text-slate-600 font-bold">{getLetterAr(d2.correct_option)}</td>
                          <td className="p-2 border-x border-slate-100 font-black text-indigo-900">{getLetterAr(d2.student_answer)}</td>
                          <td className="p-2 bg-indigo-50/30 font-black text-indigo-950">{q2}</td>
                        </>
                      ) : <td colSpan="4"></td>}
                      <td className="bg-slate-50 w-3"></td>
                      {q1 ? (
                        <>
                          <td className={`p-2 font-black ${d1.is_correct ? 'text-emerald-600 bg-emerald-50/30' : 'text-red-500 bg-red-50/30'}`}>
                            {d1.is_correct ? '✓' : '✗'}
                          </td>
                          <td className="p-2 border-x border-slate-100 text-slate-600 font-bold">{getLetterAr(d1.correct_option)}</td>
                          <td className="p-2 border-x border-slate-100 font-black text-indigo-900">{getLetterAr(d1.student_answer)}</td>
                          <td className="p-2 bg-indigo-50/30 font-black text-indigo-950">{q1}</td>
                        </>
                      ) : <td colSpan="4"></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center opacity-70 italic text-[10px] font-bold text-slate-500">
              <p>صدر هذا التقرير آلياً من نظام التصحيح الإلكتروني والمراجعة الذكية للنخبة</p>
              <p>تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG')}</p>
            </div>
          </div>
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
    <div className="min-h-screen bg-[#f8fafc] text-indigo-950 font-sans" dir="rtl">
      {/* Glass Header */}
      <nav className="glass-header print:hidden">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-900 rounded-xl flex items-center justify-center shadow-lg transform -rotate-12">
                <GraduationCap className="text-white w-6 h-6" />
             </div>
             <div className="text-right">
                <h1 className="text-lg font-black royal-gradient-text font-header leading-tight">بوابة النخبة</h1>
                <p className="text-[10px] font-bold text-slate-500">منصة الاستعلام عن النتائج</p>
             </div>
          </div>
          <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
             <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
             <span className="text-[11px] font-black text-indigo-900">النظام متصل</span>
          </div>
        </div>
      </nav>

      <div className="p-6">
        <div className="print:hidden">
            <header className="max-w-4xl mx-auto py-12 text-center">
                <div className="inline-block bg-indigo-100 text-indigo-900 px-6 py-2 rounded-full font-black text-xs mb-4 shadow-sm border border-indigo-200">
                  {config?.schoolName || 'نظام الرصد الذكي'}
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight font-header mb-4">
                  نتائج <span className="text-indigo-700">الاختبارات الآلية</span>
                </h1>
                <p className="text-slate-500 font-bold max-w-lg mx-auto leading-relaxed">بإمكانك الحصول على نتيجتك وتفاصيل إجاباتك بشكل فوري بمجرد إدخال رقم الهوية الخاص بك في الخانة أدناه.</p>
            </header>

            <main className="max-w-xl mx-auto mb-20 relative">
               {/* Decorative background for search */}
               <div className="absolute -top-12 -left-12 w-64 h-64 bg-indigo-200/20 blur-3xl rounded-full"></div>
               <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-slate-200/20 blur-3xl rounded-full"></div>

               <div className="luxury-card p-10 md:p-14 border border-white shadow-2xl relative z-10 backdrop-blur-sm bg-white/90">
                    <div className="mb-8 text-center">
                       <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
                          <Search className="text-indigo-600 w-8 h-8" />
                       </div>
                       <h2 className="text-2xl font-black text-slate-800">استعلم عن نتيجتك</h2>
                    </div>

                    <form onSubmit={handleSearch} className="space-y-5">
                        <div className="relative group">
                           <input 
                             type="text" 
                             placeholder="أدخل رقم الهوية أو رقم الجلوس..." 
                             className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-5 px-6 pt-8 text-xl font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all shadow-sm group-hover:shadow-md"
                             value={studentId}
                             onChange={(e) => setStudentId(e.target.value)}
                           />
                           <label className="absolute right-6 top-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم التعريف</label>
                        </div>
                        
                        <button type="submit" disabled={loading} className="w-full bg-indigo-950 text-white py-5 rounded-2xl font-black text-xl shadow-xl shadow-indigo-900/20 hover:bg-indigo-900 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                          {loading ? (
                            <>
                              <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                              <span>جاري المراجعة...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-6 h-6 text-emerald-400" />
                              <span>عــرض النـتـيـجـة</span>
                            </>
                          )}
                        </button>
                    </form>

                    {error && (
                      <div className="mt-8 flex items-center gap-4 text-red-600 bg-red-50 p-5 rounded-2xl font-bold border border-red-100 animate-in fade-in slide-in-from-top-4 duration-500">
                         <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                            <AlertCircle className="w-6 h-6" />
                         </div>
                         <p className="text-sm">{error}</p>
                      </div>
                    )}
               </div>
            </main>
        </div>

        {results && results.length > 0 && (
          <div className="max-w-4xl mx-auto mb-24 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="print:hidden flex justify-between items-center mb-8 bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white shadow-xl">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                     <Award className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">تهانينا!</h3>
                    <p className="text-sm font-bold text-slate-500">تم العثور على {results.length} نتائج معتمدة</p>
                  </div>
               </div>
            </div>
            
            <div className="space-y-12">
              {results.map((r, i) => (
                <ResultSlip key={i} result={r} schoolName={config?.schoolName || 'مدرسة النخبة التعليمية'} />
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="py-12 border-t border-slate-200 text-center print:hidden">
         <div className="max-w-4xl mx-auto px-6">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Elite Control Smart System</p>
            <div className="flex justify-center gap-8 text-slate-300">
               {/* Decorative dots */}
               {[1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-current"></div>)}
            </div>
         </div>
      </footer>
    </div>
  );
}
