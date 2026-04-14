import React, { useState, useEffect } from 'react';
import { UserCheck, UsersRound, ArrowLeftRight, Check, X, ShieldCheck, UserPlus, SlidersHorizontal, UserCircle2, ChevronRight, LayoutGrid, CheckCircle2, RotateCcw } from 'lucide-react';
import { getCommittees, getObservers, getAssignments, saveAssignments } from '../../utils/dataService';

const CommitteeObservers = () => {
    const [committees, setCommittees] = useState([]);
    const [observers, setObservers] = useState([]);
    const [assignments, setAssignments] = useState({});
    const [isEditMode, setIsEditMode] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [cData, oData, aData] = await Promise.all([
            getCommittees(),
            getObservers(),
            getAssignments()
        ]);
        setCommittees(cData);
        setObservers(oData);
        setAssignments(aData);
        setLoading(false);
    };

    const handleSaveAssignments = async () => {
        await saveAssignments(assignments);
        setIsEditMode(false);
        // Custom success notification could be triggered here
    };

    const toggleObserver = (committeeId, observerId) => {
        if (!isEditMode) return;

        setAssignments(prev => {
            const current = prev[committeeId] || [];
            if (current.includes(observerId)) {
                return { ...prev, [committeeId]: current.filter(id => id !== observerId) };
            } else {
                return { ...prev, [committeeId]: [...current, observerId] };
            }
        });
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-40 opacity-20 font-alexandria">
            <UsersRound size={64} className="animate-pulse mb-4 text-slate-400" />
            <p className="font-black text-xl text-slate-600 tracking-tighter uppercase">جاري مزامنة بيانات المراقبين...</p>
        </div>
    );

    return (
        <div className="space-y-10 animate-in fade-in duration-700 font-alexandria pb-20">
            {/* ── Page Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2.5xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                            <UserCheck size={24} />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 font-header tracking-tight">توزيع المراقبين</h1>
                    </div>
                    <p className="text-slate-400 font-medium text-sm flex items-center gap-2">
                        <ArrowLeftRight size={16} className="text-indigo-400" />
                        نظام الإسناد السريع للمعلمين والمراقبين على قاعات الاختبارات
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => window.location.hash = '/observers'}
                        className="px-6 py-4 bg-white text-slate-600 rounded-3xl font-black text-sm hover:bg-slate-50 transition-all shadow-sm border border-slate-100 flex items-center gap-3"
                    >
                        <UserPlus size={20} className="text-indigo-500" /> إدارة الكوادر
                    </button>
                    <button
                        onClick={isEditMode ? handleSaveAssignments : () => setIsEditMode(true)}
                        className={`px-8 py-4 rounded-3xl font-black text-sm transition-all shadow-xl active:scale-95 flex items-center gap-3
                          ${isEditMode ? 'bg-emerald-500 text-white shadow-emerald-100 hover:bg-emerald-600' : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'}`}
                    >
                        {isEditMode ? <Check size={20} /> : <ShieldCheck size={20} />}
                        <span>{isEditMode ? 'حفظ التشكيل النهائي' : 'بدء عملية التوزيع'}</span>
                    </button>
                </div>
            </div>

            {/* ── Status Banner for Edit Mode ── */}
            {isEditMode && (
                <div className="bg-indigo-900 text-white p-6 rounded-[2rem] shadow-2xl animate-in slide-in-from-top-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center animate-pulse">
                              <SlidersHorizontal size={24} />
                           </div>
                           <div>
                              <p className="text-lg font-black font-header leading-tight">وضع التوزيع التفاعلي مفعل</p>
                              <p className="text-indigo-200 text-xs font-bold opacity-80 uppercase tracking-widest mt-0.5">انقر على أسماء المراقبين لإضافتهم أو إزالتهم من القافلة</p>
                           </div>
                        </div>
                        <button onClick={() => setIsEditMode(false)} className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-2xl font-black text-xs transition-colors flex items-center gap-2">
                           <X size={16} /> إلغاء التعديلات
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-2">
                {/* ── Committee Assignments ── */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 px-2">
                        <LayoutGrid size={20} className="text-indigo-500" />
                        <h2 className="text-xl font-black text-slate-800 font-header uppercase tracking-tight">تشكيل اللجان الحالي</h2>
                    </div>

                    <div className="space-y-4">
                        {committees.map(committee => {
                            const assignedCount = assignments[committee.id]?.length || 0;
                            return (
                                <div key={committee.id} className="luxury-card p-0 overflow-hidden bg-white border-none shadow-premium transition-all duration-300">
                                    <div className="p-8 pb-4 flex justify-between items-center group">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${assignedCount > 0 ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                                <UsersRound size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-800 font-header">{committee.name}</h3>
                                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-0.5">{committee.room}</p>
                                            </div>
                                        </div>
                                        <div className={`flex flex-col items-end ${assignedCount > 0 ? 'opacity-100' : 'opacity-40'}`}>
                                            <span className="text-2xl font-black text-slate-800 font-header leading-none">{assignedCount}</span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">مراقب مخصص</span>
                                        </div>
                                    </div>

                                    <div className="px-8 pb-8 pt-4">
                                        <div className="flex flex-wrap gap-2">
                                            {assignments[committee.id]?.map(obsId => {
                                                const observer = observers.find(o => o.id === obsId);
                                                return (
                                                    <div key={obsId} className="flex items-center gap-3 bg-slate-50 border border-slate-100/50 rounded-2xl px-4 py-3 group/tag hover:bg-white hover:shadow-sm transition-all animate-in fade-in zoom-in-95">
                                                        <UserCircle2 size={16} className="text-indigo-400" />
                                                        <span className="text-sm font-black text-slate-700">{observer?.name || 'مراقب عام'}</span>
                                                        {isEditMode && (
                                                            <button 
                                                                onClick={() => toggleObserver(committee.id, obsId)} 
                                                                className="w-6 h-6 bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition-all flex items-center justify-center ml-1"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {assignedCount === 0 && (
                                                <div className="flex items-center gap-3 py-3 px-2 opacity-50 italic">
                                                    <CheckCircle2 size={16} className="text-slate-300" />
                                                    <span className="text-xs font-bold text-slate-400">بانتظار تخصيص الكوادر...</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Assignment Pool ── */}
                <div className="space-y-6 flex flex-col h-full">
                    <div className="flex items-center gap-3 px-2">
                        <UserCheck size={20} className="text-indigo-500" />
                        <h2 className="text-xl font-black text-slate-800 font-header uppercase tracking-tight">مستودع الكوادر المتاح</h2>
                    </div>

                    <div className={`luxury-card p-0 flex flex-col bg-white border-none shadow-premium overflow-hidden h-fit sticky top-10 transition-all duration-700 ${isEditMode ? 'ring-4 ring-indigo-500/20 scale-[1.02]' : ''}`}>
                        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-slate-800 font-header">قائمة المعلمين المتاحين</h3>
                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">انقر للتوزيع على اللجان المحددة</p>
                            </div>
                            <button onClick={fetchData} className="p-3 bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-2xl transition-all">
                                <RotateCcw size={18} />
                            </button>
                        </div>

                        <div className="p-8 space-y-10 max-h-[700px] overflow-y-auto custom-scrollbar">
                            {!isEditMode ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-50 grayscale transition-all">
                                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                                       <ShieldCheck size={40} />
                                    </div>
                                    <div>
                                       <p className="font-black text-slate-600">لوحة التوزيع المؤقتة مقفلة</p>
                                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">فعل "بدء عملية التوزيع" للتحكم</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-10 animate-in fade-in duration-500">
                                    {committees.map(committee => (
                                        <div key={`pool-${committee.id}`} className="space-y-4 group">
                                            <div className="flex items-center gap-3">
                                               <div className="w-1 h-6 bg-indigo-600 rounded-full group-hover:h-8 transition-all"></div>
                                               <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">{committee.name}</h4>
                                            </div>
                                            <div className="flex flex-wrap gap-3">
                                                {observers.map(observer => {
                                                    const isAssigned = assignments[committee.id]?.includes(observer.id);
                                                    return (
                                                        <button
                                                            key={`${committee.id}-${observer.id}`}
                                                            onClick={() => toggleObserver(committee.id, observer.id)}
                                                            className={`px-5 py-4 rounded-[1.5rem] text-sm font-black transition-all border relative overflow-hidden group/btn flex items-center gap-3
                                                              ${isAssigned
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-100 scale-105'
                                                                : 'bg-white text-slate-500 border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-600 shadow-sm'
                                                              }`}
                                                        >
                                                            <div className={`w-2 h-2 rounded-full ${isAssigned ? 'bg-white animate-pulse' : 'bg-slate-200'}`}></div>
                                                            {observer.name}
                                                            {isAssigned && (
                                                                <div className="absolute top-0 right-0 p-1">
                                                                   <Check size={10} className="text-indigo-200" />
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="p-8 bg-slate-50/50 border-t border-slate-50">
                            <div className="flex items-center gap-3 text-slate-400">
                                <AlertCircle size={16} className="text-indigo-500" />
                                <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                                    تلميح: يمكنك إسناد المعلم الواحد لأكثر من لجنة في حال الضرورة
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommitteeObservers;
