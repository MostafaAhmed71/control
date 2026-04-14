import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, QrCode, Loader2, RefreshCw, RotateCcw, AlertTriangle, ShieldCheck, Zap, Smartphone, Link2, Copy, Trash2 } from 'lucide-react';

const WhatsAppStatus = () => {
    const [status, setStatus] = useState({ status: 'loading', qr: '', pairingCode: '', connected: false });
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [isResetting, setIsResetting] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isPairing, setIsPairing] = useState(false);

    const checkStatus = async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        try {
            const res = await fetch('http://localhost:3001/qr-json', { signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await res.json();
            setStatus(data);
            setLastUpdated(new Date());
        } catch (err) {
            clearTimeout(timeoutId);
            if (status.status !== 'connecting') {
                setStatus({ status: 'server_down', qr: '', connected: false });
            }
        }
    };

    const handleReset = async () => {
        if (!window.confirm('هل أنت متأكد من رغبتك في إعادة تعيين الاتصال الرقمي؟')) return;
        
        setIsResetting(true);
        try {
            await fetch('http://localhost:3001/reset', { method: 'POST' });
            setPhoneNumber('');
            setTimeout(checkStatus, 2000);
        } catch (err) {
            console.error(err);
        } finally {
            setIsResetting(false);
        }
    };

    const handlePairPhone = async (e) => {
        e.preventDefault();
        if (!phoneNumber || phoneNumber.length < 9) return;

        setIsPairing(true);
        try {
            const res = await fetch('http://localhost:3001/pair-phone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phoneNumber })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setTimeout(checkStatus, 3000);
        } catch (err) {
            console.error(err);
        } finally {
            setIsPairing(false);
        }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const getStatusUI = () => {
        if (status.status === 'server_down') {
            return (
                <div className="luxury-card p-6 bg-rose-50 border-rose-100 flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in duration-500">
                    <div className="flex items-center gap-4 text-rose-600">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                           <AlertTriangle size={24} />
                        </div>
                        <div className="space-y-1">
                           <p className="font-header font-black text-lg leading-tight uppercase tracking-tight">محرك المراسلة متوقف</p>
                           <p className="text-[10px] font-bold opacity-70">يرجى التأكد من تشغيل خادم WhatsApp Desktop للبدء</p>
                        </div>
                    </div>
                    <button onClick={checkStatus} className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-xs hover:bg-rose-700 transition-all flex items-center gap-2 shadow-lg shadow-rose-100">
                        <RefreshCw size={14} /> إعادة محاولة الاتصال
                    </button>
                </div>
            );
        }

        if (status.connected) {
            return (
                <div className="luxury-card p-6 bg-emerald-500 border-none text-white flex items-center justify-between animate-in zoom-in-95 duration-700 shadow-emerald-100">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center shadow-inner border border-white/20">
                           <ShieldCheck size={32} />
                        </div>
                        <div>
                           <h3 className="text-xl font-black font-header tracking-tight">نظام المراسلة متصل وجاهز</h3>
                           <div className="flex items-center gap-2 mt-1">
                               <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                               <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Operational & Secure Channel</span>
                           </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (status.status === 'qr') {
            return (
                <div className="luxury-card p-10 bg-white border-slate-100 flex flex-col lg:flex-row items-stretch gap-10 w-full animate-in fade-in slide-in-from-top-6 duration-700 font-alexandria">
                    {/* QR Code Container */}
                    {!status.pairingCode && (
                        <div className="relative group flex flex-col items-center">
                            <div className="absolute -inset-4 bg-indigo-50/50 rounded-[3rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                            <div className="relative z-10 bg-white p-6 rounded-[2.5rem] shadow-premium border border-slate-50 flex flex-col items-center justify-center transition-transform hover:scale-105 duration-500">
                                {status.qr ? (
                                    <div className="p-2 border-2 border-slate-50 rounded-2xl">
                                        <img src={status.qr} alt="WhatsApp QR" className="w-48 h-48 mix-blend-multiply" />
                                    </div>
                                ) : (
                                    <div className="w-48 h-48 flex flex-col items-center justify-center text-indigo-400">
                                        <Loader2 size={40} className="animate-spin mb-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Generating Hash...</span>
                                    </div>
                                )}
                                <div className="mt-4 flex items-center gap-2 text-[8px] font-black text-slate-300 uppercase tracking-widest">
                                   <QrCode size={10} /> Scan via WhatsApp Mobile
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Pairing Code Container */}
                    {status.pairingCode && (
                        <div className="relative flex flex-col items-center justify-center">
                            <div className="absolute -inset-6 bg-amber-50 rounded-full blur-3xl animate-pulse"></div>
                            <div className="relative z-10 bg-white p-10 rounded-[3rem] shadow-premium border-2 border-amber-200/50 flex flex-col items-center justify-center min-w-[300px]">
                                <span className="text-[10px] text-amber-600 font-black mb-6 uppercase tracking-[0.3em]">Device Link Protocol</span>
                                <div className="bg-amber-50/50 px-10 py-8 rounded-[2rem] border border-amber-100 relative group overflow-hidden">
                                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-700"></div>
                                    <span className="text-6xl font-black text-amber-600 tracking-[0.2em] font-header relative z-10">{status.pairingCode}</span>
                                </div>
                                <button 
                                    onClick={() => navigator.clipboard.writeText(status.pairingCode)}
                                    className="mt-8 flex items-center gap-3 px-6 py-3 bg-amber-50 text-amber-600 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 hover:text-white transition-all shadow-sm active:scale-95"
                                >
                                    <Copy size={14} /> نسخ كود الربط
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="text-right flex-1 flex flex-col justify-center space-y-8 py-4">
                        <div className="space-y-3">
                            <div className="inline-flex items-center gap-3 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full">
                                <Zap size={14} className="animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Authentication Required</span>
                            </div>
                            <h3 className="text-3xl font-black text-slate-900 font-header leading-tight tracking-tight">
                                {status.pairingCode ? 'أدخل كود التحقق في هاتفك' : 'اربط حساب الواتساب للانطلاق'}
                            </h3>
                        </div>
                        
                        {!status.pairingCode ? (
                            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="space-y-4">
                                    {[
                                        { icon: <Smartphone size={16} />, text: 'افتح تطبيق واتساب على هاتفك' },
                                        { icon: <Link2 size={16} />, text: 'الأجهزة المرتبطة > ربط جهاز جديد' },
                                        { icon: <QrCode size={16} />, text: 'قم بمسح رمز الـ QR الموضح يميناً' }
                                    ].map((step, idx) => (
                                        <div key={idx} className="flex items-center gap-4 group">
                                           <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">{step.icon}</div>
                                           <p className="text-sm font-bold text-slate-500 group-hover:text-slate-800 transition-colors">{step.text}</p>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="pt-8 border-t border-slate-50">
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-4">الربط التقليدي (عبر رقم الهاتف)</p>
                                    <form onSubmit={handlePairPhone} className="flex gap-3">
                                        <div className="relative flex-1">
                                            <div className="absolute inset-y-0 right-4 flex items-center text-slate-300"><Phone size={14} /></div>
                                            <input 
                                                type="text" 
                                                placeholder="05xxxxxxxx"
                                                value={phoneNumber}
                                                onChange={(e) => setPhoneNumber(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-100 pr-12 pl-4 py-4 rounded-2xl text-xs font-black focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                                            />
                                        </div>
                                        <button 
                                            type="submit"
                                            disabled={isPairing || !phoneNumber}
                                            className="bg-slate-900 hover:bg-black text-white px-8 py-4 rounded-2xl font-black text-xs transition-all disabled:opacity-30 disabled:grayscale flex items-center gap-3 shadow-xl shadow-slate-200 active:scale-95"
                                        >
                                            {isPairing ? <Loader2 size={18} className="animate-spin" /> : <span>توليد كود الربط</span>}
                                        </button>
                                    </form>
                                </div>

                                <button onClick={handleReset} disabled={isResetting} className="flex items-center gap-3 text-[10px] font-black text-rose-300 hover:text-rose-500 transition-colors uppercase tracking-widest">
                                   {isResetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} إعادة تعيين المحرك (Hard Reset)
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="p-6 bg-amber-50/50 rounded-[2rem] border border-amber-100 space-y-4">
                                     <h4 className="font-header font-black text-amber-700 text-sm">بروتوكول الربط المباشر:</h4>
                                     <p className="text-amber-800/60 text-xs font-bold leading-relaxed">
                                        يرجى كتابة الكود المكون من 8 خانات في حقل "الربط برقم الهاتف" داخل تطبيق الواتساب بجوالك لإتمام المصادقة.
                                     </p>
                                </div>
                                <button onClick={handleReset} className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-rose-500 transition-colors">
                                   <RefreshCw size={14} /> إلغاء عملية الربط والعودة لمسح الـ QR
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (status.status === 'connecting') {
            return (
                <div className="luxury-card p-8 bg-white border-indigo-100/50 flex flex-col md:flex-row items-center justify-between gap-8 animate-pulse shadow-indigo-50">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-[1.5rem] flex items-center justify-center shadow-inner">
                           <Loader2 size={32} className="animate-spin" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-black font-header tracking-tight text-slate-900">جاري إقلاع محرك المراسلة...</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">تُجرى الآن عمليات التهيئة الرقمية — قد تستغرق 60 ثانية</p>
                        </div>
                    </div>
                    <button onClick={handleReset} className="px-6 py-3 bg-slate-50 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all">
                        بدء محاولة جديدة
                    </button>
                </div>
            );
        }

        return (
            <div className="flex items-center gap-4 text-slate-400 bg-white/50 backdrop-blur-md p-6 rounded-[2rem] border border-slate-100/50 w-full animate-in fade-in">
                <Loader2 size={24} className="animate-spin" />
                <span className="text-sm font-black uppercase tracking-[0.2em] font-header">Syncing Network Environment...</span>
            </div>
        );
    };

    return (
        <div className="w-full animate-in fade-in slide-in-from-top-4 mb-10 font-alexandria">
            <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-3 px-4 py-1.5 bg-white rounded-full shadow-sm border border-slate-50">
                    <ActivityIndicator active={status.connected} />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                       تحديث الحالة: {lastUpdated.toLocaleTimeString('ar-SA')}
                    </span>
                </div>
            </div>
            {getStatusUI()}
        </div>
    );
};

const ActivityIndicator = ({ active }) => (
    <div className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500 animate-ping' : 'bg-slate-200'}`}></div>
);

export default WhatsAppStatus;
