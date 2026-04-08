import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, QrCode, Loader2, RefreshCw, RotateCcw, AlertTriangle } from 'lucide-react';

const WhatsAppStatus = () => {
    const [status, setStatus] = useState({ status: 'loading', qr: '', pairingCode: '', connected: false });
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [isResetting, setIsResetting] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isPairing, setIsPairing] = useState(false);

    const checkStatus = async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 seconds timeout

        try {
            const res = await fetch('http://localhost:3001/qr-json', { signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await res.json();
            setStatus(data);
            setLastUpdated(new Date());
        } catch (err) {
            clearTimeout(timeoutId);
            // إذا كان السيرفر لا يزال يتم تهيئته (connecting)، لا نغير الحالة لـ server_down
            if (status.status !== 'connecting') {
                setStatus({ status: 'server_down', qr: '', connected: false });
            }
        }
    };

    const handleReset = async () => {
        if (!window.confirm('هل أنت متأكد من رغبتك في إعادة تعيين الاتصال؟ سيقوم هذا بمسح الرمز الحالي وفحص الجلسة من جديد.')) return;
        
        setIsResetting(true);
        try {
            await fetch('http://localhost:3001/reset', { method: 'POST' });
            setPhoneNumber('');
            setTimeout(checkStatus, 2000);
        } catch (err) {
            alert('فشل إعادة التعيين: ' + err.message);
        } finally {
            setIsResetting(false);
        }
    };

    const handlePairPhone = async (e) => {
        e.preventDefault();
        if (!phoneNumber || phoneNumber.length < 9) {
            alert('يرجى إدخال رقم جوال صحيح (مثال: 05xxxxxxxx)');
            return;
        }

        setIsPairing(true);
        try {
            const res = await fetch('http://localhost:3001/pair-phone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phoneNumber })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'فشل طلب كود الربط');
            
            // سيتم تحديث الحالة تلقائياً عبر checkStatus
            setTimeout(checkStatus, 3000);
        } catch (err) {
            alert(err.message);
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
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-red-50 p-4 rounded-2xl border border-red-100">
                    <div className="flex items-center gap-2 text-red-600">
                        <XCircle size={18} />
                        <span className="font-bold">خادم الواتساب غير يعمل — تأكد من تشغيل البرنامج</span>
                    </div>
                    <button onClick={checkStatus} className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2">
                        <RefreshCw size={14} /> إعادة المحاولة
                    </button>
                </div>
            );
        }

        if (status.connected) {
            return (
                <div className="flex items-center justify-between gap-4 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <div className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle size={18} />
                        <span className="font-bold">واتساب متصل وجاهز ✅</span>
                    </div>
                </div>
            );
        }

        if (status.status === 'qr') {
            return (
                <div className="flex flex-col md:flex-row items-stretch gap-6 bg-orange-50 p-6 rounded-2xl border border-orange-100 w-full animate-in fade-in slide-in-from-top-4">
                    {/* QR Code Side */}
                    {!status.pairingCode && (
                        <div className="bg-white p-3 rounded-2xl shadow-sm border border-orange-200 flex flex-col items-center justify-center">
                            {status.qr ? (
                                <img src={status.qr} alt="WhatsApp QR" className="w-44 h-44" />
                            ) : (
                                <div className="w-44 h-44 flex flex-col items-center justify-center text-orange-300">
                                    <Loader2 size={40} className="animate-spin mb-2" />
                                    <span className="text-xs">جاري توليد الرمز...</span>
                                </div>
                            )}
                            <span className="text-[10px] text-gray-400 mt-2">امسح الكود بالكاميرا</span>
                        </div>
                    )}

                    {/* Pairing Code Side (Prominent if exists) */}
                    {status.pairingCode && (
                        <div className="bg-white p-6 rounded-2xl shadow-md border-2 border-orange-400 flex flex-col items-center justify-center min-w-[200px] animate-pulse">
                            <span className="text-xs text-orange-600 font-bold mb-2 uppercase tracking-widest">كود الربط الخاص بك</span>
                            <div className="bg-orange-50 px-6 py-4 rounded-xl border border-orange-200">
                                <span className="text-4xl font-black text-orange-700 tracking-[0.2em] font-mono">{status.pairingCode}</span>
                            </div>
                            <button 
                                onClick={() => navigator.clipboard.writeText(status.pairingCode)}
                                className="mt-3 text-[10px] text-orange-600 hover:underline font-bold"
                            >
                                نَسخ الكود
                            </button>
                        </div>
                    )}

                    <div className="text-right flex-1 flex flex-col justify-center">
                        <div className="flex items-center gap-2 text-orange-700 font-black text-lg mb-2">
                            <QrCode size={24} />
                            <span>{status.pairingCode ? 'أدخل الكود في هاتفك الآن 🔢' : 'يرجى ربط الواتساب لتفعيل الإرسال 🔳'}</span>
                        </div>
                        
                        {!status.pairingCode ? (
                            <div className="space-y-4">
                                <p className="text-orange-600/80 text-sm leading-relaxed">
                                    افتح الواتساب على جوالك {'>'} الأجهزة المرتبطة {'>'} ربط جهاز {'>'} مسح الرمز.
                                </p>
                                
                                <div className="pt-4 border-t border-orange-200/50">
                                    <p className="text-xs text-gray-500 font-bold mb-2">أو الربط عبر رقم الجوال بدلاً من المسح:</p>
                                    <form onSubmit={handlePairPhone} className="flex gap-2">
                                        <input 
                                            type="text" 
                                            placeholder="05xxxxxxxx"
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none flex-1 font-mono"
                                        />
                                        <button 
                                            type="submit"
                                            disabled={isPairing}
                                            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                                        >
                                            {isPairing ? <Loader2 size={16} className="animate-spin" /> : <span>طلب كود</span>}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-orange-700 text-sm font-bold bg-orange-100/50 p-3 rounded-xl border border-orange-200">
                                    التعليمات: افتح الواتساب {'>'} الأجهزة المرتبطة {'>'} ربط جهاز {'>'} <span className="underline italic">الربط برقم الجوال بدلاً من ذلك</span> {'>'} ثم أدخل الكود الموضح أعلاه.
                                </p>
                                <button 
                                    onClick={handleReset}
                                    className="text-xs text-orange-600 hover:text-orange-800 font-bold underline"
                                >
                                    إلغاء والعودة للـ QR Code
                                </button>
                            </div>
                        )}
                        
                        {!status.pairingCode && (
                            <div className="flex flex-wrap gap-2 mt-6">
                                <button 
                                    onClick={handleReset}
                                    disabled={isResetting}
                                    className="bg-white text-orange-700 border border-orange-200 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-orange-100 transition-colors shadow-sm"
                                >
                                    {isResetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                                    إعادة تعيين (Reset)
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (status.status === 'connecting') {
            return (
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-blue-50 p-4 rounded-2xl border border-blue-100 animate-pulse">
                    <div className="flex items-center gap-2 text-blue-700">
                        <Loader2 size={24} className="animate-spin" />
                        <div className="flex flex-col">
                            <span className="font-bold">جاري تجهيز محرك الواتساب وتجهيز المتصفح...</span>
                            <span className="text-xs text-blue-500">هذه العملية قد تستغرق ما يصل إلى 60 ثانية في المرة الأولى</span>
                        </div>
                    </div>
                    <button 
                        onClick={handleReset}
                        disabled={isResetting}
                        className="bg-white text-blue-700 border border-blue-200 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
                    >
                        {isResetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                        بدء محاولة جديدة
                    </button>
                </div>
            );
        }

        return (
            <div className="flex items-center gap-2 text-blue-600 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 w-full">
                <Loader2 size={18} className="animate-spin" />
                <span className="font-bold">جاري الاتصال بالنظام...</span>
            </div>
        );
    };

    return (
        <div className="w-full animate-in fade-in slide-in-from-top-2 mb-6">
            <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                    <RefreshCw size={12} className={status.status === 'loading' ? 'animate-spin' : ''} />
                    <span>تحديث حي للحالة: {lastUpdated.toLocaleTimeString('ar-SA')}</span>
                </div>
            </div>
            {getStatusUI()}
        </div>
    );
};

export default WhatsAppStatus;
