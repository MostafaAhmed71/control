import React, { useState, useEffect } from 'react';
import { 
    Settings as SettingsIcon, 
    Shield, 
    Database, 
    MessageSquare, 
    Layout, 
    Save, 
    RefreshCcw, 
    Download, 
    Upload, 
    CheckCircle2, 
    AlertCircle,
    School,
    Type
} from 'lucide-react';
import { getAppSettings, saveAppSettings, clearAllData } from '../../utils/dataService';

const Settings = () => {
    const [activeTab, setActiveTab] = useState('identity');
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState({ type: '', msg: '' });

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const data = await getAppSettings();
        setConfig(data);
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveAppSettings(config);
            setStatus({ type: 'success', msg: 'تم حفظ جميع الإعدادات بنجاح!' });
            setTimeout(() => setStatus({ type: '', msg: '' }), 3000);
        } catch (error) {
            setStatus({ type: 'error', msg: 'حدث خطأ أثناء الحفظ' });
        } finally {
            setSaving(false);
        }
    };

    const updateNested = (section, field, value, subfield = null) => {
        setConfig(prev => {
            const newConfig = { ...prev };
            if (subfield) {
                newConfig[section][field][subfield] = value;
            } else {
                newConfig[section][field] = value;
            }
            return newConfig;
        });
    };

    const exportData = () => {
        const data = {};
        const keys = ['students', 'committees', 'observers', 'locations', 'assignments', 'omr_exams', 'omr_results', 'app_config'];
        keys.forEach(key => {
            data[key] = JSON.parse(localStorage.getItem(key)) || [];
        });
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `control_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    const importData = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                Object.entries(data).forEach(([key, value]) => {
                    localStorage.setItem(key, JSON.stringify(value));
                });
                alert('تم استيراد البيانات بنجاح! سيتم إعادة تحميل الصفحة.');
                window.location.reload();
            } catch (err) {
                alert('خطأ في تنسيق الملف');
            }
        };
        reader.readAsText(file);
    };

    if (loading) return <div className="p-20 text-center gold-text font-bold">جاري تحميل مركز التحكم...</div>;

    const TabButton = ({ id, icon: Icon, label }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all duration-300 ${
                activeTab === id 
                ? 'bg-[#d4af37] text-[#0c1427] shadow-lg shadow-gold/20 scale-105' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
        >
            <Icon size={20} />
            <span>{label}</span>
        </button>
    );

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 glass p-8 rounded-3xl border border-white/10">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gold/10 rounded-2xl flex items-center justify-center text-gold border border-gold/20">
                        <SettingsIcon size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black gold-text italic tracking-tight">مركز التحكم الشامل</h1>
                        <p className="text-slate-400 text-sm mt-1 font-medium">إدارة حصرية لجميع معايير وقوالب المنصة</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {status.msg && (
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold animate-in zoom-in ${
                            status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}>
                            {status.type === 'success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
                            {status.msg}
                        </div>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-8 py-3 bg-[#d4af37] text-[#0c1427] rounded-2xl font-black hover:brightness-110 transition-all shadow-xl shadow-gold/10 active:scale-95 disabled:opacity-50"
                    >
                        {saving ? <RefreshCcw size={20} className="animate-spin" /> : <Save size={20} />}
                        <span>حفظ التغييرات</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Tabs */}
                <div className="lg:w-64 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0">
                    <TabButton id="identity" icon={School} label="هوية المنصة" />
                    <TabButton id="attendance" icon={Layout} label="قوالب الحضور" />
                    <TabButton id="cards" icon={Type} label="قوالب البطاقات" />
                    <TabButton id="messages" icon={MessageSquare} label="قوالب الرسائل" />
                    <TabButton id="data" icon={Database} label="مركز البيانات" />
                    <TabButton id="security" icon={Shield} label="الأمان" />
                </div>

                {/* Content Area */}
                <div className="flex-1 glass p-8 rounded-[2.5rem] border border-white/10 shadow-2xl min-h-[500px]">
                    
                    {/* Identity Tab */}
                    {activeTab === 'identity' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <School className="text-gold" size={24} /> هوية المدرسة والمنصة
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-400 mr-2">اسم المنصة الرسمي</label>
                                    <input 
                                        type="text"
                                        value={config.platformName}
                                        onChange={(e) => setConfig({...config, platformName: e.target.value})}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-gold/50 transition-all font-bold"
                                        placeholder="مثال: كنترول نخبة الشمال"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-400 mr-2">مدير المدرسة / رئيس اللجنة</label>
                                    <input 
                                        type="text"
                                        value={config.managerName}
                                        onChange={(e) => setConfig({...config, managerName: e.target.value})}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-gold/50 transition-all font-bold"
                                        placeholder="الاسم كاملاً"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-400 mr-2">العام الدراسي</label>
                                    <input 
                                        type="text"
                                        value={config.academicWeight}
                                        onChange={(e) => setConfig({...config, academicWeight: e.target.value})}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-gold/50 transition-all font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-400 mr-2">لون السمة الرئيسي</label>
                                    <div className="flex gap-4 items-center">
                                        <input 
                                            type="color"
                                            value={config.primaryColor}
                                            onChange={(e) => setConfig({...config, primaryColor: e.target.value})}
                                            className="w-16 h-16 bg-transparent border-none rounded-2xl cursor-pointer"
                                        />
                                        <span className="font-mono text-gold uppercase">{config.primaryColor}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Attendance Tab */}
                    {activeTab === 'attendance' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Layout className="text-gold" size={24} /> معايير كشوف الحضور
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6 bg-white/5 p-6 rounded-3xl border border-white/10">
                                    <h4 className="font-bold gold-text border-b border-white/5 pb-2">إعدادات الجدول العرضية</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs text-slate-400 font-bold flex justify-between mb-2">
                                                <span>نسبة بداية الجدول (من أعلى)</span>
                                                <span className="text-gold">{config.attendance.table.startTop}%</span>
                                            </label>
                                            <input type="range" min="0" max="100" step="0.5" value={config.attendance.table.startTop} 
                                                onChange={(e) => updateNested('attendance', 'table', parseFloat(e.target.value), 'startTop')}
                                                className="w-full h-1.5 bg-white/10 rounded-lg cursor-pointer accent-gold" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 font-bold flex justify-between mb-2">
                                                <span>ارتفاع الصف الواحد</span>
                                                <span className="text-gold">{config.attendance.table.rowHeight}%</span>
                                            </label>
                                            <input type="range" min="1" max="10" step="0.1" value={config.attendance.table.rowHeight} 
                                                onChange={(e) => updateNested('attendance', 'table', parseFloat(e.target.value), 'rowHeight')}
                                                className="w-full h-1.5 bg-white/10 rounded-lg cursor-pointer accent-gold" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 font-bold flex justify-between mb-2">
                                                <span>عدد الطلاب المسموح في الصفحة</span>
                                                <span className="text-gold">{config.attendance.maxRows} طالب</span>
                                            </label>
                                            <input type="range" min="5" max="40" step="1" value={config.attendance.maxRows} 
                                                onChange={(e) => setConfig({...config, attendance: {...config.attendance, maxRows: parseInt(e.target.value)}})}
                                                className="w-full h-1.5 bg-white/10 rounded-lg cursor-pointer accent-gold" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6 bg-white/5 p-6 rounded-3xl border border-white/10">
                                    <h4 className="font-bold gold-text border-b border-white/5 pb-2">تموضع الأعمدة (يمين/يسار)</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            {id: 'nameRight', label: 'الاسم'},
                                            {id: 'seatRight', label: 'الجلوس'},
                                            {id: 'indexRight', label: 'التسلسل'},
                                            {id: 'gradeRight', label: 'الصف'},
                                            {id: 'signatureRight', label: 'التوقيع'}
                                        ].map(col => (
                                            <div key={col.id} className="space-y-2">
                                                <label className="text-[10px] text-slate-500 font-black uppercase tracking-tight">{col.label}</label>
                                                <input type="number" step="0.5" value={config.attendance.table[col.id]} 
                                                    onChange={(e) => updateNested('attendance', 'table', parseFloat(e.target.value), col.id)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Seating Cards Tab */}
                    {activeTab === 'cards' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Type className="text-gold" size={24} /> معايير بطاقات الجلوس الملونة
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {['name', 'seatNumber', 'grade', 'committee'].map(field => (
                                    <div key={field} className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-6">
                                        <h4 className="font-black text-gold uppercase tracking-widest text-xs border-b border-white/5 pb-2">
                                            {field === 'name' ? 'حقل الاسم' : field === 'seatNumber' ? 'حقل رقم الجلوس' : field === 'grade' ? 'حقل الصف' : 'حقل اللجنة'}
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] text-slate-500 block mb-1">أعلى %</label>
                                                <input type="number" step="0.5" value={config.seating[field].top} 
                                                    onChange={(e) => updateNested('seating', field, parseFloat(e.target.value), 'top')}
                                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-500 block mb-1">يمين %</label>
                                                <input type="number" step="0.5" value={config.seating[field].right} 
                                                    onChange={(e) => updateNested('seating', field, parseFloat(e.target.value), 'right')}
                                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 block mb-1">حجم الخط (مضاعف)</label>
                                            <input type="range" min="0.5" max="4" step="0.1" value={config.seating[field].fontSize} 
                                                onChange={(e) => updateNested('seating', field, parseFloat(e.target.value), 'fontSize')}
                                                className="w-full h-1.5 bg-white/10 rounded-lg cursor-pointer accent-gold" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Messages Tab */}
                    {activeTab === 'messages' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <MessageSquare className="text-gold" size={24} /> قوالب رسائل الواتساب
                            </h3>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-400 mr-2 flex justify-between">
                                        <span>رسالة إشعار اللجنة وبطاقة الجلوس</span>
                                        <span className="text-[10px] text-gold uppercase font-bold">استخدم {'{name}'} لاسم الطالب</span>
                                    </label>
                                    <textarea 
                                        rows="4"
                                        value={config.messages.committee}
                                        onChange={(e) => updateNested('messages', 'committee', e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-gold/50 transition-all font-medium leading-relaxed"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-400 mr-2 flex justify-between">
                                        <span>رسالة إرسال الشهادة / النتيجة</span>
                                        <span className="text-[10px] text-gold uppercase font-bold">استخدم {'{name}'} لاسم الطالب</span>
                                    </label>
                                    <textarea 
                                        rows="4"
                                        value={config.messages.result}
                                        onChange={(e) => updateNested('messages', 'result', e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-gold/50 transition-all font-medium leading-relaxed"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Data Tab */}
                    {activeTab === 'data' && (
                        <div className="space-y-12 animate-in fade-in slide-in-from-right-4">
                            <div className="bg-gold/5 p-8 rounded-[2.5rem] border border-gold/10">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                                    <Database className="text-gold" size={24} /> مركز إدارة البيانات الشامل
                                </h3>
                                <p className="text-slate-400 text-sm leading-relaxed mb-8">
                                    قم بتأمين بياناتك عبر تصدير نسخة احتياطية كاملة تشمل الطلاب، المعلمين، اللجان، وإعدادات النظام. يمكنك استعادة هذه النسخة في أي وقت أو نقلها لجهاز آخر.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button 
                                        onClick={exportData}
                                        className="flex items-center justify-center gap-3 p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-gold hover:text-navy transition-all duration-500 group"
                                    >
                                        <Download size={24} className="group-hover:scale-110 transition-transform" />
                                        <div className="text-right">
                                            <div className="font-black">تصدير نسخة احتياطية</div>
                                            <div className="text-[10px] opacity-60">تنزيل ملف JSON شامل</div>
                                        </div>
                                    </button>
                                    <label className="flex items-center justify-center gap-3 p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-emerald-500 hover:text-white transition-all duration-500 group cursor-pointer">
                                        <Upload size={24} className="group-hover:scale-110 transition-transform" />
                                        <div className="text-right">
                                            <div className="font-black">استيراد بيانات خارجية</div>
                                            <div className="text-[10px] opacity-60">رفع ملف نسخة احتياطية</div>
                                        </div>
                                        <input type="file" accept=".json" onChange={importData} className="hidden" />
                                    </label>
                                </div>
                            </div>

                            <div className="bg-red-500/5 p-8 rounded-[2.5rem] border border-red-500/10">
                                <h3 className="text-xl font-bold text-red-500 flex items-center gap-2 mb-2">منطقة الخطر</h3>
                                <p className="text-slate-400 text-xs mb-6">هذه الإجراءات تمسح البيانات تماماً ولا يمكن التراجع عنها.</p>
                                <button 
                                    onClick={() => {
                                        if(confirm('سيتم حذف جميع البيانات تماماً من المتصفح! هل أنت متأكد؟')) {
                                            clearAllData();
                                        }
                                    }}
                                    className="px-8 py-3 bg-red-600/20 text-red-500 border border-red-500/30 rounded-2xl hover:bg-red-600 hover:text-white transition-all font-bold"
                                >
                                    تصفير قاعدة البيانات المحلية
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Security Placeholder */}
                    {activeTab === 'security' && (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-40">
                             <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center">
                                <Shield size={48} />
                             </div>
                             <h3 className="text-2xl font-black italic gold-text">تحت التطوير البرمجي الفائق</h3>
                             <p className="max-w-xs text-slate-500 font-bold">قريباً: تشفير البيانات بكلمة مرور المدير وتوثيق الدخول بخطوتين.</p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default Settings;
