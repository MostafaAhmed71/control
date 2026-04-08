import React from 'react';
import { 
    Users, 
    ScanLine, 
    Trophy, 
    UsersRound, 
    CreditCard, 
    Printer, 
    ChevronLeft,
    GraduationCap,
    LayoutDashboard
} from 'lucide-react';

const SystemSelector = ({ onSelect }) => {
    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 sm:p-12 animate-fade-in" dir="rtl">
            <div className="max-w-6xl w-full space-y-12">
                <div className="text-center space-y-4">
                    <h1 className="text-5xl font-black text-slate-900 tracking-tighter">
                        منصة <span className="gold-text italic">نخبة الشمال</span> الرقمية
                    </h1>
                    <p className="text-slate-500 text-xl font-medium">اختر النظام الذي ترغب في العمل عليه الآن</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Grading & Students System */}
                    <button 
                        onClick={() => onSelect('grading')}
                        className="group relative bg-white p-10 rounded-[3rem] shadow-2xl border border-gray-100 hover:border-indigo-600 transition-all duration-500 hover:scale-[1.02] text-right overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[5rem] -mr-16 -mt-16 group-hover:bg-indigo-600 transition-all duration-500 z-0"></div>
                        
                        <div className="relative z-10 space-y-6">
                            <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 group-hover:bg-white group-hover:scale-110 transition-all duration-500 shadow-sm">
                                <GraduationCap size={40} />
                            </div>
                            
                            <div className="space-y-3">
                                <h2 className="text-3xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">نظام شؤون الطلاب والتصحيح</h2>
                                <p className="text-slate-500 font-medium text-lg leading-relaxed">
                                    إدارة بيانات الطلاب، مسح أوراق الـ OMR، رصد الدرجات، وإرسال التقارير والنتائج.
                                </p>
                            </div>

                            <div className="flex items-center gap-6 pt-4">
                                <div className="flex -space-x-4 space-x-reverse">
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 border-2 border-white flex items-center justify-center text-slate-400 group-hover:text-indigo-600">
                                        <Users size={18} />
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 border-2 border-white flex items-center justify-center text-slate-400 group-hover:text-indigo-600">
                                        <ScanLine size={18} />
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 border-2 border-white flex items-center justify-center text-slate-400 group-hover:text-indigo-600">
                                        <Trophy size={18} />
                                    </div>
                                </div>
                                <div className="h-px flex-1 bg-gray-100"></div>
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                    <ChevronLeft size={24} />
                                </div>
                            </div>
                        </div>
                    </button>

                    {/* Committee Control System */}
                    <button 
                        onClick={() => onSelect('control')}
                        className="group relative bg-white p-10 rounded-[3rem] shadow-2xl border border-gray-100 hover:border-gold transition-all duration-500 hover:scale-[1.02] text-right overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-bl-[5rem] -mr-16 -mt-16 group-hover:bg-gold transition-all duration-500 z-0"></div>
                        
                        <div className="relative z-10 space-y-6">
                            <div className="w-20 h-20 bg-gold/10 rounded-3xl flex items-center justify-center text-gold group-hover:bg-white group-hover:scale-110 transition-all duration-500 shadow-sm">
                                <UsersRound size={40} />
                            </div>
                            
                            <div className="space-y-3">
                                <h2 className="text-3xl font-black text-slate-900 group-hover:text-gold transition-colors">نظام كنترول اللجان</h2>
                                <p className="text-slate-500 font-medium text-lg leading-relaxed">
                                    توزيع لجان الاختبارات، إصدار أرقام الجلوس، إدارة الملاحظين، وطباعة الكشوف الرسمية.
                                </p>
                            </div>

                            <div className="flex items-center gap-6 pt-4">
                                <div className="flex -space-x-4 space-x-reverse">
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 border-2 border-white flex items-center justify-center text-slate-400 group-hover:text-gold">
                                        <CreditCard size={18} />
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 border-2 border-white flex items-center justify-center text-slate-400 group-hover:text-gold">
                                        <UsersRound size={18} />
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 border-2 border-white flex items-center justify-center text-slate-400 group-hover:text-gold">
                                        <Printer size={18} />
                                    </div>
                                </div>
                                <div className="h-px flex-1 bg-gray-100"></div>
                                <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center text-gold group-hover:bg-gold group-hover:text-white transition-all">
                                    <ChevronLeft size={24} />
                                </div>
                            </div>
                        </div>
                    </button>
                </div>
                
                <div className="text-center">
                    <div className="inline-flex items-center gap-3 px-6 py-3 bg-white rounded-2xl shadow-sm border border-gray-100">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-slate-500 font-bold text-sm">جميع البيانات مرتبطة بقاعدة بيانات موحدة</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemSelector;
