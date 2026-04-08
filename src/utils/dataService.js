// 🔄 Last updated: 2026-04-04 13:16 - Move exports to top
import { initializeApp } from "firebase/app";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    setDoc, 
    deleteDoc, 
    getDoc 
} from "firebase/firestore";

// --- API Endpoints (Local services - run inside Electron) ---
export const OMR_API_BASE = 'http://localhost:8000';
export const WHATSAPP_API_BASE = 'http://localhost:3001';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let db = null;
const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.apiKey.trim() !== '');

if (isFirebaseConfigured) {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        console.log("🔥 Firebase Firestore Connected");
    } catch (error) {
        console.error("Firebase initialization error", error);
    }
} else {
    console.warn("⚠️ Firebase is not configured! Falling back to LocalStorage.");
}

// --- Generic Helpers ---
const fetchCollection = async (collectionName) => {
    let dataFromNetwork = null;
    if (db) {
        try {
            const snapshot = await getDocs(collection(db, collectionName));
            dataFromNetwork = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error(`Error fetching ${collectionName} from Firebase:`, error);
        }
    }
    
    // If we have data from Firestore, cache it in local storage and return it
    if (dataFromNetwork !== null) {
        localStorage.setItem(collectionName, JSON.stringify(dataFromNetwork));
        return dataFromNetwork;
    }

    // Fallback to local storage
    const data = localStorage.getItem(collectionName);
    return data ? JSON.parse(data) : [];
};

const saveDocument = async (collectionName, data) => {
    const docData = { ...data };
    if (!docData.id) {
        docData.id = Date.now().toString() + Math.floor(Math.random() * 1000);
    }
    
    // Save to Firebase
    if (db) {
        try {
            await setDoc(doc(db, collectionName, docData.id), docData);
        } catch (error) {
            console.error(`Error saving ${collectionName} to Firebase:`, error);
        }
    }
    
    // Always save to localStorage as a fallback/cache
    const localData = localStorage.getItem(collectionName);
    const list = localData ? JSON.parse(localData) : [];
    
    const exists = list.some(item => item.id === docData.id);
    const updated = exists 
        ? list.map(item => item.id === docData.id ? docData : item)
        : [...list, docData];
        
    localStorage.setItem(collectionName, JSON.stringify(updated));
    return updated;
};

const deleteDocument = async (collectionName, id) => {
    // Delete from Firebase
    if (db) {
        try {
            await deleteDoc(doc(db, collectionName, id));
        } catch (error) {
            console.error(`Error deleting ${collectionName} from Firebase:`, error);
        }
    }
    
    // Delete from localStorage Cache
    const localData = localStorage.getItem(collectionName);
    const list = localData ? JSON.parse(localData) : [];
    
    const filtered = list.filter(item => item.id !== id);
    localStorage.setItem(collectionName, JSON.stringify(filtered));
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

export const saveStudentsBulk = async (students) => {
    if (db) {
        try {
            await Promise.all(students.map(student => {
                const s = { ...student, id: student.id || Date.now().toString() + Math.floor(Math.random() * 1000) };
                return setDoc(doc(db, 'students', s.id), s);
            }));
        } catch (error) {
            console.error("Bulk save to Firebase failed", error);
        }
    }
    localStorage.setItem('students', JSON.stringify(students));
    return students;
};

export const getAssignments = async () => {
    if (db) {
        try {
            const docSnap = await getDoc(doc(db, 'settings', 'assignments'));
            if (docSnap.exists()) {
                const data = docSnap.data();
                localStorage.setItem('assignments', JSON.stringify(data));
                return data;
            }
        } catch(error) {
            console.error("Fetch assignments failed", error);
        }
    }
    const data = localStorage.getItem('assignments');
    return data ? JSON.parse(data) : {};
};

export const saveAssignments = async (assignments) => {
    if (db) {
        try {
            await setDoc(doc(db, 'settings', 'assignments'), assignments);
        } catch(error) {
            console.error("Save assignments failed", error);
        }
    }
    localStorage.setItem('assignments', JSON.stringify(assignments));
    return assignments;
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
    
    if (db) {
        alert("⚠️ تنبيه: يتم مسح التخزين المحلي فقط. لدواعي أمنية لا يمكن مسح بيانات قاعدة السحابة (Firebase) بضغطة زر من هنا، يجب مسحها من لوحة التحكم الخاصة بـ Firebase.");
    }
    
    keys.forEach(key => localStorage.removeItem(key));
    window.location.reload();
};

// --- App Settings (Central Hub) ---
export const getAppSettings = async () => {
    const defaultSettings = {
        // Identity
        platformName: "كنترول متوسطة وثانوية نخبة الشمال الأهلية",
        managerName: "الأستاذ محمد نصر الدين",
        academicWeight: "2023 - 2024",
        whatsappStatus: "Disconnected",
        omrPath: "C:\\control\\omr_engine",
        primaryColor: "#d4af37",
        
        // Attendance Template Criteria
        attendance: {
            headerCommittee: { top: 16.5, right: 33, fontSize: 1.2, show: true },
            headerGrade: { top: 16.5, right: 65, fontSize: 1.1, show: true },
            headerCount: { top: 16.5, right: 88, fontSize: 1.2, show: true },
            table: { 
                startTop: 28, 
                rowHeight: 3.5, 
                indexRight: 7, indexTop: 0, indexShow: true,
                omrRight: 15, omrTop: 0, omrShow: true,
                seatRight: 23, seatTop: 0, seatShow: true,
                nameRight: 55, nameTop: 0, nameShow: true,
                gradeRight: 85, gradeTop: 0, gradeShow: true,
                signatureRight: 95, signatureTop: 0, signatureShow: true,
                fontSize: 0.9,
                rowOverrides: {} 
            },
            maxRows: 20
        },

        // Seating Cards & Notifier Template Criteria
        seating: {
            name: { top: 45, right: 35, fontSize: 1.2 },
            seatNumber: { top: 25, right: 15, fontSize: 1.5 },
            grade: { top: 65, right: 30, fontSize: 1 },
            committee: { top: 80, right: 15, fontSize: 1 }
        },

        // WhatsApp Messaging Templates
        messages: {
            committee: "أهلاً بك 🎓\nهذه بطاقة الجلوس وتحديد قاعة الاختبار للطالب: *{name}*.\nنتمنى لك التوفيق!",
            result: "إشعار درجات نتيجة الاختبار للطالب: *{name}*\nمرفق لكم صورة النتيجة الرسمية."
        }
    };

    if (db) {
        try {
            const docSnap = await getDoc(doc(db, 'settings', 'app_config'));
            if (docSnap.exists()) {
                const data = docSnap.data();
                // Deep merge or just localStorage update
                localStorage.setItem('app_config', JSON.stringify(data));
                return { ...defaultSettings, ...data };
            }
        } catch(error) {
            console.error("Fetch app settings failed", error);
        }
    }
    const data = localStorage.getItem('app_config');
    return data ? { ...defaultSettings, ...JSON.parse(data) } : defaultSettings;
};

export const saveAppSettings = async (settings) => {
    if (db) {
        try {
            await setDoc(doc(db, 'settings', 'app_config'), settings);
        } catch(error) {
            console.error("Save app settings failed", error);
        }
    }
    localStorage.setItem('app_config', JSON.stringify(settings));
    return settings;
};
