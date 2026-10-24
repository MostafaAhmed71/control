import { createClient } from '@supabase/supabase-js';
import { normalizeNamePart } from './studentNameSearch';
import { RSVP_STATUS } from './graduationUtils';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const GRADUATION_RSVPS_ID = 'graduation_rsvps';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isTransient = (msg) => {
  const m = String(msg || '').toLowerCase();
  return (
    m.includes('timeout') ||
    m.includes('failed to fetch') ||
    m.includes('network') ||
    m.includes('load failed')
  );
};

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const guardianName = String(entry.guardianName || '').trim();
  const status = entry.status;
  if (!guardianName) return null;
  if (status !== RSVP_STATUS.ATTENDING && status !== RSVP_STATUS.APOLOGIZED) return null;
  return {
    id: String(entry.id || crypto.randomUUID()),
    guardianName,
    status,
    updatedAt: entry.updatedAt || null,
  };
}

export async function getAppSettings() {
  const fallback = {
    schoolName: import.meta.env.VITE_SCHOOL_NAME || 'نظام الكنترول',
    platformName: import.meta.env.VITE_SCHOOL_NAME || 'نظام الكنترول',
  };
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'app_config')
      .maybeSingle();
    if (error || !data?.data) return fallback;
    return { ...fallback, ...data.data };
  } catch {
    return fallback;
  }
}

export function getAdminPassword(config) {
  return (
    import.meta.env.VITE_GRADUATION_ADMIN_PASSWORD?.trim() ||
    config?.graduationAdminPassword?.trim() ||
    'mn14121980'
  );
}

export async function getGuardianRsvps() {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from('settings')
      .select('data')
      .eq('id', GRADUATION_RSVPS_ID)
      .maybeSingle();

    if (!error) {
      const entries = (data?.data?.entries || [])
        .map(normalizeEntry)
        .filter(Boolean);
      return entries.sort((a, b) =>
        a.guardianName.localeCompare(b.guardianName, 'ar', { numeric: true })
      );
    }

    lastError = error;
    if (!isTransient(error.message) || attempt >= 2) {
      throw new Error(lastError.message || 'فشل جلب الردود');
    }
    await sleep(400 * (attempt + 1));
  }
  throw new Error(lastError?.message || 'فشل جلب الردود');
}

export async function saveGuardianRsvp({ guardianName, status }) {
  const name = String(guardianName || '').trim();
  if (!name) throw new Error('يرجى إدخال اسم ولي الأمر.');
  if (status !== RSVP_STATUS.ATTENDING && status !== RSVP_STATUS.APOLOGIZED) {
    throw new Error('يرجى اختيار الحضور أو الاعتذار.');
  }

  const key = normalizeNamePart(name);
  const { data, error: fetchError } = await supabase
    .from('settings')
    .select('data')
    .eq('id', GRADUATION_RSVPS_ID)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message || 'فشل حفظ الرد');

  const entries = (data?.data?.entries || [])
    .map(normalizeEntry)
    .filter(Boolean);

  const now = new Date().toISOString();
  const idx = entries.findIndex((e) => normalizeNamePart(e.guardianName) === key);
  const record = {
    id: idx >= 0 ? entries[idx].id : crypto.randomUUID(),
    guardianName: name,
    status,
    updatedAt: now,
  };

  if (idx >= 0) entries[idx] = record;
  else entries.push(record);

  const { error } = await supabase.from('settings').upsert({
    id: GRADUATION_RSVPS_ID,
    data: { entries },
  });

  if (error) throw new Error(error.message || 'فشل حفظ الرد');
  return record;
}

export async function deleteGuardianRsvp(id) {
  const targetId = String(id || '').trim();
  if (!targetId) throw new Error('معرّف الرد غير صالح.');

  const { data, error: fetchError } = await supabase
    .from('settings')
    .select('data')
    .eq('id', GRADUATION_RSVPS_ID)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message || 'فشل حذف الرد');

  const entries = (data?.data?.entries || [])
    .map(normalizeEntry)
    .filter(Boolean);

  const next = entries.filter((e) => e.id !== targetId);
  if (next.length === entries.length) throw new Error('لم يُعثر على الرد.');

  const { error } = await supabase.from('settings').upsert({
    id: GRADUATION_RSVPS_ID,
    data: { entries: next },
  });

  if (error) throw new Error(error.message || 'فشل حذف الرد');
}
