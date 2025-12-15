import { useState } from 'react';
import CalendarDemand from './CalendarDemand';
import PlanningGrid from './PlanningGrid';
import OrderActionLog from './OrderActionLog';

import BulkImportModal from '../procurement/BulkImportModal';
import { useProcurement } from '../../context/ProcurementContext';
import SupplierEmailModal from '../procurement/SupplierEmailModal';
import YMSExportModal from '../procurement/YMSExportModal'; // NEW
import ProcurementMasterList from '../procurement/ProcurementMasterList'; // NEW
import { useSettings } from '../../context/SettingsContext';
import MorningReconciliationModal from './MorningReconciliationModal';
import BurnDownChart from './BurnDownChart';
import { PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { formatLocalDate, getLocalISOString } from '../../utils/dateUtils';

import { useMRPSolver } from '../../hooks/mrp/useMRPSolver';
import { useProducts } from '../../context/ProductsContext';
import PlanningGridWorkbench from './PlanningGridWorkbench';

export default function MRPView({ state, setters, results }) {
    const { bottleSizes, leadTimeDays, schedulerSettings } = useSettings();
    const { productMap: bottleDefinitions } = useProducts();
    const { user } = useAuth();
    const { solve } = useMRPSolver();
    const { poManifest } = useProcurement();

    const handleAutoBalance = () => {
        if (!confirm("Auto-Balance will populate Planned Loads to ensure safety stock is met. Proceed?")) return;

        const { newInbound, updatesCount } = solve(
            results,
            6, // Default Safety Stock Loads (fallback) or derived from settings
            bottleDefinitions,
            state.selectedSize,
            schedulerSettings,
            state
        ) || {};

        if (updatesCount > 0) {
            setters.setMonthlyInbound(newInbound);
            // alert(`Auto-Balanced: Added trucks to ${updatesCount} days.`);
        } else {
            alert("Schedule is already balanced! No changes needed.");
        }
    };

    // ... existing state ...
    const [isEditingFloor, setIsEditingFloor] = useState(false);
    const [isEditingYard, setIsEditingYard] = useState(false);

    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isEmailOpen, setIsEmailOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isMasterListOpen, setIsMasterListOpen] = useState(false);
    const [viewMode, setViewMode] = useState('grid');
    const [isReconcileOpen, setIsReconcileOpen] = useState(false);

    if (!results) return <div>Loading...</div>;

    const { netInventory, safetyTarget, trucksToOrder, trucksToCancel, specs, yardInventory } = results;
    const weeklyDemandBottles = state.totalScheduledCases * specs.bottlesPerCase;
    const fmt = (n) => n ? n.toLocaleString() : '0';

    // --- Sub-Component Renders ---

    const renderKPIs = () => {
        const palletsPerTruck = (specs.bottlesPerTruck / specs.bottlesPerCase) / (specs.casesPerPallet || 1);
        const totalOnHandPallets = Math.round(results.calculatedPallets + (results.yardInventory.effectiveCount * palletsPerTruck));
        const daysOfSupply = results.daysOfSupply !== undefined ? results.daysOfSupply : 0;
        const criticalThreshold = leadTimeDays || 2;
        const warningThreshold = criticalThreshold + 2;

        let runwayStatus = 'Healthy';
        let runwayColor = 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-300';

        if (daysOfSupply <= criticalThreshold) {
            runwayStatus = 'CRITICAL';
            runwayColor = 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/40 dark:border-red-800 dark:text-red-300 animate-pulse';
        } else if (daysOfSupply <= warningThreshold) {
            runwayStatus = 'Warning';
            runwayColor = 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/40 dark:border-amber-800 dark:text-amber-300';
        }

        const stockoutDateObj = results.firstStockoutDate ? new Date(results.firstStockoutDate) : null;
        const stockoutLabel = stockoutDateObj
            ? `${stockoutDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
            : 'Stable';

        const todayVal = new Date().setHours(0, 0, 0, 0);
        const actionableTrucks = Object.entries(results.plannedOrders || {})
            .filter(([dateStr]) => new Date(dateStr).setHours(0, 0, 0, 0) <= todayVal)
            .reduce((sum, [_, order]) => sum + order.count, 0);

        const displayTrucks = state.isAutoReplenish ? actionableTrucks : results.trucksToOrder;

        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* KPI 1: MATERIALS HEALTH */}
                <div className={`p-5 rounded-xl border-2 shadow-sm flex flex-col justify-between ${runwayColor}`}>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider opacity-90">Coverage Health</h3>
                        {runwayStatus === 'CRITICAL' && <span className="text-xl">🚨</span>}
                        {runwayStatus === 'Healthy' && <span className="text-xl">✅</span>}
                    </div>
                    <div>
                        <div className="text-3xl font-black tracking-tight">{runwayStatus}</div>
                        <div className="text-sm font-medium opacity-80 mt-1">
                            {runwayStatus === 'CRITICAL'
                                ? `Empty by ${stockoutLabel}`
                                : runwayStatus === 'Warning'
                                    ? 'Approaching Safety Stock Limit'
                                    : 'Inventory Levels Optimal'}
                        </div>
                    </div>
                </div>

                {/* KPI 2: RUNWAY */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Runway</h3>
                        <div className="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                            Target: {safetyTarget ? Math.round(safetyTarget / (specs.bottlesPerCase * (specs.casesPerPallet || 1))) : '-'} plts
                        </div>
                    </div>
                    <div className="flex items-end space-x-3">
                        <div className="text-4xl font-mono font-bold text-gray-800 dark:text-white leading-none">
                            {daysOfSupply >= 30 ? '30+' : daysOfSupply.toFixed(1)}
                        </div>
                        <div className="text-sm font-medium text-gray-400 mb-1">Days</div>
                    </div>
                    <div className="mt-3 text-xs font-medium text-gray-500 flex justify-between items-center border-t pt-2 dark:border-gray-700">
                        <span>Current On-Hand</span>
                        <span className="font-bold text-gray-700 dark:text-gray-300">{fmt(totalOnHandPallets)} Pallets</span>
                    </div>
                </div>

                {/* KPI 3: REPLENISHMENT */}
                <div className={`p-5 rounded-xl border flex flex-col justify-between shadow-sm transition-all ${displayTrucks > 0
                    ? 'bg-blue-600 border-blue-700 text-white'
                    : results.trucksToCancel > 0
                        ? 'bg-orange-100 border-orange-200 text-orange-900 dark:bg-orange-900/40 dark:border-orange-800 dark:text-orange-200'
                        : (runwayStatus === 'CRITICAL' ? 'bg-red-50 border-red-200' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700')
                    }`}>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className={`text-xs font-bold uppercase tracking-wider ${displayTrucks > 0 ? 'text-blue-100' : 'text-gray-400'}`}>
                            Replenishment
                        </h3>
                        {displayTrucks > 0 && <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>}
                        {results.trucksToCancel > 0 && !displayTrucks && <span className="text-xl">📉</span>}
                    </div>

                    {displayTrucks > 0 ? (
                        <div>
                            <div className="flex items-baseline space-x-2">
                                <span className="text-4xl font-black leading-none">{displayTrucks}</span>
                                <span className="text-sm font-bold opacity-90">Trucks Needed</span>
                            </div>
                            <p className="text-xs opacity-80 mt-2 font-medium">
                                {state.isAutoReplenish ? 'Planned orders due today.' : 'Deficit based on target.'}
                            </p>
                        </div>
                    ) : results.trucksToCancel > 0 ? (
                        <div>
                            <div className="flex items-baseline space-x-2">
                                <span className="text-4xl font-black leading-none">{results.trucksToCancel}</span>
                                <span className="text-sm font-bold opacity-90">Cancel Trucks</span>
                            </div>
                            <p className="text-xs opacity-80 mt-2 font-medium">
                                Excess inventory confirmed.
                            </p>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-baseline space-x-2">
                                {runwayStatus === 'CRITICAL' ? (
                                    <span className="text-2xl font-bold leading-none text-red-600">Expedite!</span>
                                ) : (
                                    <span className="text-3xl font-bold leading-none text-gray-800 dark:text-white">Standby</span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                {runwayStatus === 'CRITICAL'
                                    ? 'Stockout imminent. Review schedule.'
                                    : 'No immediate orders due.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Sidebar removed in favor of PulseHUD (Unification)

    return (
        <div className="max-w-full mx-auto pb-12">

            {/* NEW HEADER with SKU Selector */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 sticky top-0 z-20 backdrop-filter backdrop-blur-lg bg-opacity-90 dark:bg-opacity-90">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>📦</span> Materials Planner
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Command Center</p>
                </div>

                <div className="flex flex-wrap items-center mt-4 md:mt-0 gap-2">




                    <button
                        onClick={() => setIsReconcileOpen(true)}
                        className="flex items-center text-orange-600 dark:text-orange-400 hover:text-orange-800 bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100 px-3 py-2 rounded-lg font-medium text-sm transition-colors"
                    >
                        ☀️ Morning True-Up
                    </button>



                    <button
                        onClick={handleAutoBalance}
                        className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-indigo-200"
                        title="Auto-fill Planned Loads to meet Safety Stock"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                        </svg>
                        Auto-Balance
                    </button>

                    <button
                        onClick={() => setIsImportOpen(true)}
                        className="flex items-center text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 px-3 py-2 rounded-lg font-medium text-sm transition-colors"
                    >
                        📥 Import POs
                    </button>

                    <button
                        onClick={() => setIsMasterListOpen(true)}
                        className="flex items-center text-purple-600 dark:text-purple-400 hover:text-purple-800 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 px-3 py-2 rounded-lg font-medium text-sm transition-colors"
                    >
                        📋 Manage POs
                    </button>

                    <button
                        onClick={() => setIsEmailOpen(true)}
                        className="flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 px-3 py-2 rounded-lg font-medium text-sm transition-colors"
                    >
                        ✉️ Email
                    </button>


                </div>
            </div>

            {/* KPI ROW */}
            {renderKPIs()}

            {/* MAIN COMMAND CENTER */}
            <div className="flex flex-col space-y-6">

                {/* 2. MAIN PLANNING GRID (FULL WIDTH) with Unified Header */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden min-h-[600px]">

                    {/* Unified Header */}
                    <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center bg-gray-50 dark:bg-gray-900/50 gap-4">

                        {/* Title Section */}
                        <div className="flex items-center space-x-3">
                            <h3 className="font-bold text-gray-800 dark:text-white flex items-center text-sm uppercase tracking-wide">
                                Activity Ledger
                            </h3>
                            <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 font-mono">
                                30 Days
                            </span>
                        </div>

                        {/* Controls Section (Merged) */}
                        <div className="flex items-center gap-6">
                            {/* Inventory Auto-Pilot Toggle */}
                            <label className="flex items-center cursor-pointer group" title="Auto-Pilot: Automatically suggests truck orders to maintain safety stock.">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={state.isAutoReplenish || false}
                                        onChange={(e) => setters.setIsAutoReplenish(e.target.checked)}
                                    />
                                    <div className={`block w-9 h-5 rounded-full transition-colors ${state.isAutoReplenish ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${state.isAutoReplenish ? 'transform translate-x-4' : ''}`}></div>
                                </div>
                                <span className={`ml-2 text-xs font-bold uppercase tracking-wide ${state.isAutoReplenish ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500'}`}>
                                    {state.isAutoReplenish ? 'Auto-Pilot' : 'Manual'}
                                </span>
                            </label>

                            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 hidden md:block"></div>

                            {/* View Switchers */}
                            <div className="flex bg-white dark:bg-gray-700 p-1 rounded-md shadow-sm border border-gray-200 dark:border-gray-600">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${viewMode === 'grid' ? 'bg-blue-100 text-blue-700 dark:bg-slate-600 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                                >
                                    Standard
                                </button>
                                <button
                                    onClick={() => setViewMode('workbench')}
                                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${viewMode === 'workbench' ? 'bg-blue-100 text-blue-700 dark:bg-slate-600 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                                >
                                    Workbench
                                </button>
                                <button
                                    onClick={() => setViewMode('calendar')}
                                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${viewMode === 'calendar' ? 'bg-blue-100 text-blue-700 dark:bg-slate-600 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                                >
                                    Calendar
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden relative bg-white dark:bg-gray-800">
                        {viewMode === 'calendar' ? (
                            <div className="h-full p-4 overflow-auto">
                                <CalendarDemand
                                    monthlyDemand={state.monthlyDemand || {}}
                                    updateDateDemand={setters.updateDateDemand}
                                    monthlyInbound={state.monthlyInbound || {}}
                                    updateDateInbound={setters.updateDateInbound}
                                    monthlyProductionActuals={state.monthlyProductionActuals || {}}
                                    updateDateActual={setters.updateDateActual}
                                    specs={results?.specs}
                                    trucksToCancel={results?.trucksToCancel}
                                    dailyLedger={results?.dailyLedger}
                                    safetyTarget={results?.safetyTarget}
                                    poManifest={poManifest}
                                />
                            </div>
                        ) : viewMode === 'workbench' ? (
                            <PlanningGridWorkbench
                                monthlyDemand={state.monthlyDemand || {}}
                                updateDateDemand={setters.updateDateDemand}
                                monthlyInbound={state.monthlyInbound || {}}
                                monthlyProductionActuals={state.monthlyProductionActuals || {}}
                                updateDateActual={setters.updateDateActual}
                                specs={results?.specs}
                                dailyLedger={results?.dailyLedger}
                                userProfile={user}
                            />
                        ) : (
                            <PlanningGrid
                                monthlyDemand={state.monthlyDemand || {}}
                                updateDateDemand={setters.updateDateDemand}
                                updateDateDemandBulk={setters.updateDateDemandBulk}
                                monthlyInbound={state.monthlyInbound || {}}
                                updateDateInbound={setters.updateDateInbound}
                                monthlyProductionActuals={state.monthlyProductionActuals || {}}
                                updateDateActual={setters.updateDateActual}
                                specs={results?.specs}
                                safetyTarget={results?.safetyTarget}
                                dailyLedger={results?.dailyLedger}
                                userProfile={user}
                            />
                        )}
                    </div>
                </div>

                {/* CHARTS SECTION (Full Width) */}
                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <BurnDownChart
                        currentInventoryBottles={results.netInventory + weeklyDemandBottles}
                        weeklyDemandBottles={weeklyDemandBottles}
                        safetyStockBottles={safetyTarget}
                    />
                </div>
            </div>

            {/* MODALS */}


            <MorningReconciliationModal
                isOpen={isReconcileOpen}
                onClose={() => setIsReconcileOpen(false)}
                state={state}
                setters={setters}
            />

            <BulkImportModal
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
            />

            <SupplierEmailModal
                isOpen={isEmailOpen}
                onClose={() => setIsEmailOpen(false)}
                mrpResults={results}
            />

            <YMSExportModal
                isOpen={isExportOpen}
                onClose={() => setIsExportOpen(false)}
            />

            <ProcurementMasterList
                isOpen={isMasterListOpen}
                onClose={() => setIsMasterListOpen(false)}
            />
        </div>
    );
}
