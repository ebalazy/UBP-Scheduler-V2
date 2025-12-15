import { useState } from 'react';
import CalendarDemand from './CalendarDemand';
import PlanningGrid from './PlanningGrid';
import OrderActionLog from './OrderActionLog';

import BulkImportModal from '../procurement/BulkImportModal';
import { useProcurement } from '../../context/ProcurementContext';
import SupplierEmailModal from '../procurement/SupplierEmailModal';
import YMSExportModal from '../procurement/YMSExportModal';
import ProcurementMasterList from '../procurement/ProcurementMasterList';
import { useSettings } from '../../context/SettingsContext';
import MorningReconciliationModal from './MorningReconciliationModal';
import BurnDownChart from './BurnDownChart';
import {
    PencilSquareIcon,
    XMarkIcon,
    SunIcon,
    ArrowPathIcon,
    ArrowDownTrayIcon,
    ClipboardDocumentListIcon,
    EnvelopeIcon,
    CheckCircleIcon,
    ChevronLeftIcon,
    ChevronRightIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { formatLocalDate, getLocalISOString, addDays } from '../../utils/dateUtils';

import { useMRPSolver } from '../../hooks/mrp/useMRPSolver';
import { useProducts } from '../../context/ProductsContext';
import PlanningGridWorkbench from './PlanningGridWorkbench';

export default function MRPView({ state, setters, results }) {
    const { bottleSizes, leadTimeDays, schedulerSettings } = useSettings();
    const { productMap: bottleDefinitions } = useProducts();
    const { user } = useAuth();
    const { solve } = useMRPSolver();
    const { poManifest } = useProcurement();

    // -- Grid Navigation State --
    const [gridStartDate, setGridStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 3);
        return d;
    });

    const shiftDate = (days) => {
        setGridStartDate(prev => {
            const n = new Date(prev);
            n.setDate(n.getDate() + days);
            return n;
        });
    };

    const resetDate = () => {
        const d = new Date();
        d.setDate(d.getDate() - 3);
        setGridStartDate(d);
    };

    // -- Export Logic --
    const [copied, setCopied] = useState(false);
    const handleExportMonth = () => {
        const baseDate = formatLocalDate(new Date());
        let text = `Monthly Replenishment Plan - Generated ${new Date().toLocaleDateString()}\n`;
        text += `--------------------------------------------------\n\n`;

        const rate = results.specs?.productionRate || 0;
        const capacity = results.specs?.casesPerTruck || ((results.specs?.bottlesPerTruck || 20000) / (results.specs?.bottlesPerCase || 1));
        const [startH, startM] = (schedulerSettings?.shiftStartTime || '00:00').split(':').map(Number);
        const startDecimal = startH + (startM / 60);

        for (let i = 0; i < 30; i++) {
            const dateStr = addDays(baseDate, i);
            const count = Math.round(Number(state.monthlyInbound[dateStr] || 0));

            if (count > 0) {
                const [y, m, da] = dateStr.split('-').map(Number);
                const dateObj = new Date(y, m - 1, da);
                text += `DATE: ${dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric', year: 'numeric' })}\n`;
                text += `TRUCKS: ${count}\n`;

                if (rate > 0) {
                    const hoursPerTruck = capacity / rate;
                    for (let truckIdx = 0; truckIdx < count; truckIdx++) {
                        const arrivalDecimal = startDecimal + (truckIdx * hoursPerTruck);
                        const roundedH = Math.round(arrivalDecimal % 24) % 24;
                        const mins = Math.round((arrivalDecimal % 1) * 60);
                        const timeStr = `${roundedH}:${mins.toString().padStart(2, '0')}`;
                        text += `  - Truck ${truckIdx + 1}: Arrive approx ${timeStr}\n`;
                    }
                }
                text += `\n`;
            }
        }

        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            alert("Copied 30-Day Plan to Clipboard!");
        });
    };

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
        // Polished KPI Card Style (Suggestion #2)
        let runwayColor = 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm border-l-4 border-l-emerald-500';
        let statusTextColor = 'text-emerald-600 dark:text-emerald-400';

        if (daysOfSupply <= criticalThreshold) {
            runwayStatus = 'CRITICAL';
            runwayColor = 'bg-red-50 border-red-200 border-l-4 border-l-red-500 animate-pulse';
            statusTextColor = 'text-red-700';
        } else if (daysOfSupply <= warningThreshold) {
            runwayStatus = 'Warning';
            runwayColor = 'bg-amber-50 border-amber-200 border-l-4 border-l-amber-500';
            statusTextColor = 'text-amber-700';
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
                <div className={`p-5 rounded-xl border ${runwayColor} flex flex-col justify-between`}>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 text-gray-500 dark:text-gray-400">Coverage Health</h3>
                        {runwayStatus === 'CRITICAL' && <span className="text-xl">🚨</span>}
                        {runwayStatus === 'Healthy' && <CheckCircleIcon className="w-6 h-6 text-emerald-500" />}
                    </div>
                    <div>
                        <div className={`text-3xl font-black tracking-tight ${statusTextColor}`}>{runwayStatus}</div>
                        <div className="text-sm font-medium opacity-80 mt-1 dark:text-gray-300">
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
                        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Runway</h3>
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
                        <h3 className={`text-xs font-bold uppercase tracking-wider ${displayTrucks > 0 ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
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

    return (
        <div className="max-w-full mx-auto pb-12">

            {/* NEW HEADER with Premium Action Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 sticky top-0 z-20 backdrop-filter backdrop-blur-lg bg-opacity-90 dark:bg-opacity-90">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>📦</span> Materials Planner
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Command Center</p>
                </div>

                <div className="flex flex-wrap items-center mt-4 md:mt-0 gap-3">
                    <button
                        onClick={() => setIsReconcileOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-all shadow-sm"
                        title="Morning Inventory Check"
                    >
                        <SunIcon className="w-4 h-4 text-orange-500" />
                        Morning True-Up
                    </button>

                    <button
                        onClick={() => setIsImportOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-all shadow-sm"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4 text-emerald-500" />
                        Import
                    </button>

                    <button
                        onClick={() => setIsMasterListOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-all shadow-sm"
                    >
                        <ClipboardDocumentListIcon className="w-4 h-4 text-purple-500" />
                        POs
                    </button>

                    <button
                        onClick={() => setIsEmailOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-all shadow-sm"
                    >
                        <EnvelopeIcon className="w-4 h-4 text-gray-500" />
                        Email
                    </button>

                    <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 mx-1 hidden md:block"></div>

                    <button
                        onClick={handleAutoBalance}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-md transition-all"
                    >
                        <ArrowPathIcon className="w-4 h-4" />
                        Auto-Balance
                    </button>
                </div>
            </div>

            {/* KPI ROW */}
            {renderKPIs()}

            {/* MAIN COMMAND CENTER */}
            <div className="flex flex-col space-y-6">

                {/* MAIN PLANNING GRID (FULL WIDTH) with Unified Header */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden min-h-[600px]">

                    {/* Unified Header with Date Nav */}
                    <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-col lg:flex-row justify-between items-center bg-gray-50 dark:bg-gray-900/50 gap-4">

                        {/* LEFT: Title & Date Range */}
                        <div className="flex items-center gap-4 w-full lg:w-auto">
                            <div className="flex bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-0.5">
                                <button onClick={() => shiftDate(-7)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-500 transition-colors" title="Previous Week">
                                    <ChevronLeftIcon className="w-4 h-4" />
                                </button>
                                <button onClick={resetDate} className="px-3 py-1 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border-x border-gray-100 dark:border-gray-700 mx-0.5 transition-colors">
                                    Today
                                </button>
                                <button onClick={() => shiftDate(7)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-500 transition-colors" title="Next Week">
                                    <ChevronRightIcon className="w-4 h-4" />
                                </button>
                            </div>
                            <span className="text-xs font-medium text-gray-400 hidden sm:block">
                                {gridStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {addDays(formatLocalDate(gridStartDate), 6).split('-').slice(1).join('/')}
                            </span>
                        </div>

                        {/* RIGHT: Controls */}
                        <div className="flex items-center gap-6 w-full lg:w-auto justify-end">

                            {/* Auto-Pilot */}
                            <label className="flex items-center cursor-pointer group" title="Auto-Pilot">
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

                            <div className="h-5 w-px bg-gray-300 dark:bg-gray-600 hidden md:block"></div>

                            {/* View Switchers */}
                            <div className="flex bg-white dark:bg-gray-700 p-1 rounded-md shadow-sm border border-gray-200 dark:border-gray-600">
                                <button onClick={() => setViewMode('grid')} className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${viewMode === 'grid' ? 'bg-blue-50 text-blue-700 dark:bg-slate-600 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100'}`}>Standard</button>
                                <button onClick={() => setViewMode('workbench')} className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${viewMode === 'workbench' ? 'bg-blue-50 text-blue-700 dark:bg-slate-600 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100'}`}>Workbench</button>
                                <button onClick={() => setViewMode('calendar')} className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${viewMode === 'calendar' ? 'bg-blue-50 text-blue-700 dark:bg-slate-600 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100'}`}>Calendar</button>
                            </div>

                            {/* Export Button */}
                            <button
                                onClick={handleExportMonth}
                                className={`ml-2 p-1.5 rounded-md border transition-all ${copied
                                    ? 'bg-green-50 border-green-200 text-green-600'
                                    : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 hover:text-gray-700'
                                    }`}
                                title="Export 30-Day Plan"
                            >
                                {copied ? <CheckCircleIcon className="w-5 h-5" /> : <ClipboardDocumentListIcon className="w-5 h-5" />}
                            </button>
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
                                startDate={gridStartDate}
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
                                startDate={gridStartDate}
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
