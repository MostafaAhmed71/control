import React, { useState, useEffect } from 'react';
import { getStudents, saveStudent, deleteStudent, saveStudentsBulk } from '../../utils/dataService';
import { Plus, Search, Edit2, Trash2, UserPlus, Filter, Download, Upload, FileSpreadsheet, Wand2, X, Phone } from 'lucide-react';
import * as XLSX from 'xlsx';

const StudentList = () => {
    const [students, setStudents] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedStage, setSelectedStage] = useState('الكل');
    const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
    const [genConfig, setGenConfig] = useState({ stage: '', grade: '', startNumber: '' });

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        setLoading(true);
        const data = await getStudents();
        setStudents(data);
        setLoading(false);
    };

    const handleDelete = async (id) => {
        if (window.confirm('هل أنت متأكد من حذف هذا الطالب؟')) {
            await deleteStudent(id);
            fetchStudents();
        }
    };

    const handleDeleteAll = async () => {
        if (students.length === 0) return;
        if (window.confirm('هل أنت متأكد من حذف جميع الطلاب؟ سيتم مسح السجل بالكامل ولا يمكن التراجع عن هذه الخطوة.')) {
            await saveStudentsBulk([]);
            fetchStudents();
        }
    };

    const handleDeleteFiltered = async () => {
        try {
            if (filteredStudents.length === 0) return;
            if (window.confirm(`هل أنت متأكد من حذف ${filteredStudents.length} طالب (الطلاب المعروضين حالياً)؟ لن يمكنك التراجع عن هذه الخطوة.`)) {
                const filteredIds = new Set(filteredStudents.map(s => s.id));
                const remainingStudents = students.filter(s => !filteredIds.has(s.id));
                await saveStudentsBulk(remainingStudents);
                fetchStudents();
                alert('تم الحذف بنجاح!');
            }
        } catch (error) {
            console.error(error);
            alert('حدث خطأ أثناء الحذف: ' + error.message);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const studentData = {
            id: editingStudent?.id,
            name: formData.get('name'),
            seatNumber: formData.get('seatNumber') || '',
            nationalId: formData.get('nationalId') || '',
            stage: formData.get('stage'),
            grade: formData.get('grade'),
            class: formData.get('class'),
            committee: formData.get('committee') || '',
            phone: formData.get('phone') || '',
        };
        await saveStudent(studentData);
        setIsModalOpen(false);
        setEditingStudent(null);
        fetchStudents();
    };

    const filteredStudents = students.filter(s => {
        const name = s.name || '';
        const seat = s.seatNumber || '';
        const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            seat.includes(searchTerm);
        const matchesStage = selectedStage === 'الكل' || s.stage === selectedStage;
        return matchesSearch && matchesStage;
    });

    const stages = ['الكل', ...new Set(students.map(s => s.stage))];
    const allGrades = [...new Set(students.map(s => s.grade))];

    const handleGenerateSeats = async () => {
        if (!genConfig.stage || !genConfig.grade || !genConfig.startNumber) {
            alert('يرجى إكمال جميع الحقول');
            return;
        }

        const startNum = parseInt(genConfig.startNumber);
        const gradeStudents = students
            .filter(s => s.stage === genConfig.stage && s.grade === genConfig.grade)
            .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

        const updatedStudents = students.map(s => {
            const index = gradeStudents.findIndex(gs => gs.id === s.id);
            if (index !== -1) {
                return { ...s, seatNumber: (startNum + index).toString() };
            }
            return s;
        });

        await saveStudentsBulk(updatedStudents);
        setIsGeneratorOpen(false);
        fetchStudents();
        alert(`تم توليد ${gradeStudents.length} رقم جلوس بنجاح`);
    };

    const suggestStartNumber = () => {
        const assignedSeats = students
            .map(s => parseInt(s.seatNumber))
            .filter(n => !isNaN(n));
        return assignedSeats.length > 0 ? Math.max(...assignedSeats) + 1 : 1001;
    };

    const handleExport = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(students));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "students.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        const fileExtension = file.name.split('.').pop().toLowerCase();

        reader.onload = async (event) => {
            try {
                let importedData = [];
                let foundKeysInfo = 'بيانات الأعمدة غير متوفرة';

                if (fileExtension === 'json') {
                    importedData = JSON.parse(event.target.result);
                } else if (['xlsx', 'xls', 'csv'].includes(fileExtension)) {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const rawJsonData = XLSX.utils.sheet_to_json(worksheet);
                    
                    foundKeysInfo = rawJsonData.length > 0 ? Object.keys(rawJsonData[0]).join(' | ') : 'ملف فارغ';
                    
                    // Normalize keys (remove leading/trailing spaces from Excel headers)
                    const jsonData = rawJsonData.map(row => {
                        const normalizedRow = {};
                        for (const key in row) {
                            if (Object.prototype.hasOwnProperty.call(row, key)) {
                                normalizedRow[key.toString().trim()] = row[key];
                            }
                        }
                        return normalizedRow;
                    });

                    // Map Excel columns to our data structure with a flexible search
                    const getVal = (row, possibleNames) => {
                        for (const key in row) {
                            // Remove ALL spaces, invisible chars, and normalize
                            const cleanKey = key.toString().replace(/[\s\u200B-\u200D\uFEFF]/g, '');
                            for (const name of possibleNames) {
                                const cleanName = name.replace(/[\s]/g, '');
                                if (cleanKey === cleanName || cleanKey.includes(cleanName)) {
                                    return row[key] !== undefined && row[key] !== null ? row[key] : '';
                                }
                            }
                        }
                        return '';
                    };

                    importedData = jsonData.map((row, index) => ({
                        id: Date.now().toString() + index,
                        name: getVal(row, ['الاسم', 'اسم الطالب', 'الاسم رباعي', 'name']).toString().trim(),
                        seatNumber: getVal(row, ['رقم الطالب', 'رقم الجلوس', 'الجلوس', 'seat']).toString().trim(),
                        nationalId: getVal(row, ['رقم الهوية', 'الهوية', 'nationalId']).toString().trim(),
                        stage: getVal(row, ['المرحلة', 'stage', 'المرحلة الدراسية']).toString().trim(),
                        grade: getVal(row, ['رقم الصف', 'الصف', 'grade']).toString().trim(),
                        class: getVal(row, ['الفصل', 'الشعبة', 'class']).toString().trim(),
                        committee: getVal(row, ['اللجنة', 'رقم اللجنة', 'committee']).toString().trim(),
                        phone: getVal(row, ['رقم الجوال', 'الجوال', 'هاتف', 'جوال', 'phone']).toString().trim(),
                    })).filter(s => s.name !== ''); // Filter out empty rows
                }

                if (Array.isArray(importedData) && importedData.length > 0) {
                    const wantToMerge = window.confirm(`تم قراءة ${importedData.length} طالب من الملف.\n\nهل ترغب في "تحديث" الطلاب الحاليين (لإضافة رقم الهوية والبيانات الناقصة) بدلاً من مسح القائمة بالكامل؟\n\n- اضغط "موافق/OK" للتحديث والدمج.\n- اضغط "إلغاء/Cancel" لمسح القائمة السابقة واستبدالها بالكامل.`);
                    
                    if (wantToMerge) {
                        // Merge logic: match by seatNumber or name
                        let updatedCount = 0;
                        const mergedStudents = students.map(existing => {
                            const match = importedData.find(imp => 
                                (imp.seatNumber && imp.seatNumber === existing.seatNumber) || 
                                (imp.name === existing.name)
                            );
                            
                            if (match) {
                                updatedCount++;
                                return { 
                                    ...existing, 
                                    nationalId: match.nationalId || existing.nationalId,
                                    phone: match.phone || existing.phone,
                                    committee: match.committee || existing.committee
                                };
                            }
                            return existing;
                        });
                        
                        // Add purely new students who did not match any existing
                        const existingMatchKeys = new Set(mergedStudents.map(s => s.seatNumber ? s.seatNumber : s.name));
                        const newStudents = importedData.filter(imp => !existingMatchKeys.has(imp.seatNumber ? imp.seatNumber : imp.name));
                        
                        const finalList = [...mergedStudents, ...newStudents];
                        await saveStudentsBulk(finalList);
                        fetchStudents();
                        
                        alert(`تم التحديث بنجاح!\nتم تحديث بيانات ${updatedCount} طالب موجود، وإضافة ${newStudents.length} طالب جديد.\n(الأعمدة المقروءة: ${foundKeysInfo})`);
                        
                    } else {
                        if (window.confirm(`تحذير نهائي: سيتم حذف جميع الطلاب الحاليين واستبدالهم بالقائمة الجديدة. هل أنت متأكد؟`)) {
                            await saveStudentsBulk(importedData);
                            fetchStudents();
                            alert('تم استبدال البيانات بنجاح!\n(الأعمدة المقروءة من الملف: ' + foundKeysInfo + ')');
                        }
                    }
                } else {
                    alert('لم يتم العثور على أي طلاب بأسماء صحيحة.\nالأعمدة المقروءة: ' + foundKeysInfo);
                }
            } catch (err) {
                console.error(err);
                alert('خطأ في معالجة الملف: ' + err.message);
            }
        };

        if (fileExtension === 'json') {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black gold-text italic tracking-tight">سجل الطلاب الملكي</h1>
                    <p className="text-slate-400 text-sm mt-1 font-medium">إدارة المركزية لبيانات الطلاب بخصوصية وفخامة</p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <input
                        type="file"
                        id="import-students"
                        className="hidden"
                        accept=".json,.xlsx,.xls,.csv"
                        onChange={handleImport}
                    />
                    <button
                        onClick={() => document.getElementById('import-students').click()}
                        className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all active:scale-95 text-sm font-bold shadow-sm"
                    >
                        <FileSpreadsheet size={18} className="text-indigo-500" />
                        <span>استيراد ملفات</span>
                    </button>
                    <button
                        onClick={() => {
                            const suggested = suggestStartNumber();
                            setGenConfig({ ...genConfig, startNumber: suggested.toString() });
                            setIsGeneratorOpen(true);
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-amber-50 text-amber-700 border border-amber-100 rounded-2xl hover:bg-amber-100 transition-all font-bold active:scale-95 text-sm shadow-sm"
                    >
                        <Wand2 size={18} />
                        <span>أرقام الجلوس</span>
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all active:scale-95 text-sm font-bold shadow-sm"
                    >
                        <Download size={18} />
                        <span>نسخة احتياطية</span>
                    </button>
                    <button
                        onClick={() => { setEditingStudent(null); setIsModalOpen(true); }}
                        className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 font-black text-sm"
                    >
                        <Plus size={20} />
                        <span>إضافة طالب</span>
                    </button>
                    {filteredStudents.length > 0 && filteredStudents.length < students.length && (
                        <button
                            onClick={handleDeleteFiltered}
                            className="flex items-center gap-2 px-6 py-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-all active:scale-95 text-sm font-bold shadow-sm"
                        >
                            <Trash2 size={18} />
                            <span>حذف المعروض ({filteredStudents.length})</span>
                        </button>
                    )}
                    <button
                        onClick={handleDeleteAll}
                        className="flex items-center gap-2 px-6 py-3 bg-red-50 border border-red-100 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all active:scale-95 text-sm font-bold shadow-sm"
                    >
                        <Trash2 size={18} />
                        <span>تفريغ السجل</span>
                    </button>
                </div>
            </div>

            <div className="luxury-card border-none overflow-hidden bg-white p-2">
                <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row gap-8 items-center justify-between bg-slate-50/20">
                    <div className="relative w-full md:w-[450px]">
                        <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="ابحث باسم الطالب أو رقم الجلوس..."
                            className="w-full pr-14 pl-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100/30 focus:border-indigo-300 outline-none transition-all text-slate-800 font-bold text-sm shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm">
                        <Filter size={18} className="text-indigo-400" rotate={90} />
                        <span className="text-slate-400 text-[11px] font-black uppercase tracking-widest">تصفية المرحلة:</span>
                        <select
                            className="bg-transparent border-none font-bold text-sm text-slate-800 outline-none cursor-pointer focus:ring-0"
                            value={selectedStage}
                            onChange={(e) => setSelectedStage(e.target.value)}
                        >
                            {stages.map(s => <option key={s} value={s}>{s === 'الكل' ? 'جميع المراحل' : s}</option>)}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto p-2">
                    <table className="premium-table text-right">
                        <thead>
                            <tr className="border-none">
                                <th className="px-8 py-5">اسم الطالب</th>
                                <th className="px-8 py-5 text-center">رقم الجلوس</th>
                                <th className="px-8 py-5 text-center">رقم الهوية</th>
                                <th className="px-8 py-5 text-center">المرحلة</th>
                                <th className="px-8 py-5 text-center">الصف الدراسي</th>
                                <th className="px-8 py-5 text-center">الفصل</th>
                                <th className="px-8 py-5 text-center">هاتف الجوال</th>
                                <th className="px-8 py-5 text-center">اللجنة</th>
                                <th className="px-8 py-5 text-left">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-8 divide-transparent">
                            {loading ? (
                                <tr><td colSpan="9" className="text-center py-20 text-slate-300 font-bold animate-pulse">جاري جلب السجلات...</td></tr>
                            ) : filteredStudents.length === 0 ? (
                                <tr><td colSpan="9" className="text-center py-24 text-slate-300 font-black text-xl italic opacity-40">لا توجد بيانات مطابقة للبحث</td></tr>
                            ) : filteredStudents.map((student) => (
                                <tr key={student.id} className="hover:scale-[1.005] transition-transform">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                          <div className="w-11 h-11 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center font-black border border-slate-100 shadow-inner">
                                              <UserPlus size={20} />
                                          </div>
                                          <div className="font-black text-slate-900 text-base">{student.name}</div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-center font-header font-black text-indigo-600 text-lg tracking-widest">{student.seatNumber}</td>
                                    <td className="px-8 py-5 text-center font-mono text-slate-600">{student.nationalId}</td>
                                    <td className="px-8 py-5 text-center">
                                        <span className="px-4 py-1.5 rounded-xl text-[10px] font-black bg-slate-50 text-slate-500 border border-slate-100 uppercase tracking-tight">
                                            {student.stage}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <span className="px-4 py-1.5 rounded-xl text-[10px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100">
                                            {student.grade}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-center text-slate-600 font-black">{student.class}</td>
                                    <td className="px-8 py-5 text-center">
                                        {student.phone ? (
                                            <a href={`tel:${student.phone}`}
                                                className="inline-flex items-center gap-2 text-emerald-600 font-black text-xs hover:text-emerald-700 transition-colors bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                                                <Phone size={14} className="shrink-0" />
                                                <span dir="ltr">{student.phone}</span>
                                            </a>
                                        ) : (
                                            <span className="text-slate-300 text-xs italic">—</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        {student.committee ? (
                                            <span className="bg-amber-50 text-amber-600 px-4 py-1.5 rounded-xl text-[10px] font-black border border-amber-100">
                                                اللجنة {student.committee}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-xs italic opacity-40">غير مدرج</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-5 text-left">
                                        <div className="flex justify-start gap-4">
                                            <button
                                                onClick={() => { setEditingStudent(student); setIsModalOpen(true); }}
                                                className="p-3 text-indigo-400 hover:bg-indigo-50 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-indigo-100"
                                            >
                                                <Edit2 size={20} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(student.id)}
                                                className="p-3 text-rose-400 hover:bg-rose-50 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-rose-100"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isGeneratorOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 border border-slate-100">
                        <div className="p-8 bg-indigo-600 text-white flex items-center justify-between">
                            <div>
                              <h3 className="text-2xl font-black font-header">توليد أرقام الجلوس</h3>
                              <p className="text-indigo-100 text-xs mt-1 font-bold">معالج الربط التلقائي للهوية الرقمية</p>
                            </div>
                            <button onClick={() => setIsGeneratorOpen(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={24} /></button>
                        </div>
                        <div className="p-10 space-y-6">
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-1">المرحلة الدراسية</label>
                                <select
                                    className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 text-slate-800 font-bold transition-all"
                                    value={genConfig.stage}
                                    onChange={(e) => setGenConfig({ ...genConfig, stage: e.target.value, grade: '' })}
                                >
                                    <option value="">-- اختر المرحلة --</option>
                                    {(() => {
                                        const dataStages = [...new Set(students.map(s => s.stage).filter(Boolean))];
                                        const displayStages = [...new Set(['الابتدائي', 'المتوسط', 'الثانوي', ...dataStages])];
                                        return displayStages.map(s => {
                                            const count = students.filter(std => std.stage === s).length;
                                            return <option key={s} value={s}>{s} ({count} طالب)</option>;
                                        });
                                    })()}
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-1">الصف المحدد</label>
                                <select
                                    className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 text-slate-800 font-bold transition-all"
                                    value={genConfig.grade}
                                    onChange={(e) => setGenConfig({ ...genConfig, grade: e.target.value })}
                                >
                                    <option value="">-- اختر الصف --</option>
                                    {[...new Set(students.filter(s => s.stage === genConfig.stage).map(s => s.grade))].map(g => (
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-1">رقم البداية التسلسلي</label>
                                <input
                                    type="number"
                                    className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 text-slate-800 font-header font-black text-lg placeholder:text-slate-300 transition-all font-mono"
                                    value={genConfig.startNumber}
                                    onChange={(e) => setGenConfig({ ...genConfig, startNumber: e.target.value })}
                                    placeholder="مثال: 1001"
                                />
                            </div>

                            <div className="flex gap-4 mt-10">
                                <button
                                    onClick={handleGenerateSeats}
                                    className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95 transition-all text-lg"
                                >
                                    بدء التشغيل
                                </button>
                                <button onClick={() => setIsGeneratorOpen(false)} className="px-10 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all text-lg">إلغاء</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 border border-slate-100">
                        <div className="p-10 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-between">
                            <div>
                              <h3 className="text-3xl font-black font-header">
                                  {editingStudent ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}
                              </h3>
                              <p className="text-indigo-100 text-sm mt-2 opacity-80 font-medium tracking-tight">يرجى ملء الحقول التالية بدقة لضمان صحة رصد الدرجات</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-4 hover:bg-white/10 rounded-3xl transition-all">
                              <X size={32} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-10 space-y-8 bg-white">
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">الاسم الثلاثي أو الرباعي للطلاب</label>
                                <input required name="name" defaultValue={editingStudent?.name} 
                                  className="w-full px-8 py-5 bg-slate-50 border border-transparent rounded-[1.5rem] outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 text-slate-900 font-black text-xl transition-all" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">رقم الجلوس (Seat ID)</label>
                                    <input name="seatNumber" defaultValue={editingStudent?.seatNumber} 
                                      className="w-full px-8 py-5 bg-slate-50 border border-transparent rounded-[1.5rem] outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 text-indigo-600 font-header font-black text-xl font-mono tracking-widest transition-all" placeholder="يتم توليده تلقائياً" />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">المرحلة الأكاديمية</label>
                                    <select required name="stage" defaultValue={editingStudent?.stage || 'الثانوي'} 
                                      className="w-full px-8 py-5 bg-slate-50 border border-transparent rounded-[1.5rem] outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 text-slate-900 font-bold transition-all appearance-none">
                                        <option value="الابتدائي">الابتدائي</option>
                                        <option value="المتوسط">المتوسط</option>
                                        <option value="الثانوي">الثانوي</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">رقم الهوية</label>
                                    <input name="nationalId" defaultValue={editingStudent?.nationalId} 
                                      className="w-full px-6 py-5 bg-slate-50 border border-transparent rounded-[1.5rem] outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 text-slate-900 font-bold text-sm transition-all text-center" placeholder="10XXXXXXXX" />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">الصف</label>
                                    <input required name="grade" defaultValue={editingStudent?.grade} 
                                      className="w-full px-6 py-5 bg-slate-50 border border-transparent rounded-[1.5rem] outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 text-slate-900 font-bold text-sm transition-all" placeholder="مثال: الأول" />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">الفصل / الشعبة</label>
                                    <input required name="class" defaultValue={editingStudent?.class} 
                                      className="w-full px-6 py-5 bg-slate-50 border border-transparent rounded-[1.5rem] outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 text-slate-900 font-bold text-sm text-center transition-all" placeholder="أ، ب..." />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">رقم اللجنة</label>
                                    <input name="committee" defaultValue={editingStudent?.committee} 
                                      className="w-full px-6 py-5 bg-slate-50 border border-transparent rounded-[1.5rem] outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 text-slate-900 font-bold text-sm text-center transition-all" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mr-1">
                                    <Phone size={14} className="text-emerald-500" /> هاتف ولي الأمر (لإرسال النتائج)
                                </label>
                                <input
                                    name="phone"
                                    type="tel"
                                    defaultValue={editingStudent?.phone}
                                    className="w-full px-8 py-5 bg-slate-50 border border-transparent rounded-[1.5rem] outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 text-slate-900 font-bold font-mono transition-all"
                                    placeholder="05XXXXXXXX"
                                    dir="ltr"
                                />
                            </div>
                            <div className="flex gap-4 mt-12 py-2">
                                <button type="submit" className="flex-1 py-6 bg-indigo-600 text-white rounded-[1.5rem] font-black hover:bg-indigo-700 shadow-2xl shadow-indigo-100 active:scale-95 transition-all text-xl">حفظ البيانات</button>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-12 py-6 bg-slate-100 text-slate-500 rounded-[1.5rem] font-black hover:bg-slate-200 transition-all text-xl">تجاهل</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentList;
