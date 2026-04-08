import React from 'react';
import {
    Users,
    UserCheck,
    MapPin,
    ClipboardList,
    Printer,
    CreditCard,
    UsersRound,
    Settings,
    LayoutDashboard,
    ScanLine,
    FileText,
    Trophy,
    Send,
    LogOut,
    RefreshCcw,
    GraduationCap,
    Palette
} from 'lucide-react';

import { NavLink } from 'react-router-dom';
import { getAppSettings } from '../utils/dataService';

const Sidebar = ({ activeSystem, onSwitchSystem }) => {
    const [config, setConfig] = React.useState(null);

    React.useEffect(() => {
        getAppSettings().then(setConfig);
    }, []);

    const allMenuItems = [
        { name: 'لوحة التحكم', path: '/', icon: <LayoutDashboard size={20} />, system: 'common' },
        
        // Grading System
        { name: 'قائمة الطلاب', path: '/students', icon: <Users size={20} />, system: 'grading' },
        { name: 'تصحيح الـ OMR', path: '/omr-scanner', icon: <ScanLine size={20} />, system: 'grading' },
        { name: 'إدارة الاختبارات (OMR)', path: '/omr-exams', icon: <FileText size={20} />, system: 'grading' },
        { name: 'مصمم القالب', path: '/omr-designer', icon: <Palette size={20} />, system: 'grading' },
        { name: 'أيقونة الرصد', path: '/grade-recording', icon: <Trophy size={20} />, system: 'grading' },
        { name: 'مركز الرسائل', path: '/notifier', icon: <Send size={20} />, system: 'grading' },
        
        // Control System
        { name: 'أرقام الجلوس', path: '/seating-cards', icon: <CreditCard size={20} />, system: 'control' },
        { name: 'إنشاء اللجان', path: '/committees', icon: <UsersRound size={20} />, system: 'control' },
        { name: 'طباعة الكشوف', path: '/print-sheets', icon: <Printer size={20} />, system: 'control' },
        { name: 'كشوف الحضور', path: '/attendance', icon: <ClipboardList size={20} />, system: 'control' },
        { name: 'إدارة المعلمين', path: '/observers', icon: <UserCheck size={20} />, system: 'control' },
        { name: 'توزيع الملاحظين', path: '/committee-observers', icon: <UserCheck size={20} />, system: 'control' },
        { name: 'أرقام جلوس اللجان', path: '/committee-seating', icon: <CreditCard size={20} />, system: 'control' },
        { name: 'أماكن اللجان', path: '/locations', icon: <MapPin size={20} />, system: 'control' },
        
        { name: 'الإعدادات', path: '/settings', icon: <Settings size={20} />, system: 'common' },
    ];

    const menuItems = allMenuItems.filter(item => item.system === 'common' || item.system === activeSystem);

    return (
        <aside className="fixed top-0 right-0 z-40 w-64 h-screen transition-transform glass border-l border-gray-100 shadow-xl flex flex-col">
            <div className="px-4 py-6 overflow-y-auto custom-scrollbar flex-1">
                <div className="flex items-center mb-8 px-2 group animate-fade-in">
                    <div className={`w-12 h-12 ${activeSystem === 'grading' ? 'bg-indigo-600' : 'bg-gold'} rounded-2xl flex items-center justify-center text-white mr-3 shadow-lg transition-all duration-400 group-hover:rotate-6`}>
                        {activeSystem === 'grading' ? <GraduationCap size={26} /> : <ClipboardList size={26} />}
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none">نخبة الشمال</h2>
                        <p className={`text-[10px] ${activeSystem === 'grading' ? 'text-indigo-600' : 'text-gold'} font-bold uppercase tracking-widest leading-none mt-1.5`}>
                            {activeSystem === 'grading' ? 'نظام التصحيح والرصد' : 'نظام كنترول اللجان'}
                        </p>
                    </div>
                </div>

                <ul className="space-y-1.5 font-semibold">
                    {menuItems.map((item, index) => (
                        <li key={item.path} style={{ animationDelay: `${index * 40}ms` }} className="animate-fade-in opacity-0 fill-mode-forwards">
                            <NavLink
                                to={item.path}
                                className={({ isActive }) =>
                                    `flex items-center p-3 text-slate-500 rounded-2xl transition-all duration-300 group relative ${isActive
                                        ? activeSystem === 'grading' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm' : 'bg-orange-50 text-gold border border-orange-100 shadow-sm'
                                        : 'hover:bg-gray-50 hover:text-slate-900'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <span className={`flex-shrink-0 transition-all duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110 group-hover:text-slate-900'}`}>
                                            {item.icon}
                                        </span>
                                        <span className="mr-3 text-sm">{item.name}</span>
                                        {isActive && (
                                            <div className="absolute left-3">
                                                <div className={`w-1.5 h-1.5 rounded-full ${activeSystem === 'grading' ? 'bg-indigo-600' : 'bg-gold'}`}></div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                <button 
                    onClick={onSwitchSystem}
                    className="w-full flex items-center justify-center gap-3 p-3 bg-white text-slate-600 rounded-2xl border border-gray-100 hover:bg-gray-100 transition-all font-bold text-sm shadow-sm"
                >
                    <RefreshCcw size={18} />
                    <span>تبديل النظام</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
