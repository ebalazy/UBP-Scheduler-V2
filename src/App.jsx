import { useState } from 'react';
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
import { useEffect } from 'react';


import LandingPage from './components/LandingPage';
import CockpitView from './components/cockpit/CockpitView';

export default function App() {
  const [activeTab, setActiveTab] = useState('mrp'); // 'mrp' | 'scheduler'
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Cloud Sync / Migration
  const { user, loading } = useAuth(); // Destruct loading state
  const { uploadLocalData } = useSupabaseSync();
  const { bottleSizes } = useSettings();

  useEffect(() => {
    if (user) {
      uploadLocalData(user, bottleSizes);
    }
  }, [user, bottleSizes, uploadLocalData]);


  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 2. Unauthenticated State (Lockdown)
  if (!user) {
    return <LandingPage />;
  }

  // 3. Authenticated App
  // Hooks initialization should ideally be split, but for this level of app, 
  // keeping them here is fine as long as they don't crash without data. 
  // But strictly, we should componentize 'AuthenticatedApp' to avoid Hook Rule violations 
  // if we conditionally render before calling them.
  // HOWEVER, Hooks must be called unconditionally.
  // Splitting App into AuthenticatedApp is cleaner. Let's do a quick inline split.
  return <AuthenticatedApp user={user} />;
}

// Wrapper for Main App Logic to ensure Hooks run only when Auth is ready
function AuthenticatedApp({ user }) {
  const [activeTab, setActiveTab] = useState('mrp'); // 'mrp' | 'scheduler'
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const mrp = useMRP();
  const scheduler = useScheduler();
  const { bottleSizes } = useSettings();
  const masterSchedule = useMasterSchedule(bottleSizes);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Risk Banner - Always configured based on Scheduler data */}
      <RiskBanner
        isHighRisk={scheduler.results?.isHighRisk}
        safetyStockLoads={scheduler.results?.safetyStockLoads}
        requiredDailyLoads={scheduler.results?.requiredDailyLoads}
      />

      <main className="flex-grow p-4 md:p-6 max-w-7xl mx-auto w-full">
        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200 no-print overflow-x-auto">
          <nav className="-mb-px flex space-x-8 min-w-max" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('mrp')}
              className={`${activeTab === 'mrp'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg`}
            >
              Inventory & Ordering (MRP)
            </button>
            <button
              onClick={() => setActiveTab('scheduler')}
              className={`${activeTab === 'scheduler'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg`}
            >
              Scheduler
            </button>
            <button
              onClick={() => setActiveTab('master')}
              className={`${activeTab === 'master'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg flex items-center`}
            >
              <span className="mr-2">👑</span> Master Plan
            </button>
            <button
              onClick={() => setActiveTab('cockpit')}
              className={`${activeTab === 'cockpit'
                ? 'border-indigo-500 text-indigo-400 bg-gray-900 border-none rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-3 font-bold text-lg flex items-center ml-4 transition-all`}
            >
              <span className="mr-2">🚀</span> Cockpit (Beta)
            </button>
          </nav>
        </div>

        {/* View Content (Using hidden prop to preserve state) */}
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

        {/* Render Cockpit - Note: Cockpit has its own full-screen bg, so we might need to adjust container if active */}
        {activeTab === 'cockpit' && (
          <div className="absolute inset-0 z-10 top-[80px] bg-gray-900">
            <CockpitView />
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  );
}
