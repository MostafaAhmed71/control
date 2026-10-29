import { createClient } from '@supabase/supabase-js';
import { fetchOmrResultPages } from './omrResultPaging.js';
import { normalizeCoverConfig } from './coverTemplates.js';
import { normalizeObserverSheetsConfig } from './observerSheetTemplates.js';
import {
    enrichOmrResultForSave,
    getStudentNationalId,
    getStudentSeatNumber,
    normalizeStudentId,
} from './studentIdentity.js';

const OMR_PORTAL_NORM_COLUMNS = [
    'portal_national_norm',
    'portal_student_id_norm',
    'portal_detected_id_norm',
    'portal_norm_detected_id_norm',
];

/** أعمدة Postgres مولَّدة أو metadata — يُحذفها من jsonb `data` قبل upsert */
const STRIP_FROM_JSONB_PAYLOAD = new Set([
    'created_at',
    'updated_at',
    'portal_national_norm',
    'portal_seat_norm',
    'portal_student_id_norm',
    'portal_detected_id_norm',
    'portal_norm_detected_id_norm',
]);

const toJsonbPayload = (item) => {
    if (!item || typeof item !== 'object') return {};
    const payload = { ...item };
    for (const k of STRIP_FROM_JSONB_PAYLOAD) {
        delete payload[k];
    }
    return payload;
};

// --- API Endpoints (Local services) ---
// Browser/Vite dev: relative proxy paths. Packaged Electron: direct localhost (no reverse proxy).
// Override via VITE_OMR_API_BASE / VITE_WHATSAPP_API_BASE at build time if needed.
const isElectron =
    typeof window !== 'undefined' &&
    typeof window.electronAPI !== 'undefined';
const defaultOmrBase = isElectron ? 'http://127.0.0.1:8000' : '/api/omr';
const defaultWaBase = isElectron ? 'http://127.0.0.1:3001' : '/api/whatsapp';

export const OMR_API_BASE = (import.meta.env.VITE_OMR_API_BASE || defaultOmrBase).replace(/\/$/, '');
export const WHATSAPP_API_BASE = (import.meta.env.VITE_WHATSAPP_API_BASE || defaultWaBase).replace(
    /\/$/,
    ''
);

const DATA_BACKEND_KEY = 'elite_data_backend';

/** hybrid = مكتب محلي + سحابة خفيفة للبوابة والمعلمين. local = جهاز فقط. supabase = سحابة كاملة */
export const getDataBackend = () => {
    try {
        const stored = localStorage.getItem(DATA_BACKEND_KEY);
        if (stored === 'local' || stored === 'supabase' || stored === 'hybrid') return stored;
    } catch { /* ignore */ }
    const env = String(import.meta.env.VITE_DATA_BACKEND || 'hybrid').toLowerCase();
    if (env === 'local' || env === 'supabase') return env;
    return 'hybrid';
};

export const setDataBackend = (mode) => {
    const next = mode === 'supabase' || mode === 'local' ? mode : 'hybrid';
    try { localStorage.setItem(DATA_BACKEND_KEY, next); } catch { /* ignore */ }
    return next;
};

const usesLocalStore = () => {
    const b = getDataBackend();
    return b === 'local' || b === 'hybrid';
};

const usesCloudSync = () => {
    const b = getDataBackend();
    return b === 'hybrid' || b === 'supabase';
};

const localApi = (path) => `${OMR_API_BASE}${path}`;

const localRequest = async (path, opts = {}) => {
    const res = await fetch(localApi(path), opts);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        const msg = err.detail || err.message || res.statusText;
        _setConnected(false);
        throw new SupabaseError('local', opts.method || 'GET', String(msg));
    }
    _setConnected(true);
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    return ct.includes('json') ? res.json() : res;
};

const hydrateLocalRow = (row) => {
    if (!row || typeof row !== 'object') return row;
    if (row.hasSheetImage && !String(row.systemViewImage || '').startsWith('data:')) {
        return {
            ...row,
            systemViewImage: `${OMR_API_BASE}/store/sheets/${encodeURIComponent(row.id)}`,
        };
    }
    return row;
};

export const getLocalStoreStatus = () => localRequest('/store/status');

export const importLocalDump = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return localRequest('/store/import', { method: 'POST', body: fd });
};

const CLOUD_IMAGE_KEYS = [
    'reviewRois',
    'systemViewImage',
    'systemViewImageThumb',
    'sheetImage',
    'scanImage',
    'originalImage',
    'hasSheetImage',
    'systemViewImagePath',
];

const slimForCloud = (tableName, item) => {
    const payload = toJsonbPayload(item);
    if (tableName === 'omr_results') {
        for (const key of CLOUD_IMAGE_KEYS) delete payload[key];
    }
    return payload;
};

const upsertCloudRow = async (tableName, item) => {
    if (!supabase) throw new SupabaseError(tableName, 'cloud-sync', 'مفاتيح السحابة غير موجودة');
    const rowId = String(item.id);
    const { error } = await supabase
        .from(tableName)
        .upsert({ id: rowId, data: slimForCloud(tableName, item) });
    if (error) throw new SupabaseError(tableName, 'cloud-sync', error.message);
};

const syncLocalSaveToCloud = async (tableName, item) => {
    if (getDataBackend() !== 'hybrid' || !supabase) return;
    try {
        await upsertCloudRow(tableName, item);
    } catch (e) {
        console.warn(`[hybrid] تعذّر نشر ${tableName}/${item?.id} للسحابة:`, e?.message || e);
    }
};

const syncLocalListToCloud = async (tableName, items, onProgress) => {
    if (getDataBackend() !== 'hybrid' || !supabase) return;
    const list = Array.isArray(items) ? items : [];
    const CHUNK = 80;
    for (let i = 0; i < list.length; i += CHUNK) {
        const chunk = list.slice(i, i + CHUNK);
        const rows = chunk.map((item) => ({
            id: String(item.id),
            data: slimForCloud(tableName, item),
        }));
        const { error } = await supabase.from(tableName).upsert(rows);
        if (error) {
            console.warn(`[hybrid] تعذّر نشر دفعة ${tableName}:`, error.message);
        }
        if (onProgress) {
            await onProgress({
                current: Math.min(i + chunk.length, list.length),
                total: list.length,
            });
        }
    }
};

const BROKEN_WHATSAPP_BASES = new Set([
    'https://wpp.northelite0.com',
    'http://wpp.northelite0.com',
]);

const normalizeWhatsAppApiBase = (value) => {
    const wa = String(value || '').trim().replace(/\/$/, '');
    if (!wa || BROKEN_WHATSAPP_BASES.has(wa)) return '';
    return wa;
};

/** عنوان WhatsApp الفعلي: إعدادات التطبيق ← متغير البناء ← افتراضي محلي/بروكسي */
export function resolveWhatsAppApiBase(appConfig) {
    const fromSettings = normalizeWhatsAppApiBase(appConfig?.whatsappApiBase);
    if (fromSettings) return fromSettings;
    const fromEnv = normalizeWhatsAppApiBase(import.meta.env.VITE_WHATSAPP_API_BASE);
    if (fromEnv) return fromEnv;
    return normalizeWhatsAppApiBase(WHATSAPP_API_BASE) || defaultWaBase;
}

export async function getWhatsAppApiBase() {
    try {
        const cfg = await getAppSettings();
        return resolveWhatsAppApiBase(cfg);
    } catch {
        return resolveWhatsAppApiBase(null);
    }
}

// --- Supabase Configuration ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('مفاتيح Supabase غير موجودة. سيتم استخدام القاعدة المحلية.');
}

export const supabase = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// --- Connection state (subscribable) ---
let _connectionListeners = [];
let _isConnected = true;

export const subscribeToConnection = (fn) => {
    _connectionListeners.push(fn);
    return () => { _connectionListeners = _connectionListeners.filter(f => f !== fn); };
};

const _setConnected = (state) => {
    if (_isConnected === state) return;
    _isConnected = state;
    _connectionListeners.forEach(fn => fn(state));
};

// --- Error class ---
export class SupabaseError extends Error {
    constructor(table, operation, originalMessage) {
        super(`[${table}/${operation}]: ${originalMessage}`);
        this.table = table;
        this.operation = operation;
        this.originalMessage = originalMessage;
    }
}

// --- Generic Helpers ---
// نُبقي على systemViewImage (صورة مدمجة بصيغة JPEG q65) لتمكين عرض الورقة في
// «كشف المعتمدين». ونحذف reviewRois لأنّها قطع base64 ضخمة لكل سؤال على حدة.
const slimOmrResult = (item) => {
    if (!item || typeof item !== 'object') return item;
    const { reviewRois: _b, ...rest } = item;
    return rest;
};

/** للرصد: بدون صور الورقة لتقليل حجم الجلب وتجنّب انقطاع QUIC على آلاف السجلات */
const slimOmrResultForGrading = (item) => {
    if (!item || typeof item !== 'object') return item;
    const {
        reviewRois: _a,
        systemViewImage: _b,
        systemViewImageThumb: _c,
        sheetImage: _d,
        scanImage: _e,
        originalImage: _f,
        ...rest
    } = item;
    return rest;
};

// --- Core CRUD helpers (Supabase only, throws on error) ---

const mapDataRow = (row) => ({
    id: row.id,
    ...(typeof row.data === 'object' && row.data !== null ? row.data : {}),
});

/** أعمدة الجلب لتجنّب SELECT * على omr_results (PostgREST يولّد استعلاماً ثقيلاً ومهلة 57014 على الجداول الكبيرة). */
const collectionSelect = (tableName) => (tableName === 'omr_results' ? 'id, data' : '*');

const fetchCollection = async (tableName) => {
    if (usesLocalStore()) {
        const rows = await localRequest(`/store/${tableName}`);
        return (rows || []).map(hydrateLocalRow);
    }
    const { data, error } = await supabase
        .from(tableName)
        .select(collectionSelect(tableName))
        .range(0, 1999); // Safety cap: max 2000 records per fetch

    if (error) {
        _setConnected(false);
        throw new SupabaseError(tableName, 'fetch', error.message);
    }

    _setConnected(true);
    return (data || []).map(mapDataRow);
};

/** استعلامات أقصر لتجنّب statement timeout على جداول فيها JSONB كبير (مثل صور الورقة). */
const isTimeoutLike = (msg) => {
    const m = String(msg || '').toLowerCase();
    return m.includes('timeout') || m.includes('canceling statement');
};

const isRetryableFetchError = (msg) => {
    const m = String(msg || '').toLowerCase();
    return (
        isTimeoutLike(m) ||
        m.includes('failed to fetch') ||
        m.includes('network') ||
        m.includes('quic') ||
        m.includes('aborted') ||
        m.includes('load failed') ||
        m.includes('connection')
    );
};

/** Supabase Fair Use / تجاوز الحصة (402) */
export const isSupabaseQuotaError = (error) => {
    if (!error) return false;
    const status = error.status ?? error.statusCode;
    if (status === 402) return true;
    const m = String(error.message || error.originalMessage || error).toLowerCase();
    return m.includes('402') || m.includes('quota') || m.includes('egress') || m.includes('fair use');
};

const GRADING_CACHE_KEY = 'elite_omr_grading_cache_v1';
const GRADING_CACHE_TTL_MS = 20 * 60 * 1000;

const readGradingCache = () => {
    try {
        const raw = localStorage.getItem(GRADING_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.at || !Array.isArray(parsed.rows)) return null;
        if (Date.now() - parsed.at > GRADING_CACHE_TTL_MS) {
            localStorage.removeItem(GRADING_CACHE_KEY);
            return null;
        }
        const rows = parsed.rows;
        if (parsed.partial) rows._partialFetch = true;
        return rows;
    } catch {
        return null;
    }
};

const writeGradingCache = (rows) => {
    try {
        localStorage.setItem(
            GRADING_CACHE_KEY,
            JSON.stringify({
                at: Date.now(),
                partial: Boolean(rows?._partialFetch),
                rows: [...rows],
            })
        );
    } catch {
        /* private mode / quota */
    }
};

export const invalidateOmrGradingCache = () => {
    try {
        localStorage.removeItem(GRADING_CACHE_KEY);
    } catch {
        /* ignore */
    }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const mapPagedRow = (row, tableName, opts) => {
    const item = mapDataRow(row);
    if (opts.slim === 'grading' && tableName === 'omr_results') return slimOmrResultForGrading(item);
    if (opts.slim && tableName === 'omr_results') return slimOmrResult(item);
    return item;
};

/**
 * جلب الجدول على دفعات (range). يقلّل حجم كل استعلام ويُجنّب انتهاء مهلة السيرفر.
 * @param {string} tableName
 * @param {{ pageSize?: number, maxRows?: number }} [opts]
 */
const fetchCollectionPaged = async (tableName, opts = {}) => {
    if (usesLocalStore()) {
        const rows = await localRequest(`/store/${tableName}`);
        const mapped = (rows || []).map((row) => mapPagedRow({ id: row.id, data: row }, tableName, opts));
        return mapped.map(hydrateLocalRow);
    }
    if (tableName === 'omr_results') {
        try {
            const rows = await fetchOmrResultPages(supabase, {
                ...opts,
                pageSize: Math.min(opts.pageSize ?? 10, 10),
                mapRow: (row) => mapPagedRow(row, tableName, opts),
            });
            _setConnected(true);
            return rows;
        } catch (error) {
            _setConnected(false);
            throw new SupabaseError(tableName, 'fetch', error.message);
        }
    }
    const pageSize = Math.max(10, Math.min(opts.pageSize ?? 80, 500));
    const maxRows = Math.max(pageSize, Math.min(opts.maxRows ?? 20000, 100000));
    const partialOnError = opts.partialOnError === true;
    const maxAttempts = Math.max(3, Math.min(opts.maxAttempts ?? 5, 8));
    const all = [];
    let from = 0;

    while (from < maxRows) {
        const to = from + pageSize - 1;
        let lastErr = null;
        let chunkLoaded = false;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            let req = supabase.from(tableName).select(collectionSelect(tableName)).order('id', { ascending: true });
            if (tableName === 'omr_results') {
                req = req.order('id', { ascending: true });
            }
            const { data, error } = await req.range(from, to);

            if (!error) {
                const chunk = (data || []).map((row) => mapPagedRow(row, tableName, opts));
                all.push(...chunk);
                chunkLoaded = true;
                if (!data || data.length < pageSize) {
                    _setConnected(true);
                    return all;
                }
                from += pageSize;
                if (tableName === 'omr_results') {
                    await sleep(opts.pageDelayMs ?? 120);
                }
                break;
            }

            lastErr = error;
            if (isSupabaseQuotaError(error)) {
                _setConnected(false);
                throw new SupabaseError(tableName, 'fetch', error.message);
            }
            if (attempt < maxAttempts - 1 && isRetryableFetchError(error.message)) {
                await sleep(600 * (attempt + 1));
                continue;
            }
            break;
        }

        if (chunkLoaded) continue;

        const errMsg = lastErr?.message || 'Failed to fetch';
        if (isSupabaseQuotaError(lastErr)) {
            _setConnected(false);
            throw new SupabaseError(tableName, 'fetch', errMsg);
        }
        if (partialOnError && all.length > 0) {
            console.warn(
                `[${tableName}] partial fetch stopped at offset ${from}: ${errMsg} — returning ${all.length} rows`
            );
            all._partialFetch = true;
            _setConnected(true);
            return all;
        }

        _setConnected(false);
        throw new SupabaseError(tableName, 'fetch', errMsg);
    }

    _setConnected(true);
    return all;
};

const saveDocument = async (tableName, item) => {
    const docData = { ...item };
    if (!docData.id) {
        docData.id = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    }

    const persisted =
        tableName === 'omr_results'
            ? slimOmrResult(enrichOmrResultForSave(docData))
            : docData;

    const rowId = String(persisted.id);
    if (usesLocalStore()) {
        const saved = await localRequest(`/store/${tableName}/${encodeURIComponent(rowId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toJsonbPayload(persisted)),
        });
        const merged = hydrateLocalRow({ ...persisted, ...(saved || {}), id: rowId });
        await syncLocalSaveToCloud(tableName, merged);
        return merged;
    }
    const payload = { id: rowId, data: slimForCloud(tableName, persisted) };
    let error = null;
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            ({ error } = await supabase.from(tableName).upsert(payload));
        } catch (e) {
            error = { message: e?.message || String(e) };
        }
        if (!error || !isRetryableFetchError(error.message)) break;
        await sleep(1000 * (attempt + 1));
    }

    if (error) {
        _setConnected(false);
        throw new SupabaseError(tableName, 'save', error.message);
    }

    _setConnected(true);
    return persisted;
};

const deleteDocument = async (tableName, id) => {
    if (usesLocalStore()) {
        await localRequest(`/store/${tableName}/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (getDataBackend() === 'hybrid' && supabase) {
            await supabase.from(tableName).delete().eq('id', String(id));
        }
        return;
    }
    const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', String(id));

    if (error) {
        _setConnected(false);
        throw new SupabaseError(tableName, 'delete', error.message);
    }

    _setConnected(true);
};

// --- API Methods ---

export const getCommittees   = () => fetchCollection('committees');
export const saveCommittee   = (c) => saveDocument('committees', c);
export const deleteCommittee = (id) => deleteDocument('committees', id);

export const getObservers    = () => fetchCollection('observers');
export const saveObserver    = (o) => saveDocument('observers', o);
export const deleteObserver  = (id) => deleteDocument('observers', id);

export const getLocations    = () => fetchCollection('locations');
export const saveLocation    = (l) => saveDocument('locations', l);
export const deleteLocation  = (id) => deleteDocument('locations', id);

export const getStudents = () => fetchCollectionPaged('students', { pageSize: 500, maxRows: 100000 });

/** يحدّث نتائج OMR المرتبطة بالهوية القديمة أو برقم الجلوس عند تغيير هوية الطالب. */
export const syncOmrResultsForStudentNationalIdChange = async ({
    previousNationalId,
    nextNationalId,
    seatNumber,
}) => {
    const oldNat = normalizeStudentId(previousNationalId);
    const newNat = normalizeStudentId(nextNationalId);
    if (!newNat) return { updated: 0, scanned: 0 };

    if (usesLocalStore()) {
        const rows = await localRequest('/store/omr_results');
        let updated = 0;
        for (const row of rows || []) {
            const nat = normalizeStudentId(row.nationalId || row.studentId || '');
            const seat = normalizeStudentId(row.seatNumber || '');
            if (nat !== oldNat && seat !== normalizeStudentId(seatNumber)) continue;
            await saveDocument('omr_results', { ...row, nationalId: nextNationalId, studentId: nextNationalId });
            updated += 1;
        }
        return { updated, scanned: (rows || []).length };
    }

    const seatNorm = normalizeStudentId(seatNumber);
    const norms = [...new Set([oldNat, seatNorm].filter(Boolean))];
    const seen = new Set();
    let scanned = 0;
    let updated = 0;

    for (const norm of norms) {
        for (const col of OMR_PORTAL_NORM_COLUMNS) {
            const { data, error } = await supabase
                .from('omr_results')
                .select('id, data')
                .eq(col, norm)
                .limit(500);

            if (error) {
                const em = String(error.message || '');
                if (error.code !== '42703' && !em.includes('portal_')) {
                    console.warn('[syncOmrResults] فهرس', col, error.message || error);
                }
                continue;
            }

            for (const row of data || []) {
                const rid = row?.id != null ? String(row.id) : '';
                if (!rid || seen.has(rid)) continue;
                seen.add(rid);
                scanned++;

                const d = row.data && typeof row.data === 'object' ? row.data : {};
                const patch = enrichOmrResultForSave({
                    ...d,
                    id: rid,
                    nationalId: newNat,
                });
                const prevNat = normalizeStudentId(d.nationalId || d.national_id);
                const prevSid = normalizeStudentId(d.studentId);
                if (prevNat === newNat && prevSid === newNat) continue;

                await saveOmrResult(patch);
                updated++;
            }
        }
    }

    return { updated, scanned };
};

export const saveStudent = async (s) => {
    let previousNationalId = '';
    let previousSeat = '';

    if (s?.id) {
        const { data } = await supabase
            .from('students')
            .select('id, data')
            .eq('id', String(s.id))
            .maybeSingle();
        if (data?.data && typeof data.data === 'object') {
            previousNationalId = getStudentNationalId(data.data);
            previousSeat = getStudentSeatNumber(data.data);
        }
    }

    const saved = await saveDocument('students', s);
    const newNat = getStudentNationalId(saved);
    const newSeat = getStudentSeatNumber(saved) || previousSeat;
    const oldNorm = normalizeStudentId(previousNationalId);
    const newNorm = normalizeStudentId(newNat);

    if (newNorm && oldNorm && oldNorm !== newNorm) {
        try {
            const { updated } = await syncOmrResultsForStudentNationalIdChange({
                previousNationalId,
                nextNationalId: newNat,
                seatNumber: newSeat,
            });
            if (updated > 0) {
                console.info(
                    `[saveStudent] تم تحديث هوية ${updated} نتيجة OMR بعد تغيير الهوية (${oldNorm} → ${newNorm}).`
                );
            }
        } catch (e) {
            console.error('[saveStudent] فشل مزامنة نتائج OMR:', e);
        }
    }

    return saved;
};

export const deleteStudent   = (id) => deleteDocument('students', id);

/** حذف مجموعة طلاب بالمعرّف دون المساس ببقية السجل */
export const deleteStudentsByIds = async (ids) => {
    const list = [...new Set((ids || []).map(String).filter(Boolean))];
    if (usesLocalStore()) {
        await localRequest('/store/students/delete-ids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: list }),
        });
        return list.length;
    }
    const CHUNK = 150;
    for (let i = 0; i < list.length; i += CHUNK) {
        const { error } = await supabase.from('students').delete().in('id', list.slice(i, i + CHUNK));
        if (error) {
            _setConnected(false);
            throw new SupabaseError('students', 'bulk-delete', error.message);
        }
    }
    _setConnected(true);
    return list.length;
};

/** تحديث/إضافة مجموعة طلاب دون حذف من ليسوا في القائمة */
export const upsertStudents = async (studentList, onProgress) => {
    const list = (studentList || []).map((s) => ({
        ...s,
        id: String(s.id || `${Date.now()}${Math.floor(Math.random() * 100000)}`),
    }));
    if (usesLocalStore()) {
        await localRequest('/store/students/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: list, replace: false }),
        });
        await syncLocalListToCloud('students', list, onProgress);
        return list.length;
    }
    const CHUNK = 100;
    for (let i = 0; i < list.length; i += CHUNK) {
        const rows = list.slice(i, i + CHUNK).map((s) => ({ id: s.id, data: toJsonbPayload(s) }));
        const { error } = await supabase.from('students').upsert(rows);
        if (error) {
            _setConnected(false);
            throw new SupabaseError('students', 'bulk-upsert', error.message);
        }
        if (onProgress) await onProgress({ current: Math.min(i + CHUNK, list.length), total: list.length });
    }
    _setConnected(true);
    return list.length;
};

export const saveStudentsBulk = async (studentList, onProgress) => {
    const list = Array.isArray(studentList) ? studentList : [];
    const normalized = list.map((s) => ({
        ...s,
        id: String(s.id || `${Date.now()}${Math.floor(Math.random() * 10000)}`),
    }));
    if (usesLocalStore()) {
        await localRequest('/store/students/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: normalized, replace: true }),
        });
        await syncLocalListToCloud('students', normalized, onProgress);
        return normalized;
    }
    const newIds = new Set(normalized.map((s) => String(s.id)));

    const { data: existingRows, error: fetchErr } = await supabase
        .from('students')
        .select('id')
        .range(0, 1999);

    if (fetchErr) {
        _setConnected(false);
        throw new SupabaseError('students', 'bulk-sync-fetch', fetchErr.message);
    }

    const toDelete = (existingRows || [])
        .map((r) => String(r.id))
        .filter((id) => !newIds.has(id));

    const DEL_CHUNK = 150;
    for (let i = 0; i < toDelete.length; i += DEL_CHUNK) {
        const chunk = toDelete.slice(i, i + DEL_CHUNK);
        const { error: delErr } = await supabase.from('students').delete().in('id', chunk);
        if (delErr) {
            _setConnected(false);
            throw new SupabaseError('students', 'bulk-sync-delete', delErr.message);
        }
    }

    const CHUNK = 100;
    for (let i = 0; i < normalized.length; i += CHUNK) {
        const batch = normalized.slice(i, i + CHUNK);
        const rows = batch.map((s) => ({
            id: String(s.id),
            data: toJsonbPayload(s),
        }));
        const { error } = await supabase.from('students').upsert(rows);
        if (error) {
            _setConnected(false);
            throw new SupabaseError('students', 'bulk-save', error.message);
        }
        if (onProgress) {
            await onProgress({ current: Math.min(i + batch.length, normalized.length), total: normalized.length });
        }
    }
    _setConnected(true);
    return normalized;
};

import { normalizeAssignments } from './observerAssignments';

// --- Assignments ---
const localGetSetting = async (id) => {
    const rows = await localRequest('/store/settings');
    return (rows || []).find((r) => String(r.id) === String(id)) || null;
};

const localSaveSetting = async (id, data) => {
    const payload = { id, ...(data && typeof data === 'object' ? data : { value: data }) };
    const saved = await localRequest(`/store/settings/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await syncLocalSaveToCloud('settings', { id, ...payload });
    return saved;
};

export const getAssignments = async () => {
    if (usesLocalStore()) {
        const row = await localGetSetting('assignments');
        if (!row) {
            await localSaveSetting('assignments', {});
            return normalizeAssignments({});
        }
        const { id: _id, ...rest } = row;
        return normalizeAssignments(rest);
    }
    const { data, error } = await supabase
        .from('settings')
        .select('data')
        .eq('id', 'assignments')
        .maybeSingle();

    if (error) {
        _setConnected(false);
        throw new SupabaseError('settings/assignments', 'fetch', error.message);
    }

    _setConnected(true);
    if (!data) {
        await supabase.from('settings').upsert({ id: 'assignments', data: {} });
        return normalizeAssignments({});
    }
    return normalizeAssignments(data.data || {});
};

export const saveAssignments = async (assignments) => {
    if (usesLocalStore()) {
        await localSaveSetting('assignments', assignments || {});
        return assignments;
    }
    const { error } = await supabase
        .from('settings')
        .upsert({ id: 'assignments', data: assignments });

    if (error) {
        _setConnected(false);
        throw new SupabaseError('settings/assignments', 'save', error.message);
    }
    _setConnected(true);
    return assignments;
};

// --- App Settings ---
const DEFAULT_APP_SETTINGS = {
    platformName: 'Elite Control System',
    managerName: 'اسم المدير هنا',
    academicWeight: '2025/2026',
    primaryColor: '#4f46e5',
    examSchedule: {
        dayDates: {
            الأحد: '',
            الاثنين: '',
            الثلاثاء: '',
            الأربعاء: '',
            الخميس: '',
        },
        entries: [],
    },
    attendance: {
        headerSubject: { top: 22.5, right: 10, fontSize: 0.85, show: false, bold: true },
        headerDay: { top: 22.5, right: 24, fontSize: 0.85, show: false, bold: true },
        headerDate: { top: 22.5, right: 36, fontSize: 0.85, show: false, bold: true },
        headerPeriod: { top: 22.5, right: 48, fontSize: 0.85, show: false, bold: true },
        headerCommittee: { top: 22.5, right: 60, fontSize: 0.82, show: true },
        headerGrade: { top: 22.5, right: 55, fontSize: 0.85, show: false },
        headerCount: { top: 22.5, right: 76, fontSize: 0.82, show: true },
        table: {
            startTop: 34.2,
            rowHeight: 2.05,
            fontSize: 0.62,
            indexShow: true,
            indexRight: 6.5,
            indexTop: 0,
            nameShow: true,
            nameRight: 15,
            nameTop: 0,
            nameWidthPct: 38,
            seatShow: true,
            seatRight: 46,
            seatTop: 0,
            gradeShow: true,
            gradeRight: 53,
            gradeTop: 0,
            omrShow: false,
            signatureShow: false,
            signatureRight: 78,
            signatureTop: 0,
            rowOverrides: {},
        },
        maxRows: 25, // ATTENDANCE_PAGE_ROWS — قالب ثابت 25 صف
        sheetMetaPreview: {},
    },
    seating: {
        name:       { top: 20, right: 10, fontSize: 1.2 },
        seatNumber: { top: 40, right: 10, fontSize: 1.5 },
        grade:      { top: 60, right: 10, fontSize: 1.0 },
        committee:  { top: 80, right: 10, fontSize: 1.0 },
    },
    seatCard: {
        name: {
            top: 42,
            left: 11,
            fontSize: 1.05,
            color: '#0f172a',
            textAlign: 'left',
            shrinkToFit: true,
            maxWidthPct: 46,
            minFontSize: 0.88,
        },
        grade:      { top: 52, left: 14, fontSize: 0.95, color: '#0f172a', textAlign: 'left' },
        seatNumber: { top: 62, left: 14, fontSize: 2.2, color: '#2563eb', textAlign: 'left' },
    },
    notifyCard: {
        name: {
            top: 22,
            right: 12,
            fontSize: 1.1,
            color: '#111827',
            textAlign: 'right',
            shrinkToFit: true,
            maxWidthPct: 55,
            minFontSize: 0.85,
        },
        seatNumber: { top: 38, right: 12, fontSize: 1.8, color: '#4f46e5', textAlign: 'right' },
        grade: { top: 52, right: 12, fontSize: 0.95, color: '#1f2937', textAlign: 'right' },
        committee: { top: 66, right: 12, fontSize: 1.05, color: '#065f46', textAlign: 'right' },
    },
    coverLibrary: {
        items: [],
    },
    covers: {},
    observerSheets: {},
    /** فارغ = بروكسي محلي /api/whatsapp أو 127.0.0.1:3001 في Electron */
    whatsappApiBase: '',
    /** رمز المدرسة في نموذج الاختبارات الوطنية (وزارة التعليم) */
    moeSchoolCode: '',
    messages: {
        committee: 'عزيزي ولي أمر الطالب {name}، موعد اختبار ابنكم في لجنة {committee}، رقم الجلوس: {seatNumber}',
        result:    'تم إعلان نتائج {name}. يمكنك الاطلاع عليها عبر البوابة.',
    },
};

function normalizeAppSettings(config = {}) {
    const next = { ...DEFAULT_APP_SETTINGS, ...config };
    next.whatsappApiBase = normalizeWhatsAppApiBase(next.whatsappApiBase);
    return next;
}

export const getAppSettings = async () => {
    if (usesLocalStore()) {
        const row = await localGetSetting('app_config');
        if (!row) {
            const initial = normalizeObserverSheetsConfig(
                normalizeCoverConfig(normalizeAppSettings(DEFAULT_APP_SETTINGS))
            );
            await localSaveSetting('app_config', initial);
            return initial;
        }
        const { id: _id, ...rest } = row;
        return normalizeObserverSheetsConfig(
            normalizeCoverConfig(normalizeAppSettings({ ...DEFAULT_APP_SETTINGS, ...rest }))
        );
    }
    const { data, error } = await supabase
        .from('settings')
        .select('data')
        .eq('id', 'app_config')
        .maybeSingle();

    if (error) {
        _setConnected(false);
        throw new SupabaseError('settings/app_config', 'fetch', error.message);
    }

    _setConnected(true);
    if (!data) {
        const initial = normalizeObserverSheetsConfig(
            normalizeCoverConfig(normalizeAppSettings(DEFAULT_APP_SETTINGS))
        );
        await supabase.from('settings').upsert({ id: 'app_config', data: initial });
        return initial;
    }
    return normalizeObserverSheetsConfig(
        normalizeCoverConfig(normalizeAppSettings({ ...DEFAULT_APP_SETTINGS, ...data.data }))
    );
};

export const saveAppSettings = async (config) => {
    const data = normalizeObserverSheetsConfig(normalizeCoverConfig(normalizeAppSettings(config)));
    if (usesLocalStore()) {
        await localSaveSetting('app_config', data);
        return data;
    }
    const { error } = await supabase
        .from('settings')
        .upsert({ id: 'app_config', data });

    if (error) {
        _setConnected(false);
        throw new SupabaseError('settings/app_config', 'save', error.message);
    }
    _setConnected(true);
    return data;
};

// --- OMR Subjects (persisted in Supabase) ---
const DEFAULT_SUBJECTS = [
    { id: '1', name: 'لغة عربية', grades: ['All'] },
    { id: '2', name: 'رياضيات', grades: ['All'] },
    { id: '3', name: 'علوم', grades: ['All'] },
    { id: '4', name: 'دراسات اجتماعية', grades: ['All'] },
    { id: '5', name: 'تربية إسلامية', grades: ['All'] },
    { id: '6', name: 'لغة إنجليزية', grades: ['All'] },
    { id: '7', name: 'حاسب آلي', grades: ['All'] },
    { id: '8', name: 'تربية وطنية', grades: ['All'] },
    { id: '9', name: 'تربية بدنية', grades: ['All'] },
    { id: '10', name: 'تربية فنية', grades: ['All'] },
];

export const getOmrSubjects = async () => {
    if (usesLocalStore()) {
        const row = await localGetSetting('omr_subjects');
        if (!row) {
            await localSaveSetting('omr_subjects', { subjects: DEFAULT_SUBJECTS });
            return DEFAULT_SUBJECTS;
        }
        return Array.isArray(row.subjects) ? row.subjects : (Array.isArray(row.data) ? row.data : DEFAULT_SUBJECTS);
    }
    const { data, error } = await supabase
        .from('settings')
        .select('data')
        .eq('id', 'omr_subjects')
        .maybeSingle();

    if (error) {
        _setConnected(false);
        throw new SupabaseError('settings/omr_subjects', 'fetch', error.message);
    }

    _setConnected(true);
    if (!data) {
        await supabase.from('settings').upsert({ id: 'omr_subjects', data: DEFAULT_SUBJECTS });
        return [...DEFAULT_SUBJECTS];
    }
    return data.data || [...DEFAULT_SUBJECTS];
};

export const saveOmrSubjects = async (subjects) => {
    if (usesLocalStore()) {
        await localSaveSetting('omr_subjects', { subjects });
        return subjects;
    }
    const { error } = await supabase
        .from('settings')
        .upsert({ id: 'omr_subjects', data: subjects });

    if (error) {
        _setConnected(false);
        throw new SupabaseError('settings/omr_subjects', 'save', error.message);
    }
    _setConnected(true);
    return subjects;
};

// --- OMR Methods ---
const examIsArchived = (e) => {
    if (!e || typeof e !== 'object') return false;
    const v = e.archived;
    return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
};

/** @param {{ includeArchived?: boolean }} [opts] — if false (default), rows with `archived: true` are omitted */
export const getOmrExams = async (opts = {}) => {
    const { includeArchived = false } = opts;
    let rows;
    if (usesLocalStore()) {
        rows = await fetchCollection('omr_exams');
    } else if (opts.summary) {
        const fields = ['title', 'grade', 'grades', 'stage', 'subject', 'date', 'createdAt', 'archived', 'qCount'];
        const all = [];
        for (let from = 0; ; from += 500) {
            const { data, error } = await supabase.from('omr_exams')
                .select(['id', ...fields.map((key) => `${key}:data->${key}`)].join(','))
                .order('id').range(from, from + 499);
            if (error) throw new SupabaseError('omr_exams', 'fetch', error.message);
            all.push(...(data || []));
            if (!data || data.length < 500) break;
        }
        rows = all;
    } else {
        rows = await fetchCollection('omr_exams');
    }
    if (includeArchived) return rows;
    return rows.filter((e) => !examIsArchived(e));
};
export const saveOmrExam    = (e) => saveDocument('omr_exams', e);
export const deleteOmrExam  = (id) => deleteDocument('omr_exams', id);

/** نتائج OMR: جلب صفحي (صفوف أقل لكل استعلام) لأن حقل data قد يحتوي صوراً كبيرة وتسبب statement timeout */
export const getOmrResults = (opts = {}) =>
    fetchCollectionPaged('omr_results', { ...opts, pageSize: 10, maxRows: 25000 });

// Select scalar fields in Postgres: images never travel to the browser.
const RESULT_LIST_FIELDS = ['examId', 'examTitle', 'subject', 'studentId', 'nationalId',
    'seatNumber', 'studentName', 'studentGrade', 'classroom', 'assignedStudentId', 'phone',
    'score', 'total', 'percentage', 'approved', 'confirmed', 'approvedAt', 'timestamp',
    'updatedAt', 'createdAt', 'manualEntry', 'detectedStudentId', 'normalizedDetectedStudentId'];
export const getOmrResultList = async (examId) => {
    if (!examId) return [];
    if (usesLocalStore()) {
        const rows = await localRequest('/store/omr_results');
        const prefix = `omr_${examId}_`;
        return (rows || [])
            .filter((row) => String(row.examId) === String(examId) || String(row.id || '').startsWith(prefix))
            .map((row) => ({ ...hydrateLocalRow(row), _listOnly: true }));
    }
    // Filtering a toasted JSON document scans/decompresses every sheet and times out.
    // Read only the indexed IDs first, then fetch this exam's scalar fields by PK.
    const ids = [];
    let cursor = null;
    const prefix = `omr_${examId}_`;
    for (;;) {
        let query = supabase.from('omr_results').select('id').order('id').limit(1000);
        if (cursor !== null) query = query.gt('id', cursor);
        const { data, error } = await query;
        if (error) throw new SupabaseError('omr_results', 'fetch', error.message);
        for (const row of data || []) {
            if (row.id.startsWith(prefix) || !/^omr_\d+_/.test(row.id)) ids.push(row.id);
        }
        if (!data?.length || data.length < 1000) break;
        cursor = data.at(-1).id;
    }
    const rows = [];
    for (let offset = 0; offset < ids.length; offset += 30) {
        const { data, error } = await supabase.from('omr_results')
            .select(['id', ...RESULT_LIST_FIELDS.map((key) => `${key}:data->${key}`)].join(','))
            .in('id', ids.slice(offset, offset + 30));
        if (error) throw new SupabaseError('omr_results', 'fetch', error.message);
        rows.push(...(data || []).filter((row) => String(row.examId) === String(examId))
            .map((row) => ({ ...row, _listOnly: true })));
    }
    return rows;
};

const mapGradingRpcRow = (row) => ({
    id: row.id,
    ...(typeof row.payload === 'object' && row.payload !== null ? row.payload : {}),
});

/** جلب خفيف عبر RPC (بدون صور) — يقلّل Egress بشكل كبير */
const fetchOmrResultsGradingViaRpc = async (opts = {}) => {
    const pageSize = Math.max(20, Math.min(opts.pageSize ?? 80, 200));
    const maxRows = Math.max(pageSize, Math.min(opts.maxRows ?? 25000, 100000));
    const partialOnError = opts.partialOnError === true;
    const all = [];
    let offset = 0;

    while (offset < maxRows) {
        let lastErr = null;
        let chunk = null;

        for (let attempt = 0; attempt < 4; attempt++) {
            const { data, error } = await supabase.rpc('fetch_omr_results_grading_page', {
                p_limit: pageSize,
                p_offset: offset,
            });

            if (!error) {
                chunk = (data || []).map(mapGradingRpcRow);
                break;
            }

            lastErr = error;
            const missingFn =
                error.code === 'PGRST202' ||
                String(error.message || '').includes('fetch_omr_results_grading_page');
            if (missingFn) return null;

            if (isSupabaseQuotaError(error)) throw new SupabaseError('omr_results/rpc', 'fetch', error.message);

            if (attempt < 3 && isRetryableFetchError(error.message)) {
                await sleep(700 * (attempt + 1));
                continue;
            }
            break;
        }

        if (chunk) {
            all.push(...chunk);
            if (chunk.length < pageSize) {
                _setConnected(true);
                return all;
            }
            offset += pageSize;
            await sleep(opts.pageDelayMs ?? 80);
            continue;
        }

        const errMsg = lastErr?.message || 'Failed to fetch';
        if (partialOnError && all.length > 0) {
            all._partialFetch = true;
            _setConnected(true);
            return all;
        }
        _setConnected(false);
        throw new SupabaseError('omr_results/rpc', 'fetch', errMsg);
    }

    _setConnected(true);
    return all;
};

/**
 * نتائج للرصد: RPC خفيف (إن وُجد) + كاش محلي 20 دقيقة + fallback بدون صور.
 */
export const getOmrResultsForGrading = async (opts = {}) => {
    if (!opts.forceRefresh) {
        const cached = readGradingCache();
        if (cached) return cached;
    }

    if (usesLocalStore()) {
        const rows = (await localRequest('/store/omr_results') || []).map((row) => slimOmrResultForGrading(hydrateLocalRow(row)));
        writeGradingCache(rows);
        return rows;
    }

    let rows = await fetchOmrResultsGradingViaRpc({
        pageSize: 80,
        maxRows: 25000,
        partialOnError: true,
        pageDelayMs: 80,
    });

    if (rows === null) {
        rows = await fetchCollectionPaged('omr_results', {
            pageSize: 35,
            maxRows: 25000,
            partialOnError: true,
            slim: 'grading',
            pageDelayMs: 150,
            maxAttempts: 6,
        });
    }

    writeGradingCache(rows);
    return rows;
};

export const saveOmrResult = async (r) => {
    let payload = r;
    if (r._listOnly) {
        if (usesLocalStore()) {
            const full = await localRequest(`/store/omr_results/${encodeURIComponent(r.id)}`);
            payload = { ...full, ...r };
            delete payload._listOnly;
            if (r.manualEntry) {
                delete payload.details;
                delete payload.answers;
            }
            const out = await saveDocument('omr_results', payload);
            invalidateOmrGradingCache();
            return out;
        }
        const { data, error } = await supabase.from('omr_results').select('id,data').eq('id', String(r.id)).single();
        if (error) throw new SupabaseError('omr_results', 'fetch', error.message);
        payload = { ...mapDataRow(data), ...r };
        delete payload._listOnly;
        if (r.manualEntry) {
            delete payload.details;
            delete payload.answers;
        }
    }
    const out = await saveDocument('omr_results', payload);
    invalidateOmrGradingCache();
    return out;
};

export const deleteOmrResult = async (id) => {
    await deleteDocument('omr_results', id);
    invalidateOmrGradingCache();
};

/** ينشر الجداول المحلية إلى السحابة بدون صور — للبوابة ورصد المعلمين */
export const publishLocalToCloud = async (onProgress) => {
    if (!supabase) throw new SupabaseError('cloud', 'publish', 'ضع VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY للمشروع السحابي');
    const tables = ['students', 'omr_exams', 'omr_results', 'committees', 'observers', 'locations', 'settings', 'retake_requests'];
    const stats = {};
    for (const table of tables) {
        const rows = await localRequest(`/store/${table}`);
        const list = rows || [];
        for (let i = 0; i < list.length; i += 80) {
            const chunk = list.slice(i, i + 80).map((r) => ({
                id: String(r.id),
                data: slimForCloud(table, r),
            }));
            const { error } = await supabase.from(table).upsert(chunk);
            if (error) throw new SupabaseError(table, 'publish', error.message);
            if (onProgress) onProgress({ table, done: Math.min(i + chunk.length, list.length), total: list.length });
        }
        stats[table] = list.length;
    }
    return stats;
};

/** يسحب درجات رصد المعلمين من السحابة إلى المكتب دون مسح صور الأوراق المحلية */
export const pullCloudResultsToLocal = async () => {
    if (!supabase) throw new SupabaseError('cloud', 'pull', 'السحابة غير متصلة');
    let cursor = null;
    let merged = 0;
    for (;;) {
        let query = supabase
            .from('omr_results')
            .select(['id', ...RESULT_LIST_FIELDS.map((key) => `${key}:data->${key}`)].join(','))
            .order('id')
            .limit(200);
        if (cursor != null) query = query.gt('id', cursor);
        const { data, error } = await query;
        if (error) throw new SupabaseError('omr_results', 'pull', error.message);
        if (!data?.length) break;
        for (const row of data) {
            let local = null;
            try {
                local = await localRequest(`/store/omr_results/${encodeURIComponent(row.id)}`);
            } catch { local = null; }
            const next = { ...(local || {}), ...row, id: row.id };
            delete next._listOnly;
            await localRequest(`/store/omr_results/${encodeURIComponent(row.id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(next),
            });
            merged += 1;
        }
        cursor = data.at(-1).id;
        if (data.length < 200) break;
    }
    invalidateOmrGradingCache();
    return { merged };
};

// --- Clear All Data ---
export const clearAllData = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف جميع البيانات؟ لا يمكن التراجع عن هذا الإجراء.')) return;

    if (usesLocalStore()) {
        await localRequest('/store/clear', { method: 'POST' });
        invalidateOmrGradingCache();
        return;
    }

    const tables = ['students', 'committees', 'observers', 'locations', 'omr_exams', 'omr_results'];
    const errors = [];

    for (const table of tables) {
        const { error } = await supabase.from(table).delete().neq('id', '__placeholder__');
        if (error) errors.push(`${table}: ${error.message}`);
    }

    // Reset settings to defaults
    await supabase.from('settings').upsert({ id: 'app_config',   data: DEFAULT_APP_SETTINGS });
    await supabase.from('settings').upsert({ id: 'assignments',  data: {} });
    await supabase.from('settings').upsert({ id: 'omr_subjects', data: DEFAULT_SUBJECTS });

    if (errors.length > 0) {
        console.error('⚠️ بعض الجداول فشلت في الحذف:', errors);
    }

    window.location.reload();
};
