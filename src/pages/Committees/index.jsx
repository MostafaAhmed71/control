import React, { useState, useEffect } from 'react';
import { LayoutGrid, Users, User, ArrowRightLeft, Shield, Plus, MoreVertical, Wand2, X, Edit2, Trash2, Home, Landmark, UserCheck, AlertCircle } from 'lucide-react';
import { getStudents, saveStudent, getCommittees, saveCommittee, deleteCommittee } from '../../utils/dataService';

const Committees = () => {
    const [committees, setCommittees] = useState([]);
    const [students, setStudents] = useState([]);
    const [isDistributeOpen, setIsDistributeOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCommittee, setEditingCommittee] = useState(null);
    const [selectedGrade, setSelectedGrade] = useState('');
    const [selectedCommittee, setSelectedCommittee] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [cData, sData] = await Promise.all([getCommittees(), getStudents()]);
        setCommittees(cData);
        setStudents(sData);
        setLoading(false);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            id: editingCommittee?.id,
            name: formData.get('name'),
            room: formData.get('room'),
            capacity: parseInt(formData.get('capacity')),
            monitor: formData.get('monitor'),
        };
        await saveCommittee(data);
        setIsModalOpen(false);
        setEditingCommittee(null);
        fetchData();
    };

    const handleDelete = async (id) => {
        if (window.confirm('هل أنت متأكد من حذف هذه اللجنة بشكل دائم؟')) {
            await deleteCommittee(id);
            fetchData();
        }
    };

    const handleAutoDistribute = async () => {
        if (!selectedGrade || !selectedCommittee) {
            alert('يرجى اختيار الصف واللجنة المستهدفة');
            return;
        }

        const committeeObj = committees.find(c => c.id === selectedCommittee);
        const committeeNameOnly = committeeObj.name.replace('لجنة ', '');
        const currentInCommittee = students.filter(s => s.committee === committeeNameOnly).length;
        const availableSpace = committeeObj.capacity - currentInCommittee;

        if (availableSpace <= 0) {
            alert('هذه اللجنة ممتلئة بالكامل');
            return;
        }

        const unboundStudents = students.filter(s => s.grade === selectedGrade && (!s.committee || s.committee === ''));
        const toDistribute = unboundStudents.slice(0, availableSpace);

        if (toDistribute.length === 0) {
            alert('لم يتم العثور على طلاب غير موزعين في هذا الصف');
            return;
        }

        for (const student of toDistribute) {
            await saveStudent({ ...student, committee: committeeNameOnly });
        }

        alert(`تم توزيع ${toDistribute.length} طالباً على اللجنة بنجاح`);
        setIsDistributeOpen(false);
        fetchData();
    };

    const grades = [...new Set(students.map(s => s.grade))];

    return (
        <div className="space-y-10 animate-in fade-in duration-700 font-alexandria pb-20">
            {/* ── Page Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2.5xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                            <Landmark size={24} />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 font-header tracking-tight">إدارة اللجان المركزية</h1>
                    </div>
                    <p className="text-slate-400 font-medium text-sm flex items-center gap-2">
                        <LayoutGrid size={16} className="text-indigo-400" />
                        تجهيز القاعات الامتحانية، توزيع الكتل الطلابية، وإسناد المهمام الإشرافية
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsDistributeOpen(true)}
                        className="px-6 py-4 bg-white text-indigo-600 rounded-3xl font-black text-sm hover:bg-slate-50 transition-all shadow-sm border border-slate-100 flex items-center gap-3"
                    >
                        <Wand2 size={20} className="text-indigo-500" /> توزيع ذكي
                    </button>
                    <button
                        onClick={() => { setEditingCommittee(null); setIsModalOpen(true); }}
                        className="px-8 py-4 bg-indigo-600 text-white rounded-3xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 flex items-center gap-3"
                    >
                        <Plus size={20} /> إضافة لجنة جديدة
                    </button>
                </div>
            </div>

            {/* ── Stats Summary Area ── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 px-2">
               <div className="luxury-card p-6 bg-white border-none shadow-premium flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">إجمالي اللجان</span>
                  <span className="text-3xl font-black text-slate-900 font-header">{committees.length}</span>
               </div>
               <div className="luxury-card p-6 bg-white border-none shadow-premium flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">الطاقة الاستيعابية</span>
                  <span className="text-3xl font-black text-slate-900 font-header">{committees.reduce((sum, c) => sum + c.capacity, 0)}</span>
               </div>
               <div className="luxury-card p-6 bg-white border-none shadow-premium flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">الطلاب الموزعون</span>
                  <span className="text-3xl font-black text-indigo-600 font-header">{students.filter(s => s.committee).length}</span>
               </div>
               <div className="luxury-card p-6 bg-white border-none shadow-premium flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">بانتظار التوزيع</span>
                  <span className="text-3xl font-black text-rose-500 font-header">{students.filter(s => !s.committee).length}</span>
               </div>
            </div>

            {/* ── Committees Grid ── */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-40 opacity-20">
                    <Landmark size={64} className="animate-pulse mb-4 text-slate-400" />
                    <p className="font-black text-xl text-slate-600 tracking-tighter uppercase">تجميع بيانات اللجان والقاعات...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-2">
                    {committees.map((committee) => {
                        const committeeNameOnly = committee.name.replace('لجنة ', '');
                        const studentCount = students.filter(s => s.committee === committeeNameOnly).length;
                        const occupancy = (studentCount / committee.capacity) * 100;

                        return (
                            <div key={committee.id} className="luxury-card group p-0 overflow-hidden bg-white border-none shadow-premium transition-all duration-500 hover:-translate-y-2">
                                {/* Card Header */}
                                <div className="p-8 pb-4 flex justify-between items-start">
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-sm">
                                            <LayoutGrid size={32} />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-800 font-header leading-tight">{committee.name}</h3>
                                            <div className="flex items-center gap-2 text-slate-400 font-bold text-xs mt-1">
                                                <Home size={14} className="text-indigo-400" />
                                                <span>قاعة: {committee.room}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                        <button
                                            onClick={() => { setEditingCommittee(committee); setIsModalOpen(true); }}
                                            className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-slate-900 hover:text-white transition-all"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(committee.id)}
                                            className="p-3 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-sm shadow-rose-100"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Progress Section */}
                                <div className="p-8 pt-4 pb-4">
                                    <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-100/50">
                                        <div className="flex justify-between items-end mb-3">
                                            <div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">نسبة الإشغال</span>
                                                <span className="text-lg font-black text-slate-800">{studentCount} من أصل {committee.capacity}</span>
                                            </div>
                                            <span className={`text-xs font-black px-3 py-1 rounded-full ${occupancy > 90 ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                %{Math.round(occupancy)}
                                            </span>
                                        </div>
                                        <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden p-[2px]">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 shadow-sm ${occupancy > 90 ? 'bg-gradient-to-l from-rose-500 to-rose-400' : 'bg-gradient-to-l from-indigo-600 to-indigo-400'}`}
                                                style={{ width: `${occupancy}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Monitor Info */}
                                <div className="px-8 pb-8 pt-4">
                                     <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl">
                                         <div className="flex items-center gap-3">
                                             <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-500">
                                                 <UserCheck size={20} />
                                             </div>
                                             <div>
                                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">المراقب المسؤول</p>
                                                 <p className="text-sm font-black text-slate-700 leading-tight mt-0.5">{committee.monitor}</p>
                                             </div>
                                         </div>
                                         <ChevronRight size={18} className="text-slate-200" />
                                     </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Main Modal (Committee Setup) ── */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border-none relative">
                        <div className="absolute top-0 right-0 w-full h-1.5 bg-gradient-to-l from-indigo-500 via-violet-500 to-indigo-500"></div>
                        
                        <div className="p-10 pb-6 border-b border-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 font-header leading-tight">
                                    {editingCommittee ? 'تحديث بيانات اللجنة' : 'إنشاء لجنة جديدة'}
                                </h3>
                                <p className="text-slate-400 font-medium text-xs mt-1">أدخل البيانات الأساسية للقاعة والمشرف المسؤول</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-4 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-2xl transition-all shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-10 space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">مسمى اللجنة الرسمي</label>
                                <input required name="name" defaultValue={editingCommittee?.name} placeholder="مثال: لجنة رقم (١)" className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2.5xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 font-black text-slate-800 transition-all font-header" />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">القاعة أو الغرفة</label>
                                    <input required name="room" defaultValue={editingCommittee?.room} placeholder="مثال: المختبر ١" className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2.5xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 font-black text-slate-800 transition-all font-header text-center" />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">السعة القصوى</label>
                                    <input required type="number" name="capacity" defaultValue={editingCommittee?.capacity} className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2.5xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 font-black text-slate-800 transition-all font-header text-center" />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">اسم المراقب الرئيسي</label>
                                <input required name="monitor" defaultValue={editingCommittee?.monitor} placeholder="الاسم ثلاثي..." className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2.5xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 font-black text-slate-800 transition-all font-header" />
                            </div>

                            <div className="flex gap-4 mt-6">
                                <button type="submit" className="flex-1 py-5 bg-indigo-600 text-white rounded-3xl font-black text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 active:scale-95 transition-all">اعتماد البيانات</button>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-10 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black hover:bg-slate-200 transition-all text-lg">إلغاء</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Auto-Distribute Modal ── */}
            {isDistributeOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border-none relative">
                        <div className="absolute top-0 right-0 w-full h-1.5 bg-gradient-to-l from-indigo-500 via-violet-500 to-indigo-500"></div>

                        <div className="p-10 pb-6 border-b border-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 font-header leading-tight">التوزيع الذكي القواتي</h3>
                                <p className="text-slate-400 font-medium text-xs mt-1">توزيع كتل الطلاب على القاعات المتاحة بضغطة زر واحدة</p>
                            </div>
                            <button onClick={() => setIsDistributeOpen(false)} className="p-4 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-2xl transition-all shadow-sm">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-10 space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">تحديد الصف الدراسي</label>
                                <select
                                    className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2.5xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100 font-black text-sm text-slate-800 appearance-none"
                                    value={selectedGrade}
                                    onChange={(e) => setSelectedGrade(e.target.value)}
                                >
                                    <option value="">-- اختر الصف الدراسي المستهدف --</option>
                                    {grades.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">توجيه التوزيع إلى</label>
                                <select
                                    className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2.5xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100 font-black text-sm text-slate-800 appearance-none"
                                    value={selectedCommittee}
                                    onChange={(e) => setSelectedCommittee(e.target.value)}
                                >
                                    <option value="">-- حدد اللجنة المستقبلة --</option>
                                    {committees.map(c => <option key={c.id} value={c.id}>{c.name} (المتبقي: {c.capacity - students.filter(s => s.committee === c.name.replace('لجنة ', '')).length} مقعد)</option>)}
                                </select>
                            </div>

                            <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 flex gap-4">
                                <AlertCircle size={24} className="text-indigo-500 shrink-0" />
                                <p className="text-xs font-bold text-indigo-700 leading-relaxed">
                                    سيقوم النظام بتوزيع الطلاب غير الموزعين من الصف المختار تلقائياً حتى اكتمال السعة الاستيعابية للجنة. يرجى التأكد من سعة اللجنة المختارة قبل البدء.
                                </p>
                            </div>

                            <div className="flex gap-4 mt-6">
                                <button
                                    onClick={handleAutoDistribute}
                                    className="flex-1 py-5 bg-indigo-600 text-white rounded-3xl font-black text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 active:scale-95 transition-all"
                                >
                                    <Wand2 size={24} /> تأكيد وتوزيع الطلاب
                                </button>
                                <button type="button" onClick={() => setIsDistributeOpen(false)} className="px-10 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black hover:bg-slate-200 transition-all text-lg">تجاهل</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Committees;
