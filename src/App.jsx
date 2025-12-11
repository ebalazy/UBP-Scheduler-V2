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


export default function App() {
  const [activeTab, setActiveTab] = useState('mrp'); // 'mrp' | 'scheduler'
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Core Hooks (Lifted to App level for shared state/persistence/alerts)
  const mrp = useMRP();
  const scheduler = useScheduler();
  // We need bottleSizes for Master Schedule
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
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
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
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  );
}
