import React, { useEffect, useMemo, useState } from 'react';
import SchoolLogo from './SchoolLogo';
import {
  Search,
  RefreshCw,
  LogOut,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Download,
  Trash2,
} from 'lucide-react';
import { getGuardianRsvps, getAppSettings, getAdminPassword, deleteGuardianRsvp } from './dataService';
import { RSVP_LABELS, formatRsvpDate, RSVP_STATUS } from './graduationUtils';

const PASS_KEY = 'graduation_admin_passed';

const FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'attending', label: 'سيحضر' },
  { id: 'apologized', label: 'معتذر' },
];

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-2xl font-black text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function RsvpCard({ r, index, deletingId, onDelete }) {
  const isAttending = r.status === RSVP_STATUS.ATTENDING;
  const badgeClass = isAttending ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';

  return (
    <article className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-slate-400">#{index + 1}</p>
          <h3 className="mt-0.5 truncate font-black text-slate-800">{r.guardianName}</h3>
          <p className="mt-2 text-xs font-bold text-slate-500">
            {r.updatedAt ? formatRsvpDate(r.updatedAt) : '—'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className={`inline-block rounded-lg px-3 py-1 text-xs font-black ${badgeClass}`}>
            {RSVP_LABELS[r.status]}
          </span>
          <button
            type="button"
            onClick={() => onDelete(r)}
            disabled={deletingId === r.id}
            className="inline-flex min-h-[2.5rem] min-w-[2.5rem] items-center justify-center rounded-xl border border-red-100 bg-white text-red-600 transition-colors active:scale-95 hover:bg-red-50 disabled:opacity-50"
            title="حذف"
          >
            {deletingId === r.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(PASS_KEY) === '1');
  const [pwd, setPwd] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [config, setConfig] = useState(null);

  const [rsvps, setRsvps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    getAppSettings().then(setConfig);
  }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setRsvps(await getGuardianRsvps());
    } catch {
      setError('تعذّر تحميل الردود.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authed) load();
  }, [authed]);

  const handleLogin = (e) => {
    e.preventDefault();
    const adminPass = getAdminPassword(config);
    if (pwd === adminPass) {
      sessionStorage.setItem(PASS_KEY, '1');
      setAuthed(true);
      setPwdErr('');
    } else {
      setPwdErr('كلمة المرور غير صحيحة.');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(PASS_KEY);
    setAuthed(false);
  };

  const stats = useMemo(() => {
    let attending = 0;
    let apologized = 0;
    for (const r of rsvps) {
      if (r.status === RSVP_STATUS.ATTENDING) attending += 1;
      else if (r.status === RSVP_STATUS.APOLOGIZED) apologized += 1;
    }
    return { total: rsvps.length, attending, apologized };
  }, [rsvps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rsvps
      .filter((r) => {
        if (filter !== 'all' && r.status !== filter) return false;
        if (!q) return true;
        return r.guardianName.toLowerCase().includes(q);
      })
      .sort((a, b) =>
        (b.updatedAt || '').localeCompare(a.updatedAt || '') ||
        a.guardianName.localeCompare(b.guardianName, 'ar', { numeric: true })
      );
  }, [rsvps, filter, search]);

  const exportCsv = () => {
    const header = ['ولي الأمر', 'الحالة', 'آخر تحديث'];
    const rows = filtered.map((r) => [
      r.guardianName || '',
      RSVP_LABELS[r.status] || '',
      r.updatedAt ? formatRsvpDate(r.updatedAt) : '',
    ]);
    const bom = '\uFEFF';
    const csv = bom + [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `graduation-rsvp-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (r) => {
    const ok = window.confirm(`هل تريد حذف رد "${r.guardianName}"؟`);
    if (!ok) return;

    setDeletingId(r.id);
    setError('');
    try {
      await deleteGuardianRsvp(r.id);
      setRsvps((prev) => prev.filter((item) => item.id !== r.id));
    } catch (err) {
      setError(err.message || 'تعذّر حذف الرد.');
    } finally {
      setDeletingId(null);
    }
  };

  const schoolLabel = config?.schoolName || config?.platformName || 'المدرسة';

  if (!authed) {
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden p-4 safe-pt safe-pb" dir="rtl">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950" />
        <div className="pointer-events-none absolute -top-20 right-0 h-56 w-56 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />

        <form
          onSubmit={handleLogin}
          className="relative z-10 w-full max-w-sm animate-fade-in-up space-y-5 rounded-[1.75rem] border border-white/10 bg-white p-6 shadow-2xl sm:p-7"
        >
          <div className="text-center">
            <SchoolLogo size="xl" className="mx-auto mb-4 drop-shadow-md" />
            <h1 className="text-xl font-black text-slate-800">لوحة المدير</h1>
            <p className="mt-2 text-xs font-bold leading-relaxed text-slate-500">
              حفل تخرج طلاب الصف الثالث المتوسط
            </p>
          </div>
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="كلمة المرور"
            className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-4 font-bold outline-none transition-all focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
          />
          {pwdErr && <p className="text-center text-sm font-bold text-red-600">{pwdErr}</p>}
          <button
            type="submit"
            className="w-full min-h-[3.25rem] rounded-2xl bg-gradient-to-l from-amber-500 to-orange-500 py-3.5 font-black text-white shadow-lg shadow-amber-200 transition-all active:scale-[0.98] hover:from-amber-600 hover:to-orange-600"
          >
            دخول
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-100 to-slate-50 font-sans text-slate-900 safe-pt" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <SchoolLogo size="sm" />
            <div className="min-w-0">
              <h1 className="truncate font-black text-slate-800">متابعة حفل التخرج</h1>
              <p className="truncate text-xs font-bold text-slate-400">{schoolLabel}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors active:scale-95 hover:bg-slate-50"
              title="تحديث"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded-xl border border-slate-200 bg-white text-red-600 transition-colors active:scale-95 hover:bg-red-50"
              title="خروج"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4 safe-pb sm:space-y-5 sm:px-6 sm:py-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard icon={Users} label="إجمالي الردود" value={stats.total} color="bg-slate-100 text-slate-600" />
          <StatCard icon={CheckCircle2} label="سيحضر" value={stats.attending} color="bg-emerald-100 text-emerald-600" />
          <StatCard icon={XCircle} label="معتذر" value={stats.apologized} color="bg-rose-100 text-rose-600" />
        </div>

        <div className="space-y-4 rounded-[1.25rem] border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث باسم ولي الأمر..."
                className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 py-3 pr-10 pl-4 text-base font-bold outline-none transition-all focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100 sm:max-w-md"
              />
            </div>
            <button
              type="button"
              onClick={exportCsv}
              className="flex min-h-[3rem] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition-colors active:scale-[0.98] hover:bg-slate-50"
            >
              <Download size={16} />
              تصدير Excel
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-black transition-colors ${
                  filter === f.id
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
              <AlertCircle size={18} className="shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16 text-slate-400">
              <Loader2 className="animate-spin" size={32} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
              <p className="font-black text-slate-400">لا توجد نتائج</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filtered.map((r, i) => (
                  <RsvpCard
                    key={r.id}
                    r={r}
                    index={i}
                    deletingId={deletingId}
                    onDelete={handleDelete}
                  />
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400">
                      <th className="px-4 py-3 text-right font-black">#</th>
                      <th className="px-4 py-3 text-right font-black">ولي الأمر</th>
                      <th className="px-4 py-3 text-right font-black">الحالة</th>
                      <th className="px-4 py-3 text-right font-black">آخر تحديث</th>
                      <th className="w-20 px-4 py-3 text-center font-black">حذف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => {
                      const badgeClass =
                        r.status === RSVP_STATUS.ATTENDING
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700';
                      return (
                        <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-bold text-slate-400">{i + 1}</td>
                          <td className="px-4 py-3 font-black text-slate-800">{r.guardianName}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-lg px-3 py-1 text-xs font-black ${badgeClass}`}>
                              {RSVP_LABELS[r.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-slate-500">
                            {r.updatedAt ? formatRsvpDate(r.updatedAt) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDelete(r)}
                              disabled={deletingId === r.id}
                              className="inline-flex min-h-[2.5rem] min-w-[2.5rem] items-center justify-center rounded-lg border border-red-100 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                              title="حذف"
                            >
                              {deletingId === r.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <p className="pt-1 text-center text-xs font-bold text-slate-400">
            عرض {filtered.length} من {rsvps.length} رد
          </p>
        </div>
      </main>
    </div>
  );
}
