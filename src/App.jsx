import { useState, useEffect } from 'react';
import Header from './components/Header';
import SettingsModal from './components/SettingsModal';
import ubpLogo from './assets/ubp_logo.jpg';

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
import LogisticsView from './components/logistics/LogisticsView';
import ProductsView from './components/products/ProductsView';
import { Boxes, CalendarClock, Crown, Gauge, Truck, Package } from 'lucide-react';
import PulseHUD from './components/dashboard/PulseHUD';

import { ProcurementProvider, useProcurement } from './context/ProcurementContext';

import { ProductsProvider } from './context/ProductsContext';

export default function App() {
  const { user, loading } = useAuth();
  const { uploadLocalData } = useSupabaseSync();
  const { bottleSizes } = useSettings();

  useEffect(() => {
    if (user) {
      uploadLocalData(user, bottleSizes);
    }
  }, [user, bottleSizes, uploadLocalData]);

  useEffect(() => {
    document.title = `UBP Planner v${import.meta.env.PACKAGE_VERSION}`;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 transition-colors">
        <div className="flex flex-col items-center">
          <div className="h-24 w-24 bg-white rounded-full shadow-2xl shadow-blue-500/20 flex items-center justify-center overflow-hidden animate-pulse">
            <img src={ubpLogo} className="h-[95%] w-[95%] object-contain" alt="Loading..." />
          </div>
          <div className="mt-6 text-slate-400 font-extrabold tracking-[0.2em] uppercase text-xs animate-pulse">
            Loading Planner...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <ProductsProvider>
      <ProcurementProvider>
        <AuthenticatedApp user={user} />
      </ProcurementProvider>
    </ProductsProvider>
  );
}

function AuthenticatedApp({ user }) {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'logistics');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const { poManifest } = useProcurement();
  const mrp = useMRP(poManifest);
  const scheduler = useScheduler();
  const { bottleSizes, activeSku } = useSettings();
  const masterSchedule = useMasterSchedule(bottleSizes);

  return (
    <div id="main-app-wrapper" className="min-h-screen flex flex-col transition-colors duration-200">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} isSaving={mrp.formState.isSaving} saveError={mrp.formState.saveError} />



      <main className="flex-grow p-2 md:p-6 w-full">

        {/* PULSE DASHBOARD (HUD) */}
        <PulseHUD
          mrp={mrp}
          scheduler={scheduler}
          activeSku={activeSku}
        />

        {/* Modern Segmented Navigation */}
        <div className="mb-8 no-print overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="inline-flex p-1.5 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-inner min-w-full md:min-w-0">

            {/* Floor Ops (Logistics) Tab - NEW */}
            <button
              onClick={() => setActiveTab('logistics')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex-1 md:flex-none justify-center whitespace-nowrap ${activeTab === 'logistics'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                }`}
            >
              <Truck className="w-4 h-4" />
              <span>Floor Ops</span>
            </button>

            {/* MRP Tab */}
            <button
              onClick={() => setActiveTab('mrp')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex-1 md:flex-none justify-center whitespace-nowrap ${activeTab === 'mrp'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Materials</span>
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

            {/* Products Tab - NEW */}
            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex-1 md:flex-none justify-center whitespace-nowrap ${activeTab === 'products'
                ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                }`}
            >
              <Package className="w-4 h-4" />
              <span>Products</span>
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
        <div className={activeTab === 'logistics' ? 'block' : 'hidden'}>
          <LogisticsView
            state={mrp.formState}
            setters={mrp.setters}
            results={mrp.results}
          />
        </div>

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

        <div className={activeTab === 'products' ? 'block' : 'hidden'}>
          <ProductsView />
        </div>

        <div className={activeTab === 'cockpit' ? 'block' : 'hidden'}>
          {/* Negative margins to expand cockpit to container edges */}
          <div className="-mx-4 md:-mx-6 -my-4 md:-my-6">
            <CockpitView mrpData={mrp} schedulerData={scheduler} />
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
