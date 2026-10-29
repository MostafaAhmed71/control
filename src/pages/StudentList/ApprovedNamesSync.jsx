import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { X, Trash2, CheckCircle2, AlertTriangle, Search, Save, UserPlus, Loader2 } from 'lucide-react';
import { deleteStudentsByIds, upsertStudents } from '../../utils/dataService';

/** توحيد الاسم العربي للمطابقة: حذف التشكيل والتطويل وتوحيد الهمزات والتاء المربوطة والياء */
export const normalizeArabicName = (value) =>
  String(value ?? '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/(^|\s)عبد\s+/g, '$1عبد')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normId = (v) => String(v ?? '').replace(/\D/g, '');

const HEADER_ALIASES = {
  name: ['الاسم', 'اسم الطالب', 'الاسم رباعي', 'اسم الطالبه', 'name'],
  nationalId: ['رقم الهوية', 'الهوية', 'السجل المدني', 'رقم السجل', 'nationalid'],
  seatNumber: ['رقم الجلوس', 'رقم الطالب', 'الجلوس', 'seat'],
  stage: ['المرحلة', 'المرحلة الدراسية', 'stage'],
  grade: ['الصف', 'رقم الصف', 'grade'],
  class: ['الفصل', 'الشعبة', 'class'],
  phone: ['رقم الجوال', 'الجوال', 'جوال', 'هاتف', 'phone'],
};

const cleanHeader = (h) => String(h ?? '').replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();

const detectColumns = (row) => {
  const map = {};
  row.forEach((cell, idx) => {
    const c = cleanHeader(cell);
    if (!c) return;
    for (const [field, names] of Object.entries(HEADER_ALIASES)) {
      if (map[field] != null) continue;
      if (names.some((n) => c === cleanHeader(n) || c.includes(cleanHeader(n)))) {
        map[field] = idx;
        break;
      }
    }
  });
  return map;
};

/** يقرأ الملف ويعيد قائمة الأسماء المعتمدة مع أي بيانات إضافية موجودة */
export async function parseApprovedFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  let rows;
  if (ext === 'txt') {
    const text = await file.text();
    rows = text.split(/\r?\n/).map((l) => [l]);
  } else {
    const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
    rows = [];
    wb.SheetNames.forEach((sn) => {
      rows.push(...XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: false }));
    });
  }

  let cols = null;
  let startIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const m = detectColumns(rows[i] || []);
    if (m.name != null) {
      cols = m;
      startIdx = i + 1;
      break;
    }
  }

  const out = [];
  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i] || [];
    let name;
    if (cols) {
      if (detectColumns(r).name != null) continue;
      name = r[cols.name];
    } else {
      name = r.find((c) => /[\u0600-\u06FF]{2,}/.test(String(c)) && String(c).trim().split(/\s+/).length >= 2);
    }
    name = String(name ?? '').replace(/\s+/g, ' ').trim();
    if (!name || !/[\u0600-\u06FFa-zA-Z]/.test(name)) continue;
    const pick = (f) => (cols && cols[f] != null ? String(r[cols[f]] ?? '').trim() : '');
    out.push({
      name,
      nationalId: pick('nationalId'),
      seatNumber: pick('seatNumber'),
      stage: pick('stage'),
      grade: pick('grade'),
      class: pick('class'),
      phone: pick('phone'),
    });
  }
  return out;
}

const tokensPrefix = (a, b) => {
  const ta = a.split(' ');
  const tb = b.split(' ');
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (short.length < 3) return false;
  return short.every((t, i) => long[i] === t);
};

/**
 * يطابق الأسماء المعتمدة مع سجل الطلاب:
 * أولاً برقم الهوية، ثم بالاسم الموحّد، ثم بتطابق بداية الاسم (ثلاثي مع رباعي).
 */
export function matchApprovedNames(approved, students) {
  const used = new Set();
  const byNat = new Map();
  const byName = new Map();
  students.forEach((s) => {
    const n = normId(s.nationalId || s.national_id);
    if (n) byNat.set(n, s);
    const k = normalizeArabicName(s.name);
    if (k && !byName.has(k)) byName.set(k, s);
  });

  const matches = [];
  const notFound = [];
  for (const a of approved) {
    let s = null;
    const n = normId(a.nationalId);
    if (n && byNat.has(n) && !used.has(byNat.get(n).id)) s = byNat.get(n);
    const key = normalizeArabicName(a.name);
    if (!s && byName.has(key) && !used.has(byName.get(key).id)) s = byName.get(key);
    if (!s) {
      s = students.find((st) => !used.has(st.id) && tokensPrefix(key, normalizeArabicName(st.name))) || null;
    }
    if (s) {
      used.add(s.id);
      matches.push({ approved: a, student: s });
    } else {
      notFound.push(a);
    }
  }
  return { matches, notFound, matchedIds: used };
}

const applyApproved = (student, a) => {
  const next = { ...student, name: a.name };
  ['nationalId', 'seatNumber', 'stage', 'grade', 'class', 'phone'].forEach((f) => {
    if (a[f]) next[f] = a[f];
  });
  return next;
};

const studentChanged = (s, a) =>
  s.name !== a.name || ['nationalId', 'seatNumber', 'stage', 'grade', 'class', 'phone'].some((f) => a[f] && String(s[f] ?? '') !== a[f]);

export default function ApprovedNamesSync({ fileName, approved, students, onClose, onDone }) {
  const fileGrades = useMemo(() => [...new Set(approved.map((a) => a.grade).filter(Boolean))], [approved]);
  const [onlyFileGrades, setOnlyFileGrades] = useState(fileGrades.length > 0);
  const [scopeGrade, setScopeGrade] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');
  const [saveProgress, setSaveProgress] = useState(null);
  const [updatesSaved, setUpdatesSaved] = useState(false);
  const [addedSaved, setAddedSaved] = useState(false);

  const { matches, notFound, matchedIds } = useMemo(() => matchApprovedNames(approved, students), [approved, students]);
  const changed = useMemo(() => matches.filter((m) => studentChanged(m.student, m.approved)), [matches]);

  const allGrades = useMemo(
    () => [...new Set(students.map((s) => s.grade).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'ar')),
    [students]
  );

  const unmatched = useMemo(
    () =>
      students
        .filter((s) => !matchedIds.has(s.id))
        .filter((s) => (onlyFileGrades && fileGrades.length ? fileGrades.includes(s.grade) : true))
        .filter((s) => (scopeGrade ? s.grade === scopeGrade : true))
        .sort((a, b) => String(a.grade || '').localeCompare(String(b.grade || ''), 'ar') || String(a.name || '').localeCompare(String(b.name || ''), 'ar')),
    [students, matchedIds, onlyFileGrades, fileGrades, scopeGrade]
  );

  const visibleUnmatched = useMemo(() => {
    const q = normalizeArabicName(search);
    return q ? unmatched.filter((s) => normalizeArabicName(s.name).includes(q)) : unmatched;
  }, [unmatched, search]);

  const [selected, setSelected] = useState(() => new Set());
  const allSelected = visibleUnmatched.length > 0 && visibleUnmatched.every((s) => selected.has(s.id));

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      visibleUnmatched.forEach((s) => (allSelected ? next.delete(s.id) : next.add(s.id)));
      return next;
    });

  const run = async (label, fn) => {
    setBusy(label);
    setSaveProgress({ current: 0, total: 0, pct: 8 });
    try {
      await fn();
    } catch (e) {
      alert('حدث خطأ: ' + (e?.message || e));
    } finally {
      setBusy('');
      setSaveProgress(null);
    }
  };

  const reportSave = ({ current, total }) => {
    setSaveProgress({
      current,
      total,
      pct: total ? Math.round((current / total) * 100) : 12,
    });
    return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  };

  const handleSaveUpdates = () =>
    run('update', async () => {
      await upsertStudents(changed.map((m) => applyApproved(m.student, m.approved)), reportSave);
      setUpdatesSaved(true);
      await onDone?.();
    });

  const handleAddNew = () =>
    run('add', async () => {
      if (!window.confirm(`سيتم إضافة ${notFound.length} طالب جديد إلى السجل. متابعة؟`)) return;
      await upsertStudents(notFound.map((a, i) => ({ id: `${Date.now()}${i}`, committee: '', ...a })), reportSave);
      setAddedSaved(true);
      await onDone?.();
    });

  const handleDelete = () =>
    run('delete', async () => {
      const ids = [...selected].filter((id) => unmatched.some((s) => s.id === id));
      if (!ids.length) return;
      if (!window.confirm(`سيتم حذف ${ids.length} طالب غير موجود في ملف الأسماء المعتمدة.\nلا يمكن التراجع عن هذه الخطوة. متابعة؟`)) return;
      await deleteStudentsByIds(ids);
      setSelected(new Set());
      await onDone?.();
      alert(`تم حذف ${ids.length} طالب بنجاح.`);
    });

  const stat = (label, value, cls) => (
    <div className={`rounded-2xl border p-3 text-center ${cls}`}>
      <div className="text-xs font-bold opacity-80">{label}</div>
      <div className="text-2xl font-black mt-1">{value}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" dir="rtl">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-xl font-black text-slate-800">مطابقة السجل مع الأسماء المعتمدة</h2>
            <p className="text-xs text-slate-500 mt-1">الملف: {fileName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">
          {saveProgress && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
              <p className="text-sm font-black text-indigo-800">جاري الحفظ…</p>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${Math.max(6, Math.min(100, saveProgress.pct || 0))}%` }}
                />
              </div>
              {saveProgress.total > 0 && (
                <p className="mt-2 text-xs font-bold text-indigo-700">
                  {saveProgress.current} / {saveProgress.total}
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stat('الأسماء في الملف', approved.length, 'border-slate-200 bg-slate-50 text-slate-700')}
            {stat('تمت مطابقتهم', matches.length, 'border-emerald-200 bg-emerald-50 text-emerald-700')}
            {stat('لم يتم تحديثهم (في السجل فقط)', unmatched.length, 'border-rose-200 bg-rose-50 text-rose-700')}
            {stat('في الملف وغير موجودين بالسجل', notFound.length, 'border-amber-200 bg-amber-50 text-amber-700')}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
              <CheckCircle2 size={18} />
              {updatesSaved
                ? 'تم حفظ تحديث بيانات الطلاب المطابقين'
                : changed.length
                  ? `${changed.length} طالب مطابق يحتاج تحديث الاسم/البيانات حسب الملف المعتمد`
                  : 'جميع الطلاب المطابقين محدّثون بالفعل'}
            </div>
            {!updatesSaved && changed.length > 0 && (
              <button
                type="button"
                disabled={!!busy}
                onClick={handleSaveUpdates}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy === 'update' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} حفظ التحديث ({changed.length})
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-rose-100">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-100 bg-rose-50/60 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-black text-rose-700">
                <AlertTriangle size={18} /> الطلاب الذين لم يتم تحديثهم (غير موجودين في الملف المعتمد)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {fileGrades.length > 0 && (
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                    <input type="checkbox" checked={onlyFileGrades} onChange={(e) => setOnlyFileGrades(e.target.checked)} />
                    فقط صفوف الملف ({fileGrades.join('، ')})
                  </label>
                )}
                <select
                  value={scopeGrade}
                  onChange={(e) => setScopeGrade(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold"
                >
                  <option value="">كل الصفوف</option>
                  {allGrades.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <div className="relative">
                  <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="بحث بالاسم"
                    className="rounded-xl border border-slate-200 bg-white py-1.5 pr-8 pl-3 text-xs"
                  />
                </div>
                <button
                  type="button"
                  disabled={!!busy || selected.size === 0}
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-40"
                >
                  {busy === 'delete' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} حذف المحدد ({selected.size})
                </button>
              </div>
            </div>
            <div className="max-h-[42vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white shadow-sm">
                  <tr className="text-slate-500 text-xs">
                    <th className="p-3 w-10">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                    </th>
                    <th className="p-3 text-right">اسم الطالب</th>
                    <th className="p-3">الصف</th>
                    <th className="p-3">الفصل</th>
                    <th className="p-3">رقم الهوية</th>
                    <th className="p-3">رقم الجلوس</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUnmatched.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => toggle(s.id)}
                      className={`cursor-pointer border-t border-slate-50 ${selected.has(s.id) ? 'bg-rose-50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="p-3 text-center">
                        <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} onClick={(e) => e.stopPropagation()} />
                      </td>
                      <td className="p-3 font-bold text-slate-700">{s.name}</td>
                      <td className="p-3 text-center text-slate-500">{s.grade || '—'}</td>
                      <td className="p-3 text-center text-slate-500">{s.class || '—'}</td>
                      <td className="p-3 text-center text-slate-500">{s.nationalId || '—'}</td>
                      <td className="p-3 text-center text-slate-500">{s.seatNumber || '—'}</td>
                    </tr>
                  ))}
                  {visibleUnmatched.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">لا يوجد طلاب غير محدّثين</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {notFound.length > 0 && (
            <details className="rounded-2xl border border-amber-100 bg-amber-50/40">
              <summary className="cursor-pointer px-4 py-3 text-sm font-black text-amber-800">
                أسماء في الملف المعتمد غير موجودة في السجل ({notFound.length})
              </summary>
              <div className="px-4 pb-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {notFound.map((a, i) => (
                    <span key={i} className="rounded-lg bg-white border border-amber-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {a.name}{a.grade ? ` — ${a.grade}` : ''}
                    </span>
                  ))}
                </div>
                {!addedSaved ? (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={handleAddNew}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    {busy === 'add' ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} إضافتهم إلى السجل
                  </button>
                ) : (
                  <div className="text-xs font-bold text-emerald-700">تمت الإضافة</div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
