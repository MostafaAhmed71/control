import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Search, Mail, Phone, Edit2, Trash2, X } from 'lucide-react';
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
        if (window.confirm('هل أنت متأكد من حذف هذا الملاحظ؟')) {
            await deleteObserver(id);
            fetchData();
        }
    };

    const filteredObservers = observers.filter(o =>
        o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.department.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">إدارة المعلمين</h1>
                    <p className="text-gray-500 text-sm mt-1">إضافة وتعديل بيانات المعلمين والمراقبين</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => { setEditingObserver(null); setIsModalOpen(true); }}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                    >
                        <Plus size={18} />
                        <span>إضافة مراقب جديد</span>
                    </button>
                </div>
            </div>

            <div className="glass-morphism rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                    <div className="relative max-w-md w-full">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="ابحث بالاسم أو القسم..."
                            className="w-full pr-10 pl-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-20 text-center text-gray-400">جاري التحميل...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 p-6 gap-6">
                        {filteredObservers.map((observer) => (
                            <div key={observer.id} className="relative bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                                <div className="absolute top-0 right-0 w-1 bg-indigo-500 h-full"></div>

                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                                        <UserCheck size={24} />
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => { setEditingObserver(observer); setIsModalOpen(true); }}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(observer.id)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <h3 className="font-bold text-gray-800 text-lg">{observer.name}</h3>
                                <p className="text-xs font-semibold text-indigo-600 bg-indigo-50 inline-block px-2 py-0.5 rounded-full mt-1">
                                    {observer.role} - {observer.department}
                                </p>

                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Phone size={14} className="text-gray-400" />
                                        <span>{observer.phone}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Mail size={14} className="text-gray-400" />
                                        <span className="truncate">{observer.email}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-800">
                                {editingObserver ? 'تعديل بيانات مراقب' : 'إضافة مراقب جديد'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">اسم المراقب</label>
                                <input required name="name" defaultValue={editingObserver?.name} className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">المسمى الوظيفي</label>
                                    <input required name="role" defaultValue={editingObserver?.role} className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">القسم</label>
                                    <input required name="department" defaultValue={editingObserver?.department} className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">رقم الهاتف</label>
                                <input required name="phone" defaultValue={editingObserver?.phone} className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">البريد الإلكتروني</label>
                                <input name="email" defaultValue={editingObserver?.email} className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100" />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100">حفظ</button>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">إلغاء</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Observers;
