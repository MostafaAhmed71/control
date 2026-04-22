import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import StudentList from './pages/StudentList';
import Committees from './pages/Committees';
import SeatingCards from './pages/SeatingCards';
import PrintSheets from './pages/PrintSheets';
import Attendance from './pages/Attendance';
import Observers from './pages/Observers';
import CommitteeObservers from './pages/CommitteeObservers';
import CommitteeSeating from './pages/CommitteeSeating';
import CommitteeLocations from './pages/CommitteeLocations';
import PhotoRenamer from './pages/PhotoRenamer';
import OMRScanner from './pages/OMRScanner';
import OMRExams from './pages/OMRExams';
import OMRResults from './pages/OMRResults';
import ApprovedResults from './pages/ApprovedResults';
import GradeRecording from './pages/GradeRecording';
import OMRDesigner from './pages/OMRDesigner';
import StudentNotifier from './pages/StudentNotifier';
import Settings from './pages/Settings';
import SystemSelector from './components/SystemSelector';
import StudentPortal from './pages/StudentPortal';
import MockExams from './pages/MockExams';
import { ToastProvider, useToast } from './components/Toast';

import { getStudents, getCommittees, getObservers, clearAllData, getAppSettings, subscribeToConnection } from './utils/dataService';
import { Trash2, AlertTriangle, Users, UsersRound, UserCheck, ScanLine, Send, WifiOff, Wifi } from 'lucide-react';

const Dashboard = ({ activeSystem }) => {
  const [stats, setStats] = React.useState({ students: 0, committees: 0, observers: 0 });
  const [appConfig, setAppConfig] = React.useState(null);
  const [loadError, setLoadError] = React.useState(false);
  const toast = useToast();

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [s, c, o, config] = await Promise.all([getStudents(), getCommittees(), getObservers(), getAppSettings()]);
        setStats({ students: s.length, committees: c.length, observers: o.length });
        setAppConfig(config);
        setLoadError(false);
      } catch (err) {
        setLoadError(true);
        toast.error('تعذّر الاتصال بقاعدة البيانات. تحقق من اتصالك بالإنترنت.', 'خطأ في التحميل');
        console.error('Dashboard load error:', err);
      }
    };
    fetchData();
  }, [activeSystem]);

  const handleClear = () => clearAllData();

  const isGrading = activeSystem === 'grading';

  return (
    <div className="p-4 md:p-8 space-y-8 animate-fade-in text-slate-800">
      {/* Welcome Banner */}
      <div className="luxury-card p-8 flex flex-col md:flex-row justify-between items-center gap-6 bg-gradient-to-br from-white to-slate-50 border-none">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 font-header leading-tight">
             مرحباً بك في <span className="gold-accent underline decoration-gold/20">نخبة الشمال</span>
          </h1>
          <p className="text-slate-500 text-sm mt-3 font-medium tracking-wide max-w-lg">
            {isGrading 
              ? "نظام الرصد الذكي والتصحيح الآلي للطلاب. يمكنك مراقبة الأداء وتصدير النتائج بكل سهولة." 
              : (appConfig?.platformName || "نظام الكنترول المتكامل لإدارة اللجان وأرقام الجلوس.")}
          </p>
        </div>
        <button
          onClick={handleClear}
          className="flex items-center gap-3 px-8 py-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl hover:bg-red-600 hover:text-white transition-all text-sm font-bold shadow-sm active:scale-95 group"
        >
          <Trash2 size={20} className="group-hover:rotate-12 transition-transform" />
          <span>مسح السجلات</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Card 1: Students */}
        <div className="luxury-card p-6 group relative overflow-hidden bg-white border-l-4 border-l-indigo-500">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-50 rounded-full opacity-40 group-hover:scale-150 transition-transform duration-700"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <h3 className="text-slate-400 text-[10px] mb-2 uppercase tracking-[0.2em] font-black font-header">إجمالي الطلاب</h3>
              <p className="text-4xl font-black text-slate-900 tracking-tighter">{stats.students}</p>
            </div>
            <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-xl shadow-sm">
                <Users size={28} />
            </div>
          </div>
          <div className="mt-8 flex items-center gap-2">
             <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
             <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">متصلون الآن بقاعدة البيانات</span>
          </div>
        </div>
        
        {/* Card 2: Committees/Exams */}
        <div className="luxury-card p-6 group relative overflow-hidden bg-white border-l-4 border-l-amber-500">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-50 rounded-full opacity-40 group-hover:scale-150 transition-transform duration-700"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <h3 className="text-slate-400 text-[10px] mb-2 uppercase tracking-[0.2em] font-black font-header">
                {isGrading ? 'اختبارات OMR' : 'لجان الاختبار'}
              </h3>
              <p className="text-4xl font-black text-slate-900 tracking-tighter">
                {isGrading ? '-' : stats.committees}
              </p>
            </div>
            <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl shadow-sm">
                {isGrading ? <ScanLine size={28} /> : <UsersRound size={28} />}
            </div>
          </div>
          <div className="mt-8">
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full uppercase tracking-wider">
               {isGrading ? 'نظام التصحيح الآلي' : 'جاهز للطباعة والارشفة'}
            </span>
          </div>
        </div>

        {/* Card 3: Observers/Notifier */}
        <div className="luxury-card p-6 group relative overflow-hidden bg-white border-l-4 border-l-emerald-500">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-50 rounded-full opacity-40 group-hover:scale-150 transition-transform duration-700"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <h3 className="text-slate-400 text-[10px] mb-2 uppercase tracking-[0.2em] font-black font-header">
                {isGrading ? 'مركز الإشعارات' : 'الكادر التعليمي'}
              </h3>
              <p className="text-4xl font-black text-slate-900 tracking-tighter">
                {isGrading ? '-' : stats.observers}
              </p>
            </div>
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl shadow-sm">
                {isGrading ? <Send size={28} /> : <UserCheck size={28} />}
            </div>
          </div>
          <div className="mt-8">
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider">
               {isGrading ? 'سجل النتائج والتواصل' : 'مدير الحضور والغياب'}
            </span>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="luxury-card p-6 flex items-center gap-5 bg-rose-50 border border-rose-100 border-none">
          <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600 shrink-0">
            <WifiOff size={24} />
          </div>
          <div>
            <p className="font-black text-rose-800 font-header">تعذّر الاتصال بقاعدة البيانات</p>
            <p className="text-rose-600 text-sm font-bold mt-1">تأكد من اتصالك بالإنترنت وأن خدمة Supabase تعمل بشكل صحيح.</p>
          </div>
        </div>
      )}

      {stats.students === 0 && !loadError && (
        <div className="luxury-card p-12 flex flex-col md:flex-row gap-10 items-center animate-slide-up bg-white border-none">
          <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center flex-shrink-0 shadow-xl shadow-indigo-100/50 text-indigo-600">
            <AlertTriangle size={48} />
          </div>
          <div className="text-center md:text-right">
            <h4 className="font-header font-black text-slate-900 text-3xl mb-3 tracking-tight">النظام جاهز للبدء...</h4>
            <p className="text-slate-500 text-lg font-medium leading-relaxed max-w-2xl">
              لم نجد أي بيانات مسجلة حالياً. يرجى البدء بعملية <span className="text-indigo-600 font-bold underline decoration-indigo-200 underline-offset-4">استيراد الطلاب</span> لتفعيل كافة أدوات {isGrading ? 'الرصد والتصحيح الآلي' : 'توزيع اللجان والتقارير'}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const Header = () => {
  const [config, setConfig] = React.useState(null);
  const [connected, setConnected] = React.useState(true);

  React.useEffect(() => {
    getAppSettings().then(setConfig).catch(() => setConnected(false));
    // Subscribe to connection state changes from dataService
    const unsub = subscribeToConnection(setConnected);
    return unsub;
  }, []);

  return (
    <header className="h-20 px-10 flex items-center justify-between sticky top-0 z-40 bg-white/80 border-b border-gray-50 backdrop-blur-xl shadow-[0_2px_15px_rgba(0,0,0,0.02)]">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-gold"></div>
           <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
        </div>
        <h1 className="text-xl font-black text-slate-800 tracking-tight font-header">
           منصة <span className="gold-accent">نخبة الشمال</span> الذكية
        </h1>
      </div>
      <div className="flex items-center gap-8">
        {/* Connection indicator */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
          connected
            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
            : 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse'
        }`}>
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span>{connected ? 'Supabase متصل' : 'انقطع الاتصال'}</span>
        </div>

        <div className="hidden md:flex flex-col items-end">
          <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mb-1">مدير المدرسة</span>
          <span className="text-sm font-bold text-slate-700">{config?.managerName || 'الأستاذ محمد نصر الدين'}</span>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 shadow-sm flex items-center justify-center text-lg font-black text-indigo-600 transform hover:scale-105 transition-all cursor-pointer ring-4 ring-slate-50">
          {config?.managerName ? config.managerName.charAt(0) : 'م'}
        </div>
      </div>
    </header>
  );
};



const AdminLayout = ({ activeSystem, handleSystemSelect, setActiveSystem }) => {
  if (!activeSystem) {
    return <SystemSelector onSelect={handleSystemSelect} />;
  }

  return (
    <div className="min-h-screen flex" dir="rtl">
      <Sidebar 
        className="z-50" 
        activeSystem={activeSystem} 
        onSwitchSystem={() => setActiveSystem(null)} 
      />
      <main className="flex-1 mr-64 min-h-screen relative">
        <Header />

        <div className="p-4 sm:p-5 lg:p-8 pb-24">
          <Routes>
            <Route path="/" element={<Dashboard activeSystem={activeSystem} />} />
            {/* Grading System Routes */}
            {activeSystem === 'grading' ? (
              <>
                <Route path="/students" element={<StudentList />} />
                <Route path="/omr-scanner/:examId?" element={<OMRScanner />} />
                <Route path="/omr-exams" element={<OMRExams />} />
                <Route path="/omr-results" element={<OMRResults />} />
                <Route path="/approved-results" element={<ApprovedResults />} />
                <Route path="/mock-exams" element={<MockExams />} />
                <Route path="/grade-recording" element={<GradeRecording />} />
                <Route path="/omr-designer" element={<OMRDesigner />} />
                <Route path="/notifier" element={<StudentNotifier />} />
                <Route path="/photo-renamer" element={<PhotoRenamer />} />
              </>
            ) : (
              <>
                {/* Control System Routes */}
                <Route path="/seating-cards" element={<SeatingCards />} />
                <Route path="/committees" element={<Committees />} />
                <Route path="/print-sheets" element={<PrintSheets />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/observers" element={<Observers />} />
                <Route path="/committee-observers" element={<CommitteeObservers />} />
                <Route path="/committee-seating" element={<CommitteeSeating />} />
                <Route path="/locations" element={<CommitteeLocations />} />
              </>
            )}
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

function App() {
  const [activeSystem, setActiveSystem] = React.useState(localStorage.getItem('activeSystem'));

  const handleSystemSelect = (system) => {
    localStorage.setItem('activeSystem', system);
    setActiveSystem(system);
  };

  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route path="/portal/*" element={<StudentPortal />} />
          <Route path="/*" element={
            <AdminLayout
              activeSystem={activeSystem}
              handleSystemSelect={handleSystemSelect}
              setActiveSystem={setActiveSystem}
            />
          } />
        </Routes>
      </Router>
    </ToastProvider>
  );
}

export default App;
