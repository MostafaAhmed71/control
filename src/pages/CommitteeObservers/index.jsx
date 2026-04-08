import React, { useState, useEffect } from 'react';
import { UserCheck, UsersRound, ArrowLeftRight, Check, X, ShieldCheck, UserPlus } from 'lucide-react';
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
        alert('تم حفظ توزيع الملاحظين بنجاح');
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

    if (loading) return <div className="p-20 text-center text-gray-400">جاري التحميل...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">توزيع الملاحظين</h1>
                    <p className="text-gray-500 text-sm mt-1">تخصيص المعلمين على لجان الاختبارات</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => window.location.hash = '/observers'}
                        className="flex items-center gap-2 px-6 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all shadow-sm active:scale-95"
                    >
                        <UserPlus size={18} />
                        <span>إضافة معلم جديد</span>
                    </button>
                    <button
                        onClick={isEditMode ? handleSaveAssignments : () => setIsEditMode(true)}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl transition-all shadow-md active:scale-95 ${isEditMode ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                    >
                        {isEditMode ? <Check size={18} /> : <ShieldCheck size={18} />}
                        <span>{isEditMode ? 'حفظ التوزيع' : 'بدء التوزيع'}</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Committees Distribution */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                        <UsersRound className="text-indigo-500" size={20} />
                        <span>اللجان والمراقبين الحاليين</span>
                    </h2>
                    {committees.map(committee => {
                        const committeeNameOnly = committee.name.replace('لجنة ', '');
                        // Map committee ID or Name to assignments. Here we use ID for consistency.
                        return (
                            <div key={committee.id} className="glass-morphism rounded-2xl border border-gray-100 p-6 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h3 className="font-bold text-gray-800">{committee.name}</h3>
                                        <p className="text-xs text-gray-400">{committee.room}</p>
                                    </div>
                                    <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">
                                        {assignments[committee.id]?.length || 0} ملاحظين
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {assignments[committee.id]?.map(obsId => {
                                        const observer = observers.find(o => o.id === obsId);
                                        return (
                                            <div key={obsId} className="flex items-center gap-2 bg-white border border-indigo-100 rounded-lg px-3 py-2 text-sm text-gray-700 shadow-sm animate-in fade-in slide-in-from-right-2">
                                                <UserCheck size={14} className="text-indigo-500" />
                                                <span className="font-medium">{observer?.name || 'ملاحظ غير معروف'}</span>
                                                {isEditMode && (
                                                    <button onClick={() => toggleObserver(committee.id, obsId)} className="text-red-400 hover:text-red-600 ml-1">
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {(!assignments[committee.id] || assignments[committee.id].length === 0) && (
                                        <div className="text-sm text-gray-400 italic">لا يوجد ملاحظين مخصصين بعد</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Observer Pool */}
                {isEditMode && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                        <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                            <UserCheck className="text-indigo-500" size={20} />
                            <span>قائمة الملاحظين المتاحين</span>
                        </h2>
                        <div className="glass-morphism rounded-2xl border border-indigo-200 border-dashed p-6 bg-indigo-50/10 h-fit sticky top-6">
                            <p className="text-sm text-gray-500 mb-4 block">انقر على الملاحظ لتخصيصه للجنة أو إزالته.</p>
                            <div className="space-y-6">
                                {committees.map(committee => (
                                    <div key={`pool-${committee.id}`} className="space-y-2">
                                        <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">{committee.name}</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {observers.map(observer => {
                                                const isAssigned = assignments[committee.id]?.includes(observer.id);
                                                return (
                                                    <button
                                                        key={`${committee.id}-${observer.id}`}
                                                        onClick={() => toggleObserver(committee.id, observer.id)}
                                                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${isAssigned
                                                            ? 'bg-indigo-600 text-white border-indigo-600 ring-4 ring-indigo-50 shadow-md'
                                                            : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
                                                            }`}
                                                    >
                                                        {observer.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommitteeObservers;
