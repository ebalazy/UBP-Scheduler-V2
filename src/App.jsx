import { useState, useEffect } from 'react';
import Header from './components/Header';
import SettingsModal from './components/SettingsModal';
import RiskBanner from './components/RiskBanner';
import MRPView from './components/mrp/MRPView';
import SchedulerView from './components/scheduler/SchedulerView';
import { useMRP } from './hooks/useMRP';
import { useScheduler } from './hooks/useScheduler';
import { useMasterSchedule } from './hooks/useMasterSchedule';
import MasterScheduleView from './components/master/MasterScheduleView';
import { useSettings } from './context/SettingsContext';
import { useAuth } from './context/AuthContext';
import { useSupabaseSync } from './hooks/useSupabaseSync';
import LandingPage from './components/LandingPage';
import CockpitView from './components/cockpit/CockpitView';
import { Boxes, CalendarClock, Crown, Gauge } from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();
  const { uploadLocalData } = useSupabaseSync();
  const { bottleSizes } = useSettings();

  useEffect(() => {
    if (user) {
      uploadLocalData(user, bottleSizes);
    }
  }, [user, bottleSizes, uploadLocalData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return <AuthenticatedApp user={user} />;
}

function AuthenticatedApp({ user }) {
  const [activeTab, setActiveTab] = useState('mrp'); // 'mrp' | 'scheduler' | 'master' | 'cockpit'
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const mrp = useMRP();
  const scheduler = useScheduler();
  const { bottleSizes } = useSettings();
  const masterSchedule = useMasterSchedule(bottleSizes);

  return (
    <div id="main-app-wrapper" className="min-h-screen flex flex-col transition-colors duration-200">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Risk Banner - Always configured based on Scheduler data */}
      <RiskBanner
        isHighRisk={scheduler.results?.isHighRisk}
        safetyStockLoads={scheduler.results?.safetyStockLoads}
        requiredDailyLoads={scheduler.results?.requiredDailyLoads}
      />

      <main className="flex-grow p-4 md:p-6 max-w-7xl mx-auto w-full">
        {/* Modern Segmented Navigation */}
        <div className="mb-8 no-print overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="inline-flex p-1.5 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-inner min-w-full md:min-w-0">

            {/* MRP Tab */}
            <button
              onClick={() => setActiveTab('mrp')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex-1 md:flex-none justify-center whitespace-nowrap ${activeTab === 'mrp'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Inventory & MRP</span>
            </button>

            {/* Scheduler Tab */}
            <button
              onClick={() => setActiveTab('scheduler')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex-1 md:flex-none justify-center whitespace-nowrap ${activeTab === 'scheduler'
                  ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                }`}
            >
              <CalendarClock className="w-4 h-4" />
              <span>Scheduler</span>
            </button>

            {/* Master Plan Tab */}
            <button
              onClick={() => setActiveTab('master')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex-1 md:flex-none justify-center whitespace-nowrap ${activeTab === 'master'
                  ? 'bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                }`}
            >
              <Crown className="w-4 h-4" />
              <span>Master Plan</span>
            </button>

            {/* Divisor Line */}
            <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1 my-2 hidden md:block"></div>

            {/* Cockpit Tab */}
            <button
              onClick={() => setActiveTab('cockpit')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex-1 md:flex-none justify-center whitespace-nowrap ${activeTab === 'cockpit'
                  ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-md ring-1 ring-black/20'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                }`}
            >
              <Gauge className="w-4 h-4" />
              <span>Cockpit</span>
              {activeTab !== 'cockpit' && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-[10px] text-blue-700 dark:text-blue-300 font-extrabold uppercase tracking-wide">
                  Beta
                </span>
              )}
            </button>
          </div>
        </div>

        {/* View Content */}
        <div className={activeTab === 'mrp' ? 'block' : 'hidden'}>
          <MRPView
            state={mrp.formState}
            setters={mrp.setters}
            results={mrp.results}
          />
        </div>
        <div className={activeTab === 'scheduler' ? 'block' : 'hidden'}>
          <SchedulerView
            state={scheduler.formState}
            setters={scheduler.setters}
            results={scheduler.results}
          />
        </div>
        <div className={activeTab === 'master' ? 'block' : 'hidden'}>
          <MasterScheduleView
            masterLedger={masterSchedule.masterLedger}
            loading={masterSchedule.loading}
          />
        </div>

        <div className={activeTab === 'cockpit' ? 'block' : 'hidden'}>
          {/* Negative margins to expand cockpit to container edges */}
          <div className="-mx-4 md:-mx-6 -my-4 md:-my-6">
            <CockpitView mrpData={mrp} />
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  );
}
