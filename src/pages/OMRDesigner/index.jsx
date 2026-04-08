import React, { useState, useRef } from 'react';
import { OMR_API_BASE } from '../../utils/dataService';
import {
  Trash2, Save, Plus, Image as ImageIcon,
  QrCode, ChevronUp, ChevronDown, Download,
  RotateCcw, Palette
} from 'lucide-react';

/* ─────────── Constants ─────────── */
const A4_W = 595;  // points → use as px at 1x scale
const A4_H = 842;
const SCALE = 0.9; // canvas display scale

const QUESTIONS_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50];
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24];

/* ─────────── Default template ─────────── */
const defaultTemplate = () => ({
  logo: { show: true, x: 30, y: 20, size: 70, url: '' },
  schoolName: { show: true, x: A4_W / 2, y: 28, text: 'وزارة التعليم - مدرسة النموذجية', fontSize: 13, bold: true, align: 'center' },
  examTitle: { show: true, x: A4_W / 2, y: 48, text: 'اختبار نهاية الفصل الدراسي الأول', fontSize: 11, bold: true, align: 'center' },
  infoRow: {
    show: true, y: 72,
    fields: [
      { label: 'اسم الطالب', width: 180 },
      { label: 'الصف', width: 90 },
      { label: 'المادة', width: 90 },
      { label: 'التاريخ', width: 90 },
    ]
  },
  qrCode: { show: true, x: A4_W - 90, y: 20, size: 70 },
  questions: {
    show: true,
    count: 20,
    cols: 2,
    startY: 130,
    rowH: 28,
    optionSize: 14,
    optionGap: 22,
    marginX: 40,
    options: ['أ', 'ب', 'ج', 'د'],
  },
  dividerLine: { show: true, y: 115 },
  cornerMarkers: { show: true, size: 20 },
  bgColor: '#ffffff',
  borderColor: '#cccccc',
});

/* ─────────── Mini Preview component ─────────── */
const SheetPreview = ({ tpl, logoDataUrl }) => {
  const W = A4_W * SCALE;
  const H = A4_H * SCALE;
  const s = SCALE;

  const qs = tpl.questions;
  const perCol = Math.ceil(qs.count / qs.cols);
  const colW = (A4_W - qs.marginX * 2) / qs.cols;

  return (
    <div className="relative bg-white shadow-2xl rounded-md overflow-hidden border border-gray-200"
      style={{ width: W, height: H, flexShrink: 0 }}>

      {/* Corner markers */}
      {tpl.cornerMarkers.show && ['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
        <div key={i} className={`absolute ${pos} bg-black`}
          style={{ width: tpl.cornerMarkers.size * s, height: tpl.cornerMarkers.size * s }} />
      ))}

      {/* Logo */}
      {tpl.logo.show && (
        <div className="absolute flex items-center justify-center border border-gray-200 rounded"
          style={{ left: tpl.logo.x * s, top: tpl.logo.y * s, width: tpl.logo.size * s, height: tpl.logo.size * s }}>
          {logoDataUrl
            ? <img src={logoDataUrl} className="w-full h-full object-contain" alt="logo" />
            : <ImageIcon size={20} className="text-gray-300" />}
        </div>
      )}

      {/* QR code placeholder */}
      {tpl.qrCode.show && (
        <div className="absolute flex flex-col items-center justify-center border border-dashed border-gray-300 rounded bg-gray-50"
          style={{ left: tpl.qrCode.x * s, top: tpl.qrCode.y * s, width: tpl.qrCode.size * s, height: tpl.qrCode.size * s }}>
          <QrCode size={18} className="text-gray-400" />
          <span className="text-[6px] text-gray-400 mt-1">QR</span>
        </div>
      )}

      {/* School name */}
      {tpl.schoolName.show && (
        <div className="absolute text-center w-full" style={{ top: tpl.schoolName.y * s }}>
          <span className="block font-black text-gray-800"
            style={{ fontSize: tpl.schoolName.fontSize * s, fontWeight: tpl.schoolName.bold ? 800 : 400 }}>
            {tpl.schoolName.text}
          </span>
        </div>
      )}

      {/* Exam title */}
      {tpl.examTitle.show && (
        <div className="absolute text-center w-full" style={{ top: tpl.examTitle.y * s }}>
          <span className="block text-gray-700"
            style={{ fontSize: tpl.examTitle.fontSize * s, fontWeight: tpl.examTitle.bold ? 700 : 400 }}>
            {tpl.examTitle.text}
          </span>
        </div>
      )}

      {/* Info row */}
      {tpl.infoRow.show && (
        <div className="absolute flex flex-row-reverse gap-1 px-2"
          style={{ top: tpl.infoRow.y * s, left: 0, right: 0 }}>
          {tpl.infoRow.fields.map((f, i) => (
            <div key={i} className="border border-gray-400 rounded flex items-center justify-end px-1"
              style={{ width: f.width * s, height: 16 * s }}>
              <span className="text-gray-500" style={{ fontSize: 6.5 * s }}>{f.label}: ___________</span>
            </div>
          ))}
        </div>
      )}

      {/* Divider */}
      {tpl.dividerLine.show && (
        <div className="absolute left-0 right-0 border-t border-gray-300"
          style={{ top: tpl.dividerLine.y * s }} />
      )}

      {/* Questions grid */}
      {qs.show && Array.from({ length: qs.count }).map((_, idx) => {
        const col = Math.floor(idx / perCol);
        const rowInCol = idx % perCol;
        const x = qs.marginX * s + col * colW * s;
        const y = qs.startY * s + rowInCol * qs.rowH * s;
        return (
          <div key={idx} className="absolute flex items-center flex-row-reverse"
            style={{ left: x, top: y }}>
            <span className="text-gray-600 font-bold ml-1" style={{ fontSize: 7 * s, minWidth: 16 * s }}>
              {idx + 1}
            </span>
            {qs.options.map((opt, oi) => (
              <div key={oi} className="border border-gray-500 rounded-full flex items-center justify-center"
                style={{ width: qs.optionSize * s, height: qs.optionSize * s, marginRight: qs.optionGap * s * 0.15 }}>
                <span style={{ fontSize: 5.5 * s, color: '#555' }}>{opt}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

/* ─────────── Sidebar panel ─────────── */
const SectionPanel = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden mb-2">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex justify-between items-center px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
        <span className="text-xs font-black text-gray-600 uppercase tracking-wider">{title}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div className="p-4 space-y-3 bg-white">{children}</div>}
    </div>
  );
};

const Label = ({ children }) => <label className="block text-xs font-bold text-gray-500 mb-1">{children}</label>;
const NumInput = ({ value, onChange, min, max, step = 1, label }) => (
  <div>
    {label && <Label>{label}</Label>}
    <input type="number" value={value} min={min} max={max} step={step}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full p-2 bg-slate-50 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-400" />
  </div>
);
const Toggle = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs font-bold text-gray-600">{label}</span>
    <button onClick={() => onChange(!value)}
      className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${value ? 'bg-indigo-500' : 'bg-gray-200'}`}>
      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : ''}`} />
    </button>
  </div>
);

/* ─────────── Main Designer ─────────── */
const OMRDesigner = () => {
  const [tpl, setTpl] = useState(defaultTemplate);
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [activeTab, setActiveTab] = useState('header');
  const [saved, setSaved] = useState(false);
  const [engineStatus, setEngineStatus] = useState(''); // '', 'ok', 'error'
  const logoInputRef = useRef();

  const update = (path, value) => {
    setTpl(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
    setSaved(false);
  };

  const updateField = (idx, key, val) => {
    setTpl(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next.infoRow.fields[idx][key] = val;
      return next;
    });
    setSaved(false);
  };

  const addField = () => {
    setTpl(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next.infoRow.fields.push({ label: 'حقل جديد', width: 80 });
      return next;
    });
  };

  const removeField = (idx) => {
    setTpl(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next.infoRow.fields.splice(idx, 1);
      return next;
    });
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    localStorage.setItem('omr_template_config', JSON.stringify({ tpl, logoDataUrl }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => { setTpl(defaultTemplate()); setLogoDataUrl(''); };

  const handleSendToBackend = async () => {
    setEngineStatus('');
    try {
      const res = await fetch(`${OMR_API_BASE}/save-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tpl, logoDataUrl })
      });
      if (res.ok) {
        setEngineStatus('ok');
        setTimeout(() => setEngineStatus(''), 3000);
      } else {
        setEngineStatus('error');
      }
    } catch {
      setEngineStatus('error');
    }
  };

  const handleLoadFromServer = async () => {
    try {
      const res = await fetch(`${OMR_API_BASE}/get-template`);
      if (res.ok) {
        const data = await res.json();
        if (data.tpl) setTpl(data.tpl);
        if (data.logoDataUrl) setLogoDataUrl(data.logoDataUrl);
        setEngineStatus('loaded');
        setTimeout(() => setEngineStatus(''), 2000);
      }
    } catch {
      setEngineStatus('error');
    }
  };

  const TABS = [
    { id: 'header', label: 'الترويسة' },
    { id: 'questions', label: 'الأسئلة' },
    { id: 'layout', label: 'التخطيط' },
  ];

  return (
    <div className="flex gap-0 min-h-screen bg-slate-100 animate-in fade-in" dir="rtl">

      {/* ── Left Toolbar ── */}
      <div className="w-80 bg-white border-l border-gray-100 shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 bg-gradient-to-l from-indigo-600 to-violet-600 text-white">
          <h2 className="text-lg font-black">مصمم قالب OMR</h2>
          <p className="text-indigo-100 text-xs mt-1">خصص ورقة الإجابات بالكامل</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-black transition-all ${activeTab === t.id ? 'border-b-2 border-indigo-500 text-indigo-600 bg-indigo-50/50' : 'text-gray-400 hover:text-gray-600'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* ── Header Tab ── */}
          {activeTab === 'header' && (
            <>
              <SectionPanel title="الشعار" defaultOpen>
                <Toggle label="إظهار الشعار" value={tpl.logo.show} onChange={v => update('logo.show', v)} />
                {tpl.logo.show && (
                  <>
                    <div>
                      <Label>صورة الشعار</Label>
                      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                      <button onClick={() => logoInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-indigo-200 rounded-xl text-indigo-500 text-xs font-bold hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                        <ImageIcon size={16} /> {logoDataUrl ? 'تغيير الشعار' : 'رفع شعار المدرسة'}
                      </button>
                      {logoDataUrl && (
                        <div className="mt-2 flex justify-center">
                          <img src={logoDataUrl} className="h-16 object-contain rounded-lg border border-gray-100" />
                        </div>
                      )}
                    </div>
                    <NumInput label="الحجم" value={tpl.logo.size} onChange={v => update('logo.size', v)} min={30} max={120} />
                    <div className="grid grid-cols-2 gap-2">
                      <NumInput label="موضع X" value={tpl.logo.x} onChange={v => update('logo.x', v)} min={0} max={300} />
                      <NumInput label="موضع Y" value={tpl.logo.y} onChange={v => update('logo.y', v)} min={0} max={200} />
                    </div>
                  </>
                )}
              </SectionPanel>

              <SectionPanel title="اسم المدرسة">
                <Toggle label="إظهار" value={tpl.schoolName.show} onChange={v => update('schoolName.show', v)} />
                {tpl.schoolName.show && <>
                  <div>
                    <Label>النص</Label>
                    <input value={tpl.schoolName.text} onChange={e => update('schoolName.text', e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-400" dir="rtl" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumInput label="حجم الخط" value={tpl.schoolName.fontSize} onChange={v => update('schoolName.fontSize', v)} min={8} max={24} />
                    <NumInput label="موضع Y" value={tpl.schoolName.y} onChange={v => update('schoolName.y', v)} min={0} max={200} />
                  </div>
                  <Toggle label="خط عريض" value={tpl.schoolName.bold} onChange={v => update('schoolName.bold', v)} />
                </>}
              </SectionPanel>

              <SectionPanel title="عنوان الاختبار">
                <Toggle label="إظهار" value={tpl.examTitle.show} onChange={v => update('examTitle.show', v)} />
                {tpl.examTitle.show && <>
                  <div>
                    <Label>النص</Label>
                    <input value={tpl.examTitle.text} onChange={e => update('examTitle.text', e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-400" dir="rtl" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumInput label="حجم الخط" value={tpl.examTitle.fontSize} onChange={v => update('examTitle.fontSize', v)} min={8} max={20} />
                    <NumInput label="موضع Y" value={tpl.examTitle.y} onChange={v => update('examTitle.y', v)} min={0} max={200} />
                  </div>
                </>}
              </SectionPanel>

              <SectionPanel title="QR Code">
                <Toggle label="إظهار QR" value={tpl.qrCode.show} onChange={v => update('qrCode.show', v)} />
                {tpl.qrCode.show && <div className="grid grid-cols-2 gap-2">
                  <NumInput label="حجم" value={tpl.qrCode.size} onChange={v => update('qrCode.size', v)} min={40} max={120} />
                  <NumInput label="موضع Y" value={tpl.qrCode.y} onChange={v => update('qrCode.y', v)} min={0} max={200} />
                </div>}
              </SectionPanel>

              <SectionPanel title="حقول بيانات الطالب">
                <Toggle label="إظهار" value={tpl.infoRow.show} onChange={v => update('infoRow.show', v)} />
                {tpl.infoRow.show && <>
                  <NumInput label="موضع Y" value={tpl.infoRow.y} onChange={v => update('infoRow.y', v)} min={60} max={200} />
                  <div className="space-y-2">
                    {tpl.infoRow.fields.map((f, i) => (
                      <div key={i} className="flex gap-2 items-center p-2 bg-slate-50 rounded-xl">
                        <input value={f.label} onChange={e => updateField(i, 'label', e.target.value)}
                          className="flex-1 p-1.5 text-xs font-bold bg-white border border-gray-200 rounded-lg" dir="rtl" />
                        <input type="number" value={f.width} onChange={e => updateField(i, 'width', Number(e.target.value))}
                          className="w-14 p-1.5 text-xs font-bold bg-white border border-gray-200 rounded-lg text-center" />
                        <button onClick={() => removeField(i)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    <button onClick={addField}
                      className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 font-bold hover:border-indigo-300 hover:text-indigo-500 transition-all flex items-center justify-center gap-1">
                      <Plus size={13} /> إضافة حقل
                    </button>
                  </div>
                </>}
              </SectionPanel>
            </>
          )}

          {/* ── Questions Tab ── */}
          {activeTab === 'questions' && (
            <>
              <SectionPanel title="إعدادات الأسئلة" defaultOpen>
                <NumInput label="عدد الأسئلة" value={tpl.questions.count} onChange={v => update('questions.count', v)} min={5} max={100} />
                <NumInput label="عدد الأعمدة" value={tpl.questions.cols} onChange={v => update('questions.cols', v)} min={1} max={4} />
                <NumInput label="بداية Y" value={tpl.questions.startY} onChange={v => update('questions.startY', v)} min={80} max={300} />
                <NumInput label="ارتفاع الصف" value={tpl.questions.rowH} onChange={v => update('questions.rowH', v)} min={16} max={50} />
              </SectionPanel>
              <SectionPanel title="الدوائر (Bubbles)">
                <NumInput label="حجم الدائرة" value={tpl.questions.optionSize} onChange={v => update('questions.optionSize', v)} min={8} max={30} />
                <NumInput label="المسافة بين الخيارات" value={tpl.questions.optionGap} onChange={v => update('questions.optionGap', v)} min={14} max={50} />
                <NumInput label="هامش أفقي" value={tpl.questions.marginX} onChange={v => update('questions.marginX', v)} min={10} max={100} />
                <div>
                  <Label>تسميات الخيارات (مفصولة بفاصلة)</Label>
                  <input value={tpl.questions.options.join(',')}
                    onChange={e => update('questions.options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    className="w-full p-2 bg-slate-50 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-400" dir="ltr" />
                  <p className="text-[10px] text-gray-400 mt-1">مثال: أ,ب,ج,د أو A,B,C,D</p>
                </div>
              </SectionPanel>
            </>
          )}

          {/* ── Layout Tab ── */}
          {activeTab === 'layout' && (
            <>
              <SectionPanel title="خط الفاصل" defaultOpen>
                <Toggle label="إظهار خط فاصل" value={tpl.dividerLine.show} onChange={v => update('dividerLine.show', v)} />
                {tpl.dividerLine.show && <NumInput label="موضع Y" value={tpl.dividerLine.y} onChange={v => update('dividerLine.y', v)} min={50} max={300} />}
              </SectionPanel>
              <SectionPanel title="أركان المعايرة">
                <Toggle label="إظهار المربعات" value={tpl.cornerMarkers.show} onChange={v => update('cornerMarkers.show', v)} />
                {tpl.cornerMarkers.show && <NumInput label="الحجم" value={tpl.cornerMarkers.size} onChange={v => update('cornerMarkers.size', v)} min={10} max={40} />}
              </SectionPanel>
              <SectionPanel title="ألوان">
                <div>
                  <Label>لون الخلفية</Label>
                  <input type="color" value={tpl.bgColor} onChange={e => update('bgColor', e.target.value)}
                    className="w-full h-10 rounded-xl border border-gray-200 cursor-pointer" />
                </div>
              </SectionPanel>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-gray-100 space-y-2 bg-slate-50/50">
          <button onClick={handleSave}
            className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
              ${saved ? 'bg-green-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200'}`}>
            <Save size={16} /> {saved ? '✓ تم الحفظ!' : 'حفظ التصميم محلياً'}
          </button>
          {engineStatus === 'ok' && <div className="text-center text-xs font-bold text-green-600 bg-green-50 rounded-xl py-2">✅ تم الإرسال للمحرك بنجاح</div>}
          {engineStatus === 'error' && <div className="text-center text-xs font-bold text-red-500 bg-red-50 rounded-xl py-2">⚠️ فشل الاتصال — تأكد من تشغيل FastAPI</div>}
          {engineStatus === 'loaded' && <div className="text-center text-xs font-bold text-indigo-600 bg-indigo-50 rounded-xl py-2">✓ تم استيراد القالب</div>}
          <div className="grid grid-cols-3 gap-2">
            <button onClick={handleSendToBackend}
              className="py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-green-100 transition-colors">
              <Download size={14} /> إرسال
            </button>
            <button onClick={handleLoadFromServer}
              className="py-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-blue-100 transition-colors">
              ↓ استيراد
            </button>
            <button onClick={handleReset}
              className="py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-red-100 transition-colors">
              <RotateCcw size={14} /> ضبط
            </button>
          </div>
        </div>
      </div>

      {/* ── Canvas Area ── */}
      <div className="flex-1 flex flex-col items-center justify-start overflow-auto bg-slate-200 p-8 gap-6">
        <div className="flex items-center gap-4 self-start">
          <h1 className="text-xl font-black text-gray-700">معاينة القالب (A4)</h1>
          <span className="px-3 py-1 bg-white rounded-full text-xs font-bold text-gray-400 shadow-sm">
            {A4_W} × {A4_H} نقطة
          </span>
        </div>

        <SheetPreview tpl={tpl} logoDataUrl={logoDataUrl} />

        <p className="text-xs text-gray-400 font-medium">
          💡 غيّر الإعدادات من الشريط الجانبي — المعاينة تتحدث فوراً
        </p>
      </div>
    </div>
  );
};

export default OMRDesigner;
