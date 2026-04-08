import React, { useState } from 'react';
import { ImageIcon, Upload, Download, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

const PhotoRenamer = () => {
    const [files, setFiles] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState(null);

    const handleFileUpload = (e) => {
        const uploadedFiles = Array.from(e.target.files);
        setFiles(uploadedFiles);
        setResult(null);
    };

    const processPhotos = () => {
        setIsProcessing(true);
        // Simulate processing
        setTimeout(() => {
            setIsProcessing(false);
            setResult({
                total: files.length,
                renamed: files.length,
                errors: 0
            });
        }, 2000);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">إعادة تسمية الصور</h1>
                    <p className="text-gray-500 text-sm mt-1">أداة ذكية لإعادة تسمية صور الطلاب بناءً على أرقام الجلوس</p>
                </div>

                {files.length > 0 && !result && (
                    <button
                        onClick={processPhotos}
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                        {isProcessing ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                        <span>بدء المعالجة</span>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    {/* Upload Area */}
                    <div className="glass-morphism rounded-3xl border-2 border-dashed border-indigo-200 p-12 text-center space-y-4 hover:border-indigo-400 transition-all group">
                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto group-hover:scale-110 transition-transform">
                            <Upload size={32} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">قم بسحب وإفلات الصور هنا</h3>
                            <p className="text-gray-500 text-sm mt-2">أو انقر لاختيار الملفات من جهازك</p>
                        </div>
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="absolute inset-x-0 bottom-0 opacity-0 cursor-pointer h-full"
                            onChange={handleFileUpload}
                        />
                    </div>

                    {/* Files List Preview */}
                    {files.length > 0 && (
                        <div className="glass-morphism rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <ImageIcon size={18} className="text-indigo-500" />
                                    <span>الملفات المختارة ({files.length})</span>
                                </h3>
                                <button onClick={() => setFiles([])} className="text-xs text-red-500 font-bold hover:underline">مسح الكل</button>
                            </div>
                            <div className="max-h-64 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {files.slice(0, 8).map((file, i) => (
                                    <div key={i} className="text-[10px] bg-white border border-gray-100 rounded-lg p-2 truncate text-gray-500">
                                        {file.name}
                                    </div>
                                ))}
                                {files.length > 8 && <div className="text-[10px] flex items-center justify-center text-indigo-400 font-bold">+{files.length - 8} المزيد</div>}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar help / Status */}
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4">كيفية الاستخدام</h3>
                        <ul className="space-y-4">
                            <li className="flex gap-3 text-sm text-gray-600">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex-shrink-0 flex items-center justify-center font-bold text-xs">1</div>
                                <p>قم برفع صور الطلاب دفعة واحدة (JPG, PNG).</p>
                            </li>
                            <li className="flex gap-3 text-sm text-gray-600">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex-shrink-0 flex items-center justify-center font-bold text-xs">2</div>
                                <p>سيتعرف النظام تلقائياً على اسم الطالب ويطابقه برقم جلوسه.</p>
                            </li>
                            <li className="flex gap-3 text-sm text-gray-600">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex-shrink-0 flex items-center justify-center font-bold text-xs">3</div>
                                <p>قم بتحميل الملفات بعد إعادة تسميتها بصيغة ZIP.</p>
                            </li>
                        </ul>
                    </div>

                    {result && (
                        <div className="bg-green-50 rounded-3xl border border-green-100 p-6 shadow-sm animate-in zoom-in duration-300">
                            <div className="flex items-center gap-2 text-green-700 font-bold mb-4">
                                <CheckCircle2 size={20} />
                                <span>اكتملت المعالجة بنجاح!</span>
                            </div>
                            <div className="space-y-2 text-sm text-green-600">
                                <div className="flex justify-between"><span>الإجمالي:</span><b>{result.total}</b></div>
                                <div className="flex justify-between"><span>تمت المعالجة:</span><b>{result.renamed}</b></div>
                                <div className="flex justify-between"><span>أخطاء:</span><b>{result.errors}</b></div>
                            </div>
                            <button
                                onClick={() => {
                                    alert('جاري ضغط الملفات وتحميلها... قد تستغرق العملية بضع ثوانٍ.');
                                    // Dummy ZIP behavior
                                    const blob = new Blob(["Simulated ZIP content"], { type: "application/zip" });
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = "renamed_photos.zip";
                                    a.click();
                                }}
                                className="w-full mt-6 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-100 flex items-center justify-center gap-2 hover:bg-green-700 transition-all active:scale-95"
                            >
                                <Download size={18} />
                                <span>تحميل النتائج (ZIP)</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PhotoRenamer;
