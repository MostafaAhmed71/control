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
import GradeRecording from './pages/GradeRecording';
import OMRDesigner from './pages/OMRDesigner';
import StudentNotifier from './pages/StudentNotifier';
import Settings from './pages/Settings';
import SystemSelector from './components/SystemSelector';


// Placeholder components
import { getStudents, getCommittees, getObservers, clearAllData, getAppSettings } from './utils/dataService';
import { Trash2, AlertTriangle, Users, UsersRound, UserCheck, ScanLine, Send } from 'lucide-react';

const Dashboard = ({ activeSystem }) => {
  const [stats, setStats] = React.useState({ students: 0, committees: 0, observers: 0 });
  const [appConfig, setAppConfig] = React.useState(null);

  React.useEffect(() => {
    const fetchData = async () => {
      const [s, c, o, config] = await Promise.all([getStudents(), getCommittees(), getObservers(), getAppSettings()]);
      setStats({ students: s.length, committees: c.length, observers: o.length });
      setAppConfig(config);
    };
    fetchData();
  }, [activeSystem]);

  const handleClear = () => {
    if (confirm('هل أنت متأكد من رغبتك في حذف جميع البيانات؟ لا يمكن التراجع عن هذا الإجراء.')) {
      clearAllData();
    }
  };

  const isGrading = activeSystem === 'grading';

  return (
    <div className="p-8 space-y-8 animate-fade-in text-slate-800">
      <div className="flex justify-between items-center bg-white p-8 rounded-3xl border border-gray-100 shadow-xl">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">
            {isGrading ? 'نظام التصحيح' : 'كنترول'} <span className="gold-text">نخبة الشمال</span>
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium tracking-wide">
            {isGrading ? 'إدارة شؤون الطلاب والرصد الآلي' : (appConfig?.platformName || 'مدارس نخبة الشمال الأهلية والعالمية')}
          </p>
        </div>
        <button
          onClick={handleClear}
          className="flex items-center gap-3 px-6 py-3 bg-red-50 text-red-600 border border-red-100 rounded-2xl hover:bg-red-600 hover:text-white transition-all text-sm font-bold shadow-sm active:scale-95"
        >
          <Trash2 size={20} />
          <span>مسح السجلات</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Card 1: Students (Common) */}
        <div className={`${isGrading ? 'bg-indigo-600' : 'bg-slate-900'} p-8 rounded-[2.5rem] shadow-2xl border-b-4 border-gold group hover:scale-[1.02] transition-all duration-500 relative overflow-hidden`}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-white/70 text-sm mb-2 uppercase tracking-[0.2em] font-black group-hover:text-white transition-colors">إجمالي الطلاب</h3>
              <p className="text-6xl font-black text-white">{stats.students}</p>
            </div>
            <div className="p-4 bg-white/10 rounded-2xl text-white">
                <Users size={32} />
            </div>
          </div>
          <div className="mt-6 text-xs font-bold text-white/80 border border-white/20 inline-block px-4 py-1.5 rounded-full backdrop-blur-sm italic">مدير الطلاب</div>
        </div>
        
        {/* Card 2: Committees or OMR */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-b-4 border-gray-100 group border-t border-l border-r hover:border-gold/30 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-slate-400 text-sm mb-2 uppercase tracking-[0.2em] font-black group-hover:text-indigo-600 transition-colors">
                {isGrading ? 'اختبارات OMR' : 'لجان الاختبار'}
              </h3>
              <p className="text-6xl font-black text-slate-900">
                {isGrading ? '-' : stats.committees}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-2xl text-slate-400 group-hover:text-indigo-600 transition-colors">
                {isGrading ? <ScanLine size={32} /> : <UsersRound size={32} />}
            </div>
          </div>
          <div className="mt-6 text-xs font-bold text-slate-500 bg-gray-100 inline-block px-4 py-1.5 rounded-full">
            {isGrading ? 'نظام التصحيح الآلي' : 'جاهز للطباعة'}
          </div>
        </div>

        {/* Card 3: Observers or Grades */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-b-4 border-gray-100 group border-t border-l border-r hover:border-gold/30 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-slate-400 text-sm mb-2 uppercase tracking-[0.2em] font-black group-hover:text-indigo-600 transition-colors">
                {isGrading ? 'مركز الإشعارات' : 'الكادر التعليمي'}
              </h3>
              <p className="text-6xl font-black text-slate-900">
                {isGrading ? '-' : stats.observers}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-2xl text-slate-400 group-hover:text-indigo-600 transition-colors">
                {isGrading ? <Send size={32} /> : <UserCheck size={32} />}
            </div>
          </div>
          <div className="mt-6 text-xs font-bold text-slate-500 bg-gray-100 inline-block px-4 py-1.5 rounded-full">
            {isGrading ? 'نتائج الطلاب' : 'نظام الحضور'}
          </div>
        </div>
      </div>

      {stats.students === 0 && (
        <div className="bg-white p-10 rounded-[2.5rem] flex gap-8 items-center animate-pop-in border border-gray-100 shadow-xl">
          <div className="w-20 h-20 bg-gold rounded-3xl flex items-center justify-center flex-shrink-0 shadow-[0_10px_30px_rgba(212,175,55,0.3)] text-white">
            <AlertTriangle size={40} />
          </div>
          <div>
            <h4 className="font-black text-slate-900 text-2xl mb-2 italic tracking-tight">نخبة الشمال بانتظار المدخلات...</h4>
            <p className="text-slate-500 text-lg font-medium leading-relaxed max-w-2xl">
              النظام جاهز للعمل. يرجى البدء بعملية <span className="text-indigo-600 font-bold underline decoration-gold/50">الاستيراد الملكي</span> للطلاب لتنشيط أدوات {isGrading ? 'الرصد والتصحيح' : 'توزيع اللجان'}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const Header = () => {
  const [config, setConfig] = React.useState(null);

  React.useEffect(() => {
    getAppSettings().then(setConfig);
  }, []);

  return (
    <header className="h-24 px-10 flex items-center justify-between sticky top-0 z-40 bg-white/80 border-b border-gray-100 backdrop-blur-xl shadow-sm">
      <div className="flex items-center gap-4">
        <div className="w-1.5 h-8 bg-gold rounded-full"></div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tighter">منصة <span className="gold-text">نخبة الشمال</span></h1>
      </div>
      <div className="flex items-center space-x-8 space-x-reverse">
        <div className="flex flex-col items-end">
          <span className="text-[11px] text-gold font-black uppercase tracking-[0.25em]">مدير المدرسة</span>
          <span className="text-base font-bold text-slate-800">{config?.managerName || 'الأستاذ محمد نصر الدين'}</span>
        </div>
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 border-2 border-indigo-100 shadow-sm flex items-center justify-center text-xl font-black text-indigo-600 transform hover:rotate-6 transition-all cursor-pointer">
          {config?.managerName ? config.managerName.charAt(0) : 'م'}
        </div>
      </div>
    </header>
  );
};



function App() {
  const [activeSystem, setActiveSystem] = React.useState(localStorage.getItem('activeSystem'));

  const handleSystemSelect = (system) => {
    localStorage.setItem('activeSystem', system);
    setActiveSystem(system);
  };

  if (!activeSystem) {
    return <SystemSelector onSelect={handleSystemSelect} />;
  }

  return (
    <Router>
      <div className="min-h-screen flex" dir="rtl">
        <Sidebar 
          className="z-50" 
          activeSystem={activeSystem} 
          onSwitchSystem={() => setActiveSystem(null)} 
        />
        <main className="flex-1 mr-64 min-h-screen relative">
          <Header />

          <div className="p-4 sm:p-6 lg:p-10 pb-24">
            <Routes>
              <Route path="/" element={<Dashboard activeSystem={activeSystem} />} />
              {/* Grading System Routes */}
              {activeSystem === 'grading' ? (
                <>
                  <Route path="/students" element={<StudentList />} />
                  <Route path="/omr-scanner" element={<OMRScanner />} />
                  <Route path="/omr-exams" element={<OMRExams />} />
                  <Route path="/omr-results" element={<OMRResults />} />
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
    </Router>
  );
}

export default App;
