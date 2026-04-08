import React, { useState, useEffect } from 'react';
import { MapPin, Building, Search, X, Plus, Edit2, Trash2, Download, Upload } from 'lucide-react';
import { getLocations, saveLocation, deleteLocation } from '../../utils/dataService';

const CommitteeLocations = () => {
    const [locations, setLocations] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const data = await getLocations();
        setLocations(data);
        setLoading(false);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            id: editingLocation?.id,
            committee: formData.get('committee'),
            building: formData.get('building'),
            floor: formData.get('floor'),
            room: formData.get('room'),
            capacity: parseInt(formData.get('capacity')),
        };
        await saveLocation(data);
        setIsModalOpen(false);
        setEditingLocation(null);
        fetchData();
    };

    const handleDelete = async (id) => {
        if (window.confirm('هل أنت متأكد من حذف هذا الموقع؟')) {
            await deleteLocation(id);
            fetchData();
        }
    };

    const handleExport = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(locations));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "locations.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">أماكن اللجان</h1>
                    <p className="text-gray-500 text-sm mt-1">إدارة خرائط وتوزيع لجان الاختبارات في المباني</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-6 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all shadow-sm"
                    >
                        <Download size={18} />
                        <span>تصدير البيانات</span>
                    </button>
                    <button
                        onClick={() => { setEditingLocation(null); setIsModalOpen(true); }}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                    >
                        <Plus size={18} />
                        <span>إضافة موقع</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-morphism rounded-3xl border border-gray-100 p-8 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                        <Building size={40} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">خريطة المدرسة التفاعلية</h3>
                        <p className="text-gray-500 text-sm mt-2 max-w-xs">يمكنك هنا رفع أو تصميم خريطة توضيحية لسهولة توجيه الطلاب والمراقبين.</p>
                    </div>
                    <button
                        onClick={() => alert('سيتم تفعيل ميزة رفع الخرائط قريباً')}
                        className="flex items-center gap-2 px-6 py-2 border border-indigo-200 text-indigo-600 rounded-xl hover:bg-indigo-50 transition-colors font-bold text-sm"
                    >
                        <Upload size={16} />
                        <span>رفع ملف الخريطة</span>
                    </button>
                </div>

                <div className="glass-morphism rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800">قائمة المواقع</h3>
                        <Search size={18} className="text-gray-400" />
                    </div>
                    <div className="divide-y divide-gray-100">
                        {loading ? (
                            <div className="p-10 text-center text-gray-400">جاري التحميل...</div>
                        ) : locations.length === 0 ? (
                            <div className="p-10 text-center text-gray-400">لا توجد مواقع مسجلة</div>
                        ) : locations.map((loc) => (
                            <div key={loc.id} className="p-5 hover:bg-indigo-50/30 transition-colors flex justify-between items-center group">
                                <div className="space-y-1">
                                    <div className="font-bold text-gray-800 flex items-center gap-2">
                                        {loc.committee}
                                        <button
                                            onClick={() => { setEditingLocation(loc); setIsModalOpen(true); }}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:bg-blue-50 rounded transition-all"
                                        >
                                            <Edit2 size={12} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(loc.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-50 rounded transition-all"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span className="flex items-center gap-1"><Building size={12} /> {loc.building}</span>
                                        <span className="flex items-center gap-1"><MapPin size={12} /> الدور {loc.floor}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-black text-indigo-600">غرفة {loc.room}</span>
                                    <div className="text-[10px] text-gray-400 mt-1">السعة: {loc.capacity} طالب</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-800">
                                {editingLocation ? 'تعديل بيانات الموقع' : 'إضافة موقع جديد'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">اسم اللجنة</label>
                                <input required name="committee" defaultValue={editingLocation?.committee} className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">المبنى</label>
                                    <input required name="building" defaultValue={editingLocation?.building} className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">الدور</label>
                                    <input required name="floor" defaultValue={editingLocation?.floor} className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">رقم/اسم الغرفة</label>
                                    <input required name="room" defaultValue={editingLocation?.room} className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">السعة الاستيعابية</label>
                                    <input required type="number" name="capacity" defaultValue={editingLocation?.capacity} className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100" />
                                </div>
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

export default CommitteeLocations;
