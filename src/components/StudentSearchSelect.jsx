import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Users, X } from 'lucide-react';
import {
    getStudentNationalId,
    getStudentSeatNumber,
    normalizeStudentId,
    normalizeStudentName,
} from '../utils/studentIdentity';

const RESULT_LIMIT = 80;

const studentMatchesQuery = (student, query) => {
    if (!query) return false;
    const name = normalizeStudentName(student?.name);
    const national = normalizeStudentId(getStudentNationalId(student));
    const seat = normalizeStudentId(getStudentSeatNumber(student));
    const phone = String(student?.phone || '').replace(/\D/g, '');
    const grade = String(student?.grade || '').toLowerCase();
    const qId = normalizeStudentId(query);
    const qName = normalizeStudentName(query);
    const qPhone = query.replace(/\D/g, '');

    if (qName && name.includes(qName)) return true;
    if (qId && (national.includes(qId) || seat.includes(qId) || String(student?.id || '').includes(qId))) {
        return true;
    }
    if (qPhone.length >= 3 && phone.includes(qPhone)) return true;
    return grade.includes(query.toLowerCase());
};

const StudentSearchSelect = ({
    students = [],
    value = '',
    onChange,
    disabled = false,
    placeholder = 'ابحث واختر الطالب…',
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const rootRef = useRef(null);
    const inputRef = useRef(null);

    const selected = useMemo(
        () => (students || []).find((s) => String(s.id) === String(value)) || null,
        [students, value]
    );

    const filtered = useMemo(() => {
        const q = query.trim();
        if (!q) return [];
        return (students || []).filter((s) => studentMatchesQuery(s, q)).slice(0, RESULT_LIMIT);
    }, [students, query]);

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    useEffect(() => {
        if (open) {
            setQuery('');
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [open]);

    const pick = (student) => {
        onChange?.(student?.id || '');
        setOpen(false);
        setQuery('');
    };

    const clear = (e) => {
        e.stopPropagation();
        if (disabled) return;
        onChange?.('');
        setQuery('');
        setOpen(true);
    };

    return (
        <div ref={rootRef} className={`relative w-full max-w-md ${open ? 'z-40' : 'z-10'}`}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen((v) => !v)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-right transition-colors
          ${disabled ? 'opacity-70 cursor-default' : 'hover:border-indigo-300'}
          ${
              selected
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                  : 'bg-rose-50 text-rose-800 border-rose-100'
          }`}
            >
                <Users size={16} className="shrink-0 opacity-70" />
                <span className="flex-1 min-w-0 truncate text-xs font-black">
                    {selected
                        ? `${selected.name}${selected.phone ? ` · ${selected.phone}` : ' · بدون جوال'}`
                        : placeholder}
                </span>
                {selected && !disabled ? (
                    <span
                        role="button"
                        tabIndex={0}
                        onClick={clear}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                clear(e);
                            }
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:bg-white hover:text-rose-600"
                        aria-label="مسح الاختيار"
                    >
                        <X size={14} />
                    </span>
                ) : null}
                {!disabled && (
                    <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                )}
            </button>

            {open && !disabled && (
                <div className="absolute z-50 top-full mt-1 right-0 left-0 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-80 flex flex-col">
                    <div className="p-2 border-b border-slate-100 bg-slate-50">
                        <div className="relative">
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="ابحث بالاسم أو الهوية أو الجوال…"
                                className="w-full px-3 py-2 pr-9 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                            <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-2.5 text-slate-400" />
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1">
                        {!query.trim() ? (
                            <div className="p-6 text-center text-slate-400 text-xs font-bold leading-relaxed">
                                اكتب جزءاً من الاسم أو رقم الهوية أو الجوال
                                <span className="block mt-1 font-black text-slate-500">
                                    {students.length} طالب في القائمة
                                </span>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 text-xs font-bold">لا يوجد طالب مطابق</div>
                        ) : (
                            filtered.map((s) => {
                                const sid = String(s.id);
                                const isSel = sid === String(value || '');
                                const nat = getStudentNationalId(s);
                                const seat = getStudentSeatNumber(s);
                                return (
                                    <button
                                        type="button"
                                        key={sid}
                                        onClick={() => pick(s)}
                                        className={`w-full px-3 py-2.5 flex items-center gap-2 text-right border-b border-slate-50 last:border-0 hover:bg-indigo-50 ${
                                            isSel ? 'bg-indigo-50' : ''
                                        }`}
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs shrink-0">
                                            {(s.name || '?').charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-black text-slate-800 truncate">
                                                {s.name || '—'}
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-bold flex flex-wrap gap-x-2">
                                                {s.phone ? (
                                                    <span dir="ltr">{s.phone}</span>
                                                ) : (
                                                    <span className="text-rose-500">بدون جوال</span>
                                                )}
                                                {nat ? <span className="font-mono">هوية {nat}</span> : null}
                                                {seat ? <span className="font-mono">جلوس {seat}</span> : null}
                                                {s.grade ? <span>{s.grade}</span> : null}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                    {query.trim() && filtered.length === RESULT_LIMIT ? (
                        <p className="px-3 py-2 text-[10px] font-bold text-slate-400 border-t border-slate-100 bg-slate-50">
                            أظهرنا أول {RESULT_LIMIT} نتيجة — ضيّق البحث أكثر
                        </p>
                    ) : null}
                </div>
            )}
        </div>
    );
};

export default StudentSearchSelect;
