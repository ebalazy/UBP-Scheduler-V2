import { useState, useEffect } from 'react';
import Header from './components/Header';
import SettingsModal from './components/SettingsModal';
import ubpLogo from './assets/ubp_logo_v2.png';

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
import LogisticsView from './components/logistics/LogisticsView';
import ProductsView from './components/products/ProductsView';
import CSVImport from './components/data/CSVImport';
import { Boxes, CalendarClock, Crown, Gauge, Truck, Package } from 'lucide-react';
import PulseHUD from './components/dashboard/PulseHUD';
import MobileBottomNav from './components/MobileBottomNav';

import { ProcurementProvider, useProcurement } from './context/ProcurementContext';

import { useProducts } from './context/ProductsContext'; // Import Hook

export default function App() {
  const { user, loading, userRole } = useAuth();
  const { uploadLocalData } = useSupabaseSync();
  // const { bottleSizes } = useSettings(); // REMOVED
  const { productMap } = useProducts();
  const bottleSizes = Object.keys(productMap);

  useEffect(() => {
    if (user) {
      uploadLocalData(user, bottleSizes, userRole);
    }
  }, [user, bottleSizes, uploadLocalData, userRole]);

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
    <ProcurementProvider>
      <AuthenticatedApp user={user} />
    </ProcurementProvider>
  );
}

function AuthenticatedApp({ user }) {
  const { userRole } = useAuth();
  // Safe Fallback: If no role found (first run), default to 'admin' so dev isn't locked out. 
  // In Prod, this should default to 'viewer'.
  const role = userRole || 'admin';

  const showPlanning = ['admin', 'planner'].includes(role);
  const canEditLogistics = ['admin', 'planner', 'logistics'].includes(role);

  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'logistics');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Security Redirect
    if ((activeTab === 'mrp' || activeTab === 'master') && !showPlanning) {
      setActiveTab('logistics');
    }
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab, showPlanning]);

  const { poManifest } = useProcurement();
  const mrp = useMRP(poManifest);
  const scheduler = useScheduler();
  const { activeSku } = useSettings();
  const { productMap } = useProducts();
  const bottleSizes = Object.keys(productMap);
  const masterSchedule = useMasterSchedule(bottleSizes, activeTab === 'master');

  return (
    <div id="main-app-wrapper" className="min-h-screen flex flex-col transition-colors duration-200 bg-slate-300 dark:bg-slate-900">
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        isSaving={mrp.formState.isSaving}
        saveError={mrp.formState.saveError}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="flex-grow p-2 md:p-6 w-full pt-4">

        {/* PULSE DASHBOARD (HUD) - Contextual */}
        {['logistics', 'mrp', 'scheduler'].includes(activeTab) && (
          <PulseHUD
            mrp={mrp}
            scheduler={scheduler}
            activeSku={activeSku}
          />
        )}

        {/* View Content */}
        <div className={activeTab === 'logistics' ? 'block' : 'hidden'}>
          <LogisticsView
            state={mrp.formState}
            setters={mrp.setters}
            results={mrp.results}
            readOnly={!canEditLogistics}
          />
        </div>

        <div className={activeTab === 'mrp' ? 'block' : 'hidden'}>
          <MRPView
            state={mrp.formState}
            setters={mrp.setters}
            results={mrp.results}
            readOnly={!showPlanning}
          />
        </div>
        <div className={activeTab === 'scheduler' ? 'block' : 'hidden'}>
          <SchedulerView
            state={scheduler.formState}
            setters={scheduler.setters}
            results={scheduler.results}
            readOnly={!canEditLogistics}
          />
        </div>
        <div className={activeTab === 'master' ? 'block' : 'hidden'}>
          <MasterScheduleView
            masterLedger={masterSchedule.masterLedger}
            loading={masterSchedule.loading}
          />
        </div>

        <div className={activeTab === 'products' ? 'block' : 'hidden'}>
          <ProductsView readOnly={!canEditLogistics} />
        </div>

        <div className={activeTab === 'import' ? 'block' : 'hidden'}>
          <CSVImport onImportComplete={mrp.refreshData} />
        </div>

      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
      />
    </div>
  );
}
