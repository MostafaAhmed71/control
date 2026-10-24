import React, { useState } from 'react';
import SchoolLogo from './SchoolLogo';
import {
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { saveGuardianRsvp } from './dataService';
import { RSVP_STATUS, RSVP_LABELS, formatRsvpDate } from './graduationUtils';

export default function ParentRsvp() {
  const [guardianName, setGuardianName] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const gName = guardianName.trim();
    if (!gName) {
      setSaveError('يرجى إدخال اسم ولي الأمر.');
      return;
    }
    if (!status) {
      setSaveError('يرجى اختيار الحضور أو الاعتذار.');
      return;
    }

    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      await saveGuardianRsvp({ guardianName: gName, status });
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err.message || 'تعذّر حفظ الرد. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden text-slate-900 font-sans" dir="rtl">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-50 via-white to-indigo-100" />
      <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-amber-300/30 blur-3xl animate-pulse-soft" />
      <div className="pointer-events-none absolute top-1/3 -left-20 h-64 w-64 rounded-full bg-indigo-300/25 blur-3xl animate-pulse-soft" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-rose-200/30 blur-3xl" />

      <header className="relative z-10 safe-pt">
        <div className="mx-auto max-w-lg px-4 pt-5 pb-2 sm:px-6">
          <div className="animate-fade-in-up rounded-[1.75rem] border border-white/70 bg-white/75 p-4 shadow-lg shadow-amber-100/60 backdrop-blur-md sm:p-5">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-2xl bg-amber-400/20 blur-md" />
                <SchoolLogo size="lg" className="relative drop-shadow-md animate-float" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-amber-100/90 px-2.5 py-1 text-[11px] font-black text-amber-800">
                  <Sparkles size={12} />
                  تأكيد الحضور
                </div>
                <h1 className="text-base font-black leading-snug text-slate-800 sm:text-lg">
                  حفل تخرج طلاب الصف المتوسط
                </h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-lg px-4 pb-8 safe-pb sm:px-6">
        <section className="animate-fade-in mt-4 space-y-5 rounded-[1.75rem] border border-white/80 bg-white/90 p-5 shadow-xl shadow-slate-200/50 backdrop-blur-sm sm:mt-5 sm:p-6">
          <div className="flex items-start gap-3 rounded-2xl bg-gradient-to-l from-amber-50 to-indigo-50 p-4 border border-amber-100/80">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
              <GraduationCap className="text-amber-600" size={22} />
            </div>
            <div className="space-y-3 text-sm font-bold leading-relaxed text-slate-600">
              <p className="font-black text-slate-800">مرحبًا بكم:</p>
              <p>
                يسرّنا تشريفكم بحضور حفل تخرج طلاب الصف المتوسط صباح الغد بمشيئة الله تعالى، ونتطلع
                لمشاركتكم وإضفاء حضوركم الكريم.
              </p>
              <p className="text-slate-700">نأمل منكم تأكيد الحضور من عدمه.</p>
            </div>
          </div>

          {saveSuccess && (
            <div className="animate-success-pop flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-800">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 size={24} />
              </div>
              <div className="min-w-0">
                <p className="font-black">تم حفظ ردكم بنجاح</p>
                <p className="mt-0.5 text-xs font-bold opacity-80">
                  {RSVP_LABELS[status]} — {formatRsvpDate(new Date().toISOString())}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="guardian-name" className="mb-2.5 block text-sm font-black text-slate-700">
                اسم ولي الأمر
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  id="guardian-name"
                  type="text"
                  autoComplete="name"
                  enterKeyHint="done"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="اكتب اسم ولي الأمر كاملاً"
                  className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 py-4 pr-12 pl-4 font-bold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-3 block text-sm font-black text-slate-700">حالة الحضور</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setStatus(RSVP_STATUS.ATTENDING)}
                  className={`flex min-h-[5.5rem] flex-col items-center justify-center gap-2.5 rounded-2xl border-2 p-4 transition-all active:scale-[0.98] ${
                    status === RSVP_STATUS.ATTENDING
                      ? 'border-emerald-500 bg-gradient-to-b from-emerald-50 to-white shadow-lg shadow-emerald-100 ring-2 ring-emerald-200'
                      : 'border-slate-100 bg-slate-50 hover:border-emerald-200 hover:bg-emerald-50/40'
                  }`}
                >
                  <CheckCircle2
                    size={32}
                    strokeWidth={2.25}
                    className={status === RSVP_STATUS.ATTENDING ? 'text-emerald-600' : 'text-slate-300'}
                  />
                  <span className="font-black text-base text-slate-800">سأحضر</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatus(RSVP_STATUS.APOLOGIZED)}
                  className={`flex min-h-[5.5rem] flex-col items-center justify-center gap-2.5 rounded-2xl border-2 p-4 transition-all active:scale-[0.98] ${
                    status === RSVP_STATUS.APOLOGIZED
                      ? 'border-rose-500 bg-gradient-to-b from-rose-50 to-white shadow-lg shadow-rose-100 ring-2 ring-rose-200'
                      : 'border-slate-100 bg-slate-50 hover:border-rose-200 hover:bg-rose-50/40'
                  }`}
                >
                  <XCircle
                    size={32}
                    strokeWidth={2.25}
                    className={status === RSVP_STATUS.APOLOGIZED ? 'text-rose-600' : 'text-slate-300'}
                  />
                  <span className="font-black text-base text-slate-800">أعتذر عن الحضور</span>
                </button>
              </div>
            </div>

            {saveError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-3 text-sm font-bold text-red-600">
                <AlertCircle size={18} className="shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="flex w-full min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-amber-500 via-amber-500 to-orange-500 py-4 text-base font-black text-white shadow-lg shadow-amber-300/50 transition-all active:scale-[0.98] hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 disabled:active:scale-100"
            >
              {saving ? <Loader2 className="animate-spin" size={22} /> : null}
              {saving ? 'جاري الحفظ...' : 'تأكيد الرد'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
