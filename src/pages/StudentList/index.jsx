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

    const handleSave = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const studentData = {
            id: editingStudent?.id,
            name: formData.get('name'),
            seatNumber: formData.get('seatNumber') || '',
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

                if (fileExtension === 'json') {
                    importedData = JSON.parse(event.target.result);
                } else if (['xlsx', 'xls', 'csv'].includes(fileExtension)) {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const rawJsonData = XLSX.utils.sheet_to_json(worksheet);
                    
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

                    // Map Excel columns to our data structure
                    importedData = jsonData.map((row, index) => ({
                        id: Date.now().toString() + index,
                        name: (row['الاسم'] || row['اسم الطالب'] || row['الاسم رباعي'] || row['Name'] || row['student name'] || '').toString().trim(),
                        seatNumber: (row['رقم الجلوس'] || row['الجلوس'] || row['Seat Number'] || row['seat'] || '').toString().trim(),
                        stage: (row['المرحلة'] || row['المرحلة الدراسية'] || row['Stage'] || row['الصفوف'] || row['المستوي'] || '').toString().trim(),
                        grade: (row['الصف'] || row['الصف الدراسي'] || row['Grade'] || row['grade'] || '').toString().trim(),
                        class: (row['الفصل'] || row['الشعبة'] || row['Class'] || '').toString().trim(),
                        committee: (row['اللجنة'] || row['رقم اللجنة'] || row['Committee'] || '').toString().trim(),
                        phone: (row['رقم الجوال'] || row['الجوال'] || row['هاتف'] || row['Phone'] || row['phone'] || row['جوال'] || '').toString().trim(),
                    })).filter(s => s.name); // Filter out empty rows
                }

                if (Array.isArray(importedData) && importedData.length > 0) {
                    if (confirm(`هل أنت متأكد من استيراد ${importedData.length} طالب؟ سيتم استبدال القائمة الحالية.`)) {
                        await saveStudentsBulk(importedData);
                        fetchStudents();
                        alert('تم استيراد البيانات بنجاح');
                    }
                } else {
                    alert('ملف غير صالح أو فارغ. يرجى التأكد من رؤوس الأعمدة (الاسم، رقم الجلوس، الصف، إلخ).');
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
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl hover:bg-white/10 transition-all active:scale-95 text-sm font-bold"
                    >
                        <FileSpreadsheet size={16} className="text-gold" />
                        <span>استيراد بيانات</span>
                    </button>
                    <button
                        onClick={() => {
                            const suggested = suggestStartNumber();
                            setGenConfig({ ...genConfig, startNumber: suggested.toString() });
                            setIsGeneratorOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gold/10 text-gold rounded-xl hover:bg-gold/20 border border-gold/20 transition-all font-bold active:scale-95 text-sm"
                    >
                        <Wand2 size={16} />
                        <span>توليد أرقام جلوس</span>
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl hover:bg-white/10 transition-all active:scale-95 text-sm font-bold"
                    >
                        <Download size={16} />
                        <span>تصدير</span>
                    </button>
                    <button
                        onClick={() => { setEditingStudent(null); setIsModalOpen(true); }}
                        className="flex items-center gap-2 px-6 py-2 bg-gold text-navy rounded-xl hover:brightness-110 transition-all shadow-lg shadow-gold/10 active:scale-95 font-black text-sm"
                    >
                        <UserPlus size={18} />
                        <span>إضافة طالب جديد</span>
                    </button>
                    <button
                        onClick={handleDeleteAll}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition-all active:scale-95 text-sm font-bold"
                    >
                        <Trash2 size={16} />
                        <span>حذف الكل</span>
                    </button>
                </div>
            </div>

            <div className="glass rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex flex-col md:flex-row gap-6 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="ابحث عن اسم أو رقم جلوس..."
                            className="w-full pr-12 pl-4 py-3 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-gold/20 focus:border-gold outline-none transition-all text-white placeholder:text-slate-600"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <Filter size={18} className="text-gold" />
                        <span className="text-slate-400 text-sm font-bold">تصفية بالمرحلة:</span>
                        <select
                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-gold outline-none"
                            value={selectedStage}
                            onChange={(e) => setSelectedStage(e.target.value)}
                        >
                            {stages.map(s => <option key={s} value={s} className="bg-navy">{s === 'الكل' ? 'جميع المراحل' : s}</option>)}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto h-[60vh] custom-scrollbar">
                    <table className="w-full text-right border-collapse">
                        <thead>
                            <tr className="bg-white/5 text-gold text-xs font-black uppercase tracking-widest border-b border-white/5">
                                <th className="px-8 py-5">اسم الطالب</th>
                                <th className="px-8 py-5">رقم الجلوس</th>
                                <th className="px-8 py-5">المرحلة</th>
                                <th className="px-8 py-5">الصف</th>
                                <th className="px-8 py-5">الفصل</th>
                                <th className="px-8 py-5">رقم الجوال</th>
                                <th className="px-8 py-5">اللجنة</th>
                                <th className="px-8 py-5 text-center">التحكم</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr><td colSpan="8" className="text-center py-20 text-slate-500 font-bold animate-pulse">جاري جلب السجلات الملكية...</td></tr>
                            ) : filteredStudents.length === 0 ? (
                                <tr><td colSpan="8" className="text-center py-20 text-slate-600 font-medium italic">لا يوجد طلاب مطابقين في السجلات الحالية</td></tr>
                            ) : filteredStudents.map((student) => (
                                <tr key={student.id} className="hover:bg-white/5 transition-all">
                                    <td className="px-8 py-5">
                                        <div className="font-bold text-white text-lg">{student.name}</div>
                                    </td>
                                    <td className="px-8 py-5 font-black text-gold text-lg tracking-widest">{student.seatNumber}</td>
                                    <td className="px-8 py-5">
                                        <span className="px-3 py-1 rounded-lg text-[11px] font-black bg-white/5 text-slate-300 border border-white/10 uppercase tracking-tighter">
                                            {student.stage}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="px-3 py-1 rounded-lg text-[11px] font-black bg-gold/10 text-gold border border-gold/20">
                                            {student.grade}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-slate-300 font-bold">{student.class}</td>
                                    <td className="px-8 py-5">
                                        {student.phone ? (
                                            <a href={`tel:${student.phone}`}
                                                className="flex items-center gap-2 text-emerald-400 font-black text-sm hover:text-emerald-300 transition-colors">
                                                <Phone size={14} className="shrink-0" />
                                                {student.phone}
                                            </a>
                                        ) : (
                                            <span className="text-slate-700 text-xs italic">—</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-5">
                                        {student.committee ? (
                                            <span className="bg-white/5 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-black border border-white/10">
                                                اللجنة {student.committee}
                                            </span>
                                        ) : (
                                            <span className="text-slate-700 text-xs italic">غير مدرج</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <div className="flex justify-center gap-3">
                                            <button
                                                onClick={() => { setEditingStudent(student); setIsModalOpen(true); }}
                                                className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all hover:scale-110"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(student.id)}
                                                className="p-2 text-red-400 hover:bg-red-400/10 rounded-xl transition-all hover:scale-110"
                                            >
                                                <Trash2 size={18} />
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/80 backdrop-blur-md">
                    <div className="glass w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-pop-in">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-xl font-black gold-text">توليد الأرقام الملكية</h3>
                            <button onClick={() => setIsGeneratorOpen(false)} className="text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-black text-slate-400 uppercase tracking-widest">المرحلة التعليمية</label>
                                <select
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-gold text-white font-bold"
                                    value={genConfig.stage}
                                    onChange={(e) => setGenConfig({ ...genConfig, stage: e.target.value, grade: '' })}
                                >
                                    <option value="" className="bg-navy">-- اختر المرحلة --</option>
                                    {(() => {
                                        const dataStages = [...new Set(students.map(s => s.stage).filter(Boolean))];
                                        const displayStages = [...new Set(['الابتدائي', 'المتوسط', 'الثانوي', ...dataStages])];
                                        return displayStages.map(s => {
                                            const count = students.filter(std => std.stage === s).length;
                                            return <option key={s} value={s} className="bg-navy">{s} ({count} طالب)</option>;
                                        });
                                    })()}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-black text-slate-400 uppercase tracking-widest">الصف</label>
                                <select
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-gold text-white font-bold"
                                    value={genConfig.grade}
                                    onChange={(e) => setGenConfig({ ...genConfig, grade: e.target.value })}
                                >
                                    <option value="" className="bg-navy">-- اختر الصف --</option>
                                    {[...new Set(students.filter(s => s.stage === genConfig.stage).map(s => s.grade))].map(g => (
                                        <option key={g} value={g} className="bg-navy">{g}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-black text-slate-400 uppercase tracking-widest">رقم البداية</label>
                                <input
                                    type="number"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-gold text-white font-bold placeholder:text-slate-700"
                                    value={genConfig.startNumber}
                                    onChange={(e) => setGenConfig({ ...genConfig, startNumber: e.target.value })}
                                    placeholder="مثال: 1001"
                                />
                            </div>

                            <div className="flex gap-4 mt-8">
                                <button
                                    onClick={handleGenerateSeats}
                                    className="flex-1 py-4 bg-gold text-navy rounded-2xl font-black hover:brightness-110 shadow-lg shadow-gold/20 active:scale-95 transition-all text-lg"
                                >
                                    بدء التوليد
                                </button>
                                <button onClick={() => setIsGeneratorOpen(false)} className="px-8 py-4 bg-white/5 text-slate-400 rounded-2xl font-black hover:bg-white/10 hover:text-white transition-all text-lg">إلغاء</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/80 backdrop-blur-md">
                    <div className="glass w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-pop-in">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-2xl font-black gold-text">
                                {editingStudent ? 'تحديث السجل الملكي' : 'إضافة عضو جديد'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white text-3xl font-light">×</button>
                        </div>
                        <form onSubmit={handleSave} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">الاسم الكامل للطالب</label>
                                <input required name="name" defaultValue={editingStudent?.name} className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-gold text-white font-bold text-lg" />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">رقم الجلوس</label>
                                    <input name="seatNumber" defaultValue={editingStudent?.seatNumber} className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-gold text-white font-bold font-mono tracking-widest" placeholder="تلقائي" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">المرحلة</label>
                                    <select required name="stage" defaultValue={editingStudent?.stage || 'الثانوي'} className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-gold text-white font-bold">
                                        <option value="الابتدائي" className="bg-navy">الابتدائي</option>
                                        <option value="المتوسط" className="bg-navy">المتوسط</option>
                                        <option value="الثانوي" className="bg-navy">الثانوي</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">الصف</label>
                                    <input required name="grade" defaultValue={editingStudent?.grade} className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-gold text-white font-bold text-sm" placeholder="مثال: الأول" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">الفصل</label>
                                    <input required name="class" defaultValue={editingStudent?.class} className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-gold text-white font-bold text-sm text-center" placeholder="أ، ب..." />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">اللجنة</label>
                                    <input name="committee" defaultValue={editingStudent?.committee} className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-gold text-white font-bold text-sm text-center" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Phone size={14} className="text-emerald-500" /> هاتف ولي الأمر
                                </label>
                                <input
                                    name="phone"
                                    type="tel"
                                    defaultValue={editingStudent?.phone}
                                    className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-gold text-white font-bold font-mono"
                                    placeholder="05XXXXXXXX"
                                    dir="ltr"
                                />
                            </div>
                            <div className="flex gap-4 mt-10">
                                <button type="submit" className="flex-1 py-5 bg-gold text-navy rounded-2xl font-black hover:brightness-110 shadow-xl shadow-gold/10 active:scale-95 transition-all text-xl">حفظ السجل</button>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-10 py-5 bg-white/5 text-slate-400 rounded-2xl font-black hover:bg-white/10 hover:text-white transition-all text-xl">إلغاء</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentList;
