import React, { useState, useEffect } from 'react';
import { LayoutGrid, Users, User, ArrowRightLeft, Shield, Plus, MoreVertical, Wand2, X, Edit2, Trash2 } from 'lucide-react';
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
        if (window.confirm('هل أنت متأكد من حذف هذه اللجنة؟')) {
            await deleteCommittee(id);
            fetchData();
        }
    };

    const handleAutoDistribute = async () => {
        if (!selectedGrade || !selectedCommittee) {
            alert('يرجى اختيار الصف واللجنة');
            return;
        }

        const committeeObj = committees.find(c => c.id === selectedCommittee);
        const committeeNameOnly = committeeObj.name.replace('لجنة ', '');
        const currentInCommittee = students.filter(s => s.committee === committeeNameOnly).length;
        const availableSpace = committeeObj.capacity - currentInCommittee;

        if (availableSpace <= 0) {
            alert('هذه اللجنة ممتلئة بالفعل');
            return;
        }

        const unboundStudents = students.filter(s => s.grade === selectedGrade && (!s.committee || s.committee === ''));
        const toDistribute = unboundStudents.slice(0, availableSpace);

        if (toDistribute.length === 0) {
            alert('لا يوجد طلاب غير موزعين في هذا الصف');
            return;
        }

        for (const student of toDistribute) {
            await saveStudent({ ...student, committee: committeeNameOnly });
        }

        alert(`تم توزيع ${toDistribute.length} طالب بنجاح`);
        setIsDistributeOpen(false);
        fetchData();
    };

    const grades = [...new Set(students.map(s => s.grade))];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">إدارة اللجان</h1>
                    <p className="text-gray-500 text-sm mt-1">تجهيز وتوزيع الطلاب على القاعات الامتحانية</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => setIsDistributeOpen(true)}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 border border-indigo-100 transition-all font-bold"
                    >
                        <Wand2 size={18} />
                        <span>توزيع تلقائي</span>
                    </button>
                    <button
                        onClick={() => { setEditingCommittee(null); setIsModalOpen(true); }}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                    >
                        <Plus size={18} />
                        <span>إضافة لجنة</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="p-20 text-center text-gray-400">جاري التحميل...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {committees.map((committee) => {
                        const committeeNameOnly = committee.name.replace('لجنة ', '');
                        const studentCount = students.filter(s => s.committee === committeeNameOnly).length;
                        const occupancy = (studentCount / committee.capacity) * 100;

                        return (
                            <div key={committee.id} className="glass-morphism rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-xl transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        <LayoutGrid size={24} />
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => { setEditingCommittee(committee); setIsModalOpen(true); }}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(committee.id)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-gray-800 mb-1">{committee.name}</h3>
                                <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
                                    <Shield size={14} />
                                    <span>{committee.room}</span>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-gray-50 rounded-2xl p-4">
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-gray-500">إشغال اللجنة</span>
                                            <span className="font-bold text-gray-700">{studentCount} / {committee.capacity}</span>
                                        </div>
                                        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-500 ${occupancy > 90 ? 'bg-red-500' : 'bg-indigo-500'}`}
                                                style={{ width: `${occupancy}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 pt-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                            <User size={16} />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400">المراقب</p>
                                            <p className="text-sm font-semibold text-gray-700">{committee.monitor}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-800">
                                {editingCommittee ? 'تعديل بيانات اللجنة' : 'إضافة لجنة جديدة'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">اسم اللجنة</label>
                                <input required name="name" defaultValue={editingCommittee?.name} placeholder="مثال: لجنة 1" className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">القاعة / الغرفة</label>
                                    <input required name="room" defaultValue={editingCommittee?.room} className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">السعة</label>
                                    <input required type="number" name="capacity" defaultValue={editingCommittee?.capacity} className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">اسم المراقب الرئيسي</label>
                                <input required name="monitor" defaultValue={editingCommittee?.monitor} className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100" />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100">حفظ</button>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">إلغاء</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isDistributeOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-800">توزيع الطلاب تلقائياً</h3>
                            <button onClick={() => setIsDistributeOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">اختر الصف</label>
                                <select
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 bg-white"
                                    value={selectedGrade}
                                    onChange={(e) => setSelectedGrade(e.target.value)}
                                >
                                    <option value="">-- اختر الصف --</option>
                                    {grades.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">توزيع في</label>
                                <select
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 bg-white"
                                    value={selectedCommittee}
                                    onChange={(e) => setSelectedCommittee(e.target.value)}
                                >
                                    <option value="">-- اختر اللجنة --</option>
                                    {committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="bg-indigo-50 p-4 rounded-xl text-xs text-indigo-700 leading-relaxed">
                                سيقوم النظام بتوزيع الطلاب غير الموزعين من الصف المختار إلى اللجنة المختارة حتى اكتمال سعتها.
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={handleAutoDistribute}
                                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                                >
                                    تأكيد التوزيع
                                </button>
                                <button type="button" onClick={() => setIsDistributeOpen(false)} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">إلغاء</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Committees;
