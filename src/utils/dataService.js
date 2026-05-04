import { createClient } from '@supabase/supabase-js';

// --- API Endpoints (Local services) ---
// In production (behind Caddy/Nginx), prefer same-origin relative paths.
// You can override these via Vite env vars at build-time.
export const OMR_API_BASE = (import.meta.env.VITE_OMR_API_BASE || '/api/omr').replace(/\/$/, '');
export const WHATSAPP_API_BASE = (import.meta.env.VITE_WHATSAPP_API_BASE || '/api/whatsapp').replace(/\/$/, '');

// --- Supabase Configuration ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase credentials are missing! Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
const slimOmrResult = (item) => {
    if (!item || typeof item !== 'object') return item;
    const { systemViewImage: _a, reviewRois: _b, ...rest } = item;
    return rest;
};

// --- Core CRUD helpers (Supabase only, throws on error) ---

const fetchCollection = async (tableName) => {
    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(0, 1999); // Safety cap: max 2000 records per fetch

    if (error) {
        _setConnected(false);
        throw new SupabaseError(tableName, 'fetch', error.message);
    }

    _setConnected(true);
    return (data || []).map(row => ({
        id: row.id,
        ...(typeof row.data === 'object' && row.data !== null ? row.data : {}),
    }));
};

const saveDocument = async (tableName, item) => {
    const docData = { ...item };
    if (!docData.id) {
        docData.id = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    }

    const persisted = tableName === 'omr_results' ? slimOmrResult(docData) : docData;

    const { error } = await supabase
        .from(tableName)
        .upsert({ id: String(persisted.id), data: persisted });

    if (error) {
        _setConnected(false);
        throw new SupabaseError(tableName, 'save', error.message);
    }

    _setConnected(true);
    return persisted;
};

const deleteDocument = async (tableName, id) => {
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

export const getStudents     = () => fetchCollection('students');
export const saveStudent     = (s) => saveDocument('students', s);
export const deleteStudent   = (id) => deleteDocument('students', id);

export const saveStudentsBulk = async (studentList) => {
    const CHUNK = 100;
    for (let i = 0; i < studentList.length; i += CHUNK) {
        const batch = studentList.slice(i, i + CHUNK);
        const rows = batch.map(s => ({
            id: String(s.id || `${Date.now()}${Math.floor(Math.random() * 10000)}`),
            data: s,
        }));
        const { error } = await supabase.from('students').upsert(rows);
        if (error) {
            _setConnected(false);
            throw new SupabaseError('students', 'bulk-save', error.message);
        }
    }
    _setConnected(true);
    return studentList;
};

// --- Assignments ---
export const getAssignments = async () => {
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
        return {};
    }
    return data.data || {};
};

export const saveAssignments = async (assignments) => {
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
    attendance: {
        table: { startTop: 15, rowHeight: 2.2, nameRight: 5, seatRight: 35, indexRight: 1, gradeRight: 45, signatureRight: 55 },
        maxRows: 25,
    },
    seating: {
        name:       { top: 20, right: 10, fontSize: 1.2 },
        seatNumber: { top: 40, right: 10, fontSize: 1.5 },
        grade:      { top: 60, right: 10, fontSize: 1.0 },
        committee:  { top: 80, right: 10, fontSize: 1.0 },
    },
    messages: {
        committee: 'عزيزي ولي أمر الطالب {name}، موعد اختبار ابنكم في لجنة {committee}، رقم الجلوس: {seatNumber}',
        result:    'تم إعلان نتائج {name}. يمكنك الاطلاع عليها عبر البوابة.',
    },
};

export const getAppSettings = async () => {
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
        await supabase.from('settings').upsert({ id: 'app_config', data: DEFAULT_APP_SETTINGS });
        return DEFAULT_APP_SETTINGS;
    }
    return { ...DEFAULT_APP_SETTINGS, ...data.data };
};

export const saveAppSettings = async (config) => {
    const { error } = await supabase
        .from('settings')
        .upsert({ id: 'app_config', data: config });

    if (error) {
        _setConnected(false);
        throw new SupabaseError('settings/app_config', 'save', error.message);
    }
    _setConnected(true);
    return config;
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
    const rows = await fetchCollection('omr_exams');
    if (includeArchived) return rows;
    return rows.filter((e) => !examIsArchived(e));
};
export const saveOmrExam    = (e) => saveDocument('omr_exams', e);
export const deleteOmrExam  = (id) => deleteDocument('omr_exams', id);

export const getOmrResults  = () => fetchCollection('omr_results');
export const saveOmrResult  = (r) => saveDocument('omr_results', r);
export const deleteOmrResult = (id) => deleteDocument('omr_results', id);

// --- Clear All Data (Supabase) ---
export const clearAllData = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف جميع البيانات من قاعدة البيانات السحابية؟ لا يمكن التراجع عن هذا الإجراء.')) return;

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
