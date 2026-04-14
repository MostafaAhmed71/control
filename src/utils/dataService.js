import { createClient } from '@supabase/supabase-js';

// --- API Endpoints (Local services) ---
export const OMR_API_BASE = 'http://localhost:8000';
export const WHATSAPP_API_BASE = 'http://localhost:3001';

// --- Supabase Configuration ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseAnonKey) 
    ? createClient(supabaseUrl, supabaseAnonKey) 
    : null;

if (supabase) {
    console.log("⚡ Supabase Client Initialized");
} else {
    console.warn("⚠️ Supabase credentials missing! Using LocalStorage only.");
}

// --- Generic Helpers ---
const slimOmrResultForStorage = (item) => {
    if (!item || typeof item !== 'object') return item;
    // Base64 images are too big for localStorage quota
    const { systemViewImage: _drop, ...rest } = item;
    return rest;
};

function writeOmrResultsLocalStorage(slimList) {
    try {
        localStorage.setItem('omr_results', JSON.stringify(slimList));
    } catch (e) {
        console.error('LocalStorage quota exceeded for omr_results', e);
    }
}

// --- Dynamic Query Helper ---
const fetchCollection = async (tableName) => {
    let dataFromNetwork = null;
    
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*');
            
            if (!error && data) {
                // Map from {id, data} structure to flat object
                dataFromNetwork = data.map(row => ({
                    id: row.id,
                    ...(typeof row.data === 'object' ? row.data : {})
                }));
            } else if (error) {
                console.error(`Supabase error fetching ${tableName}:`, error);
            }
        } catch (error) {
            console.error(`Network error fetching ${tableName}:`, error);
        }
    }

    if (dataFromNetwork !== null) {
        if (tableName === 'omr_results') {
            const slim = dataFromNetwork.map(slimOmrResultForStorage);
            writeOmrResultsLocalStorage(slim);
            return slim;
        }
        localStorage.setItem(tableName, JSON.stringify(dataFromNetwork));
        return dataFromNetwork;
    }

    const localData = localStorage.getItem(tableName);
    return localData ? JSON.parse(localData) : [];
};

const saveDocument = async (tableName, item) => {
    const docData = { ...item };
    if (!docData.id) {
        docData.id = Date.now().toString() + Math.floor(Math.random() * 1000);
    }

    const persisted = tableName === 'omr_results' ? slimOmrResultForStorage(docData) : docData;

    // Save to Supabase
    if (supabase) {
        try {
            const { error } = await supabase
                .from(tableName)
                .upsert({ id: persisted.id, data: persisted });
            
            if (error) console.error(`Supabase save error (${tableName}):`, error);
        } catch (error) {
            console.error(`Supabase network error (${tableName}):`, error);
        }
    }

    // Update Local Cache
    const localData = localStorage.getItem(tableName);
    const list = localData ? JSON.parse(localData) : [];
    const exists = list.some(i => i.id === persisted.id);
    
    let updated;
    if (exists) {
        updated = list.map(i => i.id === persisted.id ? { ...i, ...persisted } : i);
    } else {
        updated = [...list, persisted];
    }

    if (tableName === 'omr_results') {
        const slimList = updated.map(slimOmrResultForStorage);
        writeOmrResultsLocalStorage(slimList);
        return slimList;
    } else {
        localStorage.setItem(tableName, JSON.stringify(updated));
        return updated;
    }
};

const deleteDocument = async (tableName, id) => {
    if (supabase) {
        try {
            const { error } = await supabase
                .from(tableName)
                .delete()
                .eq('id', id);
            if (error) console.error(`Supabase delete error (${tableName}):`, error);
        } catch (error) {
            console.error(`Supabase network error (${tableName}):`, error);
        }
    }

    const localData = localStorage.getItem(tableName);
    const list = localData ? JSON.parse(localData) : [];
    const filtered = list.filter(i => i.id !== id);
    
    localStorage.setItem(tableName, JSON.stringify(filtered));
    return filtered;
};

// --- API Methods ---

export const getCommittees = () => fetchCollection('committees');
export const saveCommittee = (committee) => saveDocument('committees', committee);
export const deleteCommittee = (id) => deleteDocument('committees', id);

export const getObservers = () => fetchCollection('observers');
export const saveObserver = (observer) => saveDocument('observers', observer);
export const deleteObserver = (id) => deleteDocument('observers', id);

export const getLocations = () => fetchCollection('locations');
export const saveLocation = (location) => saveDocument('locations', location);
export const deleteLocation = (id) => deleteDocument('locations', id);

export const getStudents = () => fetchCollection('students');
export const saveStudent = (student) => saveDocument('students', student);
export const deleteStudent = (id) => deleteDocument('students', id);

export const saveStudentsBulk = async (studentList) => {
    if (supabase) {
        try {
            const rows = studentList.map(s => ({
                id: s.id || Date.now().toString() + Math.floor(Math.random() * 1000) + Math.random().toString(),
                data: s
            }));
            const { error } = await supabase.from('students').upsert(rows);
            if (error) console.error("Bulk save failed:", error);
        } catch (e) {
            console.error("Bulk save network error:", e);
        }
    }
    localStorage.setItem('students', JSON.stringify(studentList));
    return studentList;
};

// Settings are stored in a common 'settings' table with 'assignments' as ID
export const getAssignments = async () => {
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('settings')
                .select('data')
                .eq('id', 'assignments')
                .single();
            
            if (!error && data) {
                localStorage.setItem('assignments', JSON.stringify(data.data));
                return data.data;
            }
        } catch (e) {}
    }
    const local = localStorage.getItem('assignments');
    return local ? JSON.parse(local) : {};
};

export const saveAssignments = async (assignments) => {
    if (supabase) {
        try {
            await supabase.from('settings').upsert({ id: 'assignments', data: assignments });
        } catch (e) {}
    }
    localStorage.setItem('assignments', JSON.stringify(assignments));
    return assignments;
};

// --- App Settings Methods ---
export const getAppSettings = async () => {
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('settings')
                .select('data')
                .eq('id', 'app_config')
                .single();
            
            if (!error && data) {
                localStorage.setItem('app_config', JSON.stringify(data.data));
                return data.data;
            }
        } catch (e) {}
    }
    const local = localStorage.getItem('app_config');
    const defaultData = {
        platformName: 'Elite Control System',
        managerName: 'اسم المدير هنا',
        academicWeight: '2025/2026',
        primaryColor: '#4f46e5',
        attendance: {
            table: { startTop: 15, rowHeight: 2.2, nameRight: 5, seatRight: 35, indexRight: 1, gradeRight: 45, signatureRight: 55 },
            maxRows: 25
        },
        seating: {
            name: { top: 20, right: 10, fontSize: 1.2 },
            seatNumber: { top: 40, right: 10, fontSize: 1.5 },
            grade: { top: 60, right: 10, fontSize: 1.0 },
            committee: { top: 80, right: 10, fontSize: 1.0 }
        },
        messages: {
            committee: 'عزيزي ولي أمر الطالب {name}، موعد اختبار ابنكم في لجنة {committee}، رقم الجلوس: {seatNumber}',
            result: 'تم إعلان نتائج {name}. يمكنك الاطلاع عليها عبر البوابة.'
        }
    };
    return local ? JSON.parse(local) : defaultData;
};

export const saveAppSettings = async (config) => {
    if (supabase) {
        try {
            await supabase.from('settings').upsert({ id: 'app_config', data: config });
        } catch (e) {}
    }
    localStorage.setItem('app_config', JSON.stringify(config));
    return config;
};

// --- OMR Database Methods ---
export const getOmrExams = () => fetchCollection('omr_exams');
export const saveOmrExam = (exam) => saveDocument('omr_exams', exam);
export const deleteOmrExam = (id) => deleteDocument('omr_exams', id);

export const getOmrResults = () => fetchCollection('omr_results');
export const saveOmrResult = (result) => saveDocument('omr_results', result);
export const deleteOmrResult = (id) => deleteDocument('omr_results', id);

export const clearAllData = async () => {
    const keys = ['students', 'committees', 'observers', 'locations', 'assignments', 'omr_exams', 'omr_results'];
    if (supabase) {
        alert("⚠️ تنبيه: يتم مسح التخزين المحلي فقط. لمسح بيانات السحابة يرجى استخدام لوحة تحكم Supabase.");
    }
    keys.forEach(key => localStorage.removeItem(key));
    window.location.reload();
};
