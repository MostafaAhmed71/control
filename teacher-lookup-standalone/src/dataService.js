import { createClient } from '@supabase/supabase-js';

const defaultWaBase = (
  import.meta.env.VITE_WHATSAPP_API_BASE ||
  import.meta.env.PROD && 'https://control0.northelite0.com/api/whatsapp'
  || 'http://127.0.0.1:3001'
).replace(/\/$/, '');

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

const mapRow = (row) => ({
  id: row.id,
  ...(typeof row.data === 'object' && row.data !== null ? row.data : row),
});

async function fetchTable(table, { label = table, retries = 3 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    const { data, error } = await supabase.from(table).select('*').range(0, 1999);
    if (!error) return (data || []).map(mapRow);
    lastError = error;
    if (!isTransient(error.message) || attempt >= retries - 1) {
      throw new Error(lastError.message || `فشل جلب ${label}`);
    }
    await sleep(400 * (attempt + 1));
  }
  throw new Error(lastError?.message || `فشل جلب ${label}`);
}

export const getStudents = () => fetchTable('students', { label: 'الطلاب' });
export const getCommittees = () => fetchTable('committees', { label: 'اللجان' });
export const getLocations = () => fetchTable('locations', { label: 'مواقع اللجان' });

export function resolveWhatsAppApiBase(appConfig) {
  const fromEnv = import.meta.env.VITE_WHATSAPP_API_BASE?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const fromSettings = appConfig?.whatsappApiBase?.trim();
  if (fromSettings) return fromSettings.replace(/\/$/, '');
  return defaultWaBase;
}

export async function getWhatsAppApiBase() {
  try {
    const cfg = await getAppSettings();
    return resolveWhatsAppApiBase(cfg);
  } catch {
    return resolveWhatsAppApiBase(null);
  }
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
