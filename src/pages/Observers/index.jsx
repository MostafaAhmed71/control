import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Search, Mail, Phone, Edit2, Trash2, X, Users, Briefcase, GraduationCap, ChevronRight, UserCircle2, ShieldCheck, Filter, RotateCcw } from 'lucide-react';
import { getObservers, saveObserver, deleteObserver } from '../../utils/dataService';

const Observers = () => {
    const [observers, setObservers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingObserver, setEditingObserver] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const data = await getObservers();
        setObservers(data);
        setLoading(false);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            id: editingObserver?.id,
            name: formData.get('name'),
            role: formData.get('role'),
            department: formData.get('department'),
            phone: formData.get('phone'),
            email: formData.get('email'),
        };
        await saveObserver(data);
        setIsModalOpen(false);
        setEditingObserver(null);
        fetchData();
    };

    const handleDelete = async (id) => {
        if (window.confirm('هل أنت متأكد من حذف بيانات هذا المعلم بشكل نهائي؟')) {
            await deleteObserver(id);
            fetchData();
        }
    };

    const filteredObservers = observers.filter(o =>
        o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.department.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-10 animate-in fade-in duration-700 font-alexandria pb-20">
            {/* ── Page Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2.5xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                            <Users size={24} />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 font-header tracking-tight">سجل الكوادر التعليمية</h1>
                    </div>
                    <p className="text-slate-400 font-medium text-sm flex items-center gap-2">
                        <ShieldCheck size={16} className="text-indigo-400" />
                        إدارة بيانات المعلمين، الملاحظين، والمشرفين العموميين على لجان الاختبارات
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { setEditingObserver(null); setIsModalOpen(true); }}
                        className="px-8 py-4 bg-indigo-600 text-white rounded-3xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 flex items-center gap-3"
                    >
                        <Plus size={20} /> إضافة كادر جديد
                    </button>
                </div>
            </div>

            {/* ── Search & Filter Bar ── */}
            <div className="luxury-card p-6 bg-white/60 backdrop-blur-xl border-white flex flex-col md:flex-row items-center gap-6">
                <div className="relative flex-1 group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="ابحث عن معلم بالاسم، أو القسم التخصصي..."
                        className="w-full pl-16 pr-8 py-5 bg-slate-50 border border-transparent rounded-[2rem] focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-bold text-slate-700"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-4 px-6 py-4 bg-indigo-50/50 rounded-[2rem] border border-indigo-100">
                    <Filter size={18} className="text-indigo-400" />
                    <span className="text-xs font-black text-indigo-600 uppercase tracking-widest whitespace-nowrap">إجمالي الكوادر: {observers.length} معلم</span>
                </div>
            </div>

            {/* ── Observers Grid ── */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-40 opacity-20">
                    <Users size={64} className="animate-pulse mb-4 text-slate-400" />
                    <p className="font-black text-xl text-slate-600 tracking-tighter uppercase">مزمنة سجلات الكادر...</p>
                </div>
            ) : filteredObservers.length === 0 ? (
                <div className="luxury-card py-40 flex flex-col items-center justify-center space-y-4 opacity-40">
                    <UserCircle2 size={64} className="text-slate-200" />
                    <p className="font-black text-slate-400 uppercase tracking-[0.3em] text-xs">لا يوجد نتائج تطابق البحث</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-2">
                    {filteredObservers.map((observer) => (
                        <div key={observer.id} className="luxury-card group p-0 overflow-hidden bg-white border-none shadow-premium transition-all duration-500 hover:-translate-y-2">
                            {/* Accent Line */}
                            <div className="h-1.5 w-full bg-gradient-to-l from-indigo-500 to-violet-500 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                            
                            <div className="p-8">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-16 h-16 bg-slate-50 rounded-2.5xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-sm">
                                        <UserCheck size={32} />
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                                        <button
                                            onClick={() => { setEditingObserver(observer); setIsModalOpen(true); }}
                                            className="p-3 bg-white text-indigo-600 rounded-2xl hover:bg-slate-900 hover:text-white transition-all shadow-sm border border-slate-50"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(observer.id)}
                                            className="p-3 bg-white text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-sm border border-slate-50"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-slate-800 font-header leading-tight">{observer.name}</h3>
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        <span className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100/50">
                                           <Briefcase size={12} /> {observer.role}
                                        </span>
                                        <span className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100">
                                           <GraduationCap size={12} /> {observer.department}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-50 space-y-4">
                                    <div className="flex items-center justify-between group/contact">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover/contact:text-indigo-500 transition-colors">
                                                <Phone size={18} />
                                            </div>
                                            <span className="text-sm font-black text-slate-600">{observer.phone}</span>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-200" />
                                    </div>
                                    <div className="flex items-center justify-between group/contact">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover/contact:text-indigo-500 transition-colors">
                                                <Mail size={18} />
                                            </div>
                                            <span className="text-sm font-black text-slate-600 truncate max-w-[180px]">{observer.email || '—'}</span>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-200" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Observer Modal ── */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border-none relative">
                        <div className="absolute top-0 right-0 w-full h-1.5 bg-gradient-to-l from-indigo-500 via-violet-500 to-indigo-500"></div>

                        <div className="p-10 pb-6 border-b border-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 font-header leading-tight">
                                    {editingObserver ? 'تعديل بيانات الكادر' : 'إضافة كادر تعليمي جديد'}
                                </h3>
                                <p className="text-slate-400 font-medium text-xs mt-1">أدخل بيانات الهوية والتخصص الوظيفي بشكل دقيق</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-4 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-2xl transition-all shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-10 space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">الاسم الكامل (ثلاثي)</label>
                                <input required name="name" defaultValue={editingObserver?.name} placeholder="مثال: أحمد محمد علي" className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2.5xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 font-black text-slate-800 transition-all font-header" />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">المسمى الوظيفي</label>
                                    <input required name="role" defaultValue={editingObserver?.role} placeholder="مثال: معلم أول" className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2.5xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 font-black text-slate-800 transition-all font-header text-center" />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">القسم / التخصص</label>
                                    <input required name="department" defaultValue={editingObserver?.department} placeholder="مثال: الرياضيات" className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2.5xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 font-black text-slate-800 transition-all font-header text-center" />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">رقم الهاتف الجوال</label>
                                <input required name="phone" defaultValue={editingObserver?.phone} placeholder="05xxxxxxxx" className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2.5xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 font-black text-slate-800 transition-all font-header" />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">البريد الإلكتروني (اختياري)</label>
                                <input name="email" defaultValue={editingObserver?.email} placeholder="name@school.com" className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2.5xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 font-black text-slate-800 transition-all font-header" />
                            </div>

                            <div className="flex gap-4 mt-6">
                                <button type="submit" className="flex-1 py-5 bg-indigo-600 text-white rounded-3xl font-black text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 active:scale-95 transition-all">اعتماد البيانات</button>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-10 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black hover:bg-slate-200 transition-all text-lg">إلغاء</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Observers;
