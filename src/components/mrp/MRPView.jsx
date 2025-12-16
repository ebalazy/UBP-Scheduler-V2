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

export default function MRPView({ state, setters, results, readOnly = false }) {
    const { leadTimeDays, safetyStockLoads, schedulerSettings } = useSettings();
    const { productMap: bottleDefinitions } = useProducts();
    const bottleSizes = Object.keys(bottleDefinitions);

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

    // Determine Effective Lead Time
    // Global Migration: Check DB (via bottleDefinitions) first, then fallback to Global Setting
    const productSpec = state.selectedSize ? bottleDefinitions[state.selectedSize] : null;
    const effectiveLeadTime = productSpec?.leadTimeDays !== undefined && productSpec?.leadTimeDays !== null
        ? productSpec.leadTimeDays
        : (leadTimeDays || 2);

    const effectiveSafetyStockLoads = productSpec?.safetyStockLoads !== undefined && productSpec?.safetyStockLoads !== null
        ? Number(productSpec.safetyStockLoads)
        : (safetyStockLoads || 6);

    const handleAutoBalance = () => {
        if (!confirm(`Auto-Balance will populate Planned Loads to ensure safety stock is met.\n\nSettings:\n - Lead Time: ${effectiveLeadTime} days\n - Safety Stock: ${effectiveSafetyStockLoads} loads\n\nProceed?`)) return;

        const { newInbound, updatesCount } = solve(
            results,
            effectiveSafetyStockLoads, // Priority: Product > Global
            bottleDefinitions,
            state.selectedSize,
            schedulerSettings,
            state,
            effectiveLeadTime
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
        const criticalThreshold = effectiveLeadTime !== undefined ? Number(effectiveLeadTime) : (leadTimeDays || 2);
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

        // Parse safely to avoid UTC shift (e.g. "2023-12-15" -> Dec 14 7PM EST)
        const parseLocal = (dStr) => {
            const [y, m, d] = dStr.split('-').map(Number);
            return new Date(y, m - 1, d);
        };

        const stockoutDateObj = results.firstStockoutDate ? parseLocal(results.firstStockoutDate) : null;

        let stockoutLabel = 'Stable';
        if (stockoutDateObj) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (stockoutDateObj <= today) {
                stockoutLabel = 'NOW';
            } else {
                stockoutLabel = stockoutDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            }
        }

        const todayVal = new Date().setHours(0, 0, 0, 0);
        const actionableTrucks = Object.entries(results.plannedOrders || {})
            .filter(([dateStr]) => new Date(dateStr).setHours(0, 0, 0, 0) <= todayVal)
            .reduce((sum, [_, order]) => sum + order.count, 0);

        const displayTrucks = state.isAutoReplenish ? actionableTrucks : results.trucksToOrder;


        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                {/* KPI 1: MATERIALS HEALTH */}
                <div className={`p-3 rounded-lg border ${runwayColor} flex flex-col justify-between shadow-sm`}>
                    <div className="flex justify-between items-center mb-1">
                        <h3 className="text-[10px] font-bold uppercase tracking-wider opacity-70 text-gray-500 dark:text-gray-400">Coverage Health</h3>
                        {runwayStatus === 'CRITICAL' && <span className="text-lg">🚨</span>}
                        {runwayStatus === 'Healthy' && <CheckCircleIcon className="w-5 h-5 text-emerald-500" />}
                    </div>
                    <div>
                        <div className={`text-2xl font-black tracking-tight ${statusTextColor} leading-none`}>{runwayStatus}</div>
                        <div className="text-xs font-medium opacity-80 mt-1 dark:text-gray-300">
                            {runwayStatus === 'CRITICAL'
                                ? (stockoutLabel === 'NOW' ? 'Stockout Computed' : `Empty by ${stockoutLabel}`)
                                : runwayStatus === 'Warning'
                                    ? 'Approaching Safety Stock Limit'
                                    : 'Inventory Levels Optimal'}
                        </div>
                    </div>
                </div>

                {/* KPI 2: RUNWAY */}
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-1">
                        <h3 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Runway</h3>
                        <div className="text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                            Target: {safetyTarget ? Math.round(safetyTarget / (specs.bottlesPerCase * (specs.casesPerPallet || 1))) : '-'} plts
                        </div>
                    </div>
                    <div className="flex items-end space-x-2">
                        <div className="text-3xl font-mono font-bold text-gray-800 dark:text-white leading-none">
                            {daysOfSupply >= 30 ? '30+' : daysOfSupply.toFixed(1)}
                        </div>
                        <div className="text-xs font-medium text-gray-400 mb-0.5">Days</div>
                    </div>
                    <div className="mt-2 text-[10px] font-medium text-gray-500 flex justify-between items-center border-t pt-1 dark:border-gray-700">
                        <span>Current On-Hand</span>
                        <span className="font-bold text-gray-700 dark:text-gray-300">{fmt(totalOnHandPallets)} Pallets</span>
                    </div>
                </div>

                {/* KPI 3: REPLENISHMENT */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between shadow-sm transition-all ${displayTrucks > 0
                    ? 'bg-blue-600 border-blue-700 text-white'
                    : results.trucksToCancel > 0
                        ? 'bg-orange-100 border-orange-200 text-orange-900 dark:bg-orange-900/40 dark:border-orange-800 dark:text-orange-200'
                        : (runwayStatus === 'CRITICAL' ? 'bg-red-50 border-red-200' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700')
                    }`}>
                    <div className="flex justify-between items-center mb-1">
                        <h3 className={`text-[10px] font-bold uppercase tracking-wider ${displayTrucks > 0 ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                            Replenishment
                        </h3>
                        {displayTrucks > 0 && <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>}
                        {results.trucksToCancel > 0 && !displayTrucks && <span className="text-lg">📉</span>}
                    </div>

                    {displayTrucks > 0 ? (
                        <div>
                            <div className="flex items-baseline space-x-2">
                                <span className="text-3xl font-black leading-none">{displayTrucks}</span>
                                <span className="text-xs font-bold opacity-90">Trucks Needed</span>
                            </div>
                            <p className="text-[10px] opacity-80 mt-1 font-medium leading-tight">
                                {state.isAutoReplenish ? 'Planned orders due today.' : 'Deficit based on target.'}
                            </p>
                        </div>
                    ) : results.trucksToCancel > 0 ? (
                        <div>
                            <div className="flex items-baseline space-x-2">
                                <span className="text-3xl font-black leading-none">{results.trucksToCancel}</span>
                                <span className="text-xs font-bold opacity-90">Cancel Trucks</span>
                            </div>
                            <p className="text-[10px] opacity-80 mt-1 font-medium leading-tight">
                                Excess inventory confirmed.
                            </p>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-baseline space-x-2">
                                {runwayStatus === 'CRITICAL' ? (
                                    <span className="text-2xl font-bold leading-none text-red-600">Expedite!</span>
                                ) : (
                                    <span className="text-2xl font-bold leading-none text-gray-800 dark:text-white">Standby</span>
                                )}
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1 leading-tight">
                                {runwayStatus === 'CRITICAL'
                                    ? 'Stockout imminent. Review.'
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



            {/* KPI ROW */}
            {renderKPIs()}

            {/* MAIN COMMAND CENTER */}
            <div className="flex flex-col space-y-6">

                {/* MAIN PLANNING GRID (FULL WIDTH) with Unified Header */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">

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

                        {/* RIGHT: Controls - Consolidated Action Toolbar */}
                        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">

                            {/* Essential Actions Group */}
                            <div className="flex items-center gap-1 bg-white dark:bg-gray-700 p-1 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
                                {!readOnly && (
                                    <>
                                        <button onClick={() => setIsReconcileOpen(true)} className="p-1.5 text-gray-500 hover:text-orange-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors" title="Morning True-Up">
                                            <SunIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => setIsImportOpen(true)} className="p-1.5 text-gray-500 hover:text-emerald-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors" title="Import Inbound">
                                            <ArrowDownTrayIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => setIsMasterListOpen(true)} className="p-1.5 text-gray-500 hover:text-purple-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors" title="Manage POs">
                                            <ClipboardDocumentListIcon className="w-5 h-5" />
                                        </button>
                                    </>
                                )}
                                <button onClick={() => setIsEmailOpen(true)} className="p-1.5 text-gray-500 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors" title="Email Suppliers">
                                    <EnvelopeIcon className="w-5 h-5" />
                                </button>
                            </div>

                            {!readOnly && !state.isAutoReplenish && (
                                <button
                                    onClick={handleAutoBalance}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all"
                                    title="Manually calculate replenishment (Not needed in Auto-Pilot)"
                                >
                                    <ArrowPathIcon className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Auto-Balance</span>
                                </button>
                            )}

                            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 hidden md:block mx-1"></div>

                            {/* View Switchers */}
                            <div className="flex bg-white dark:bg-gray-700 p-1 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                                <button onClick={() => setViewMode('grid')} className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'grid' ? 'bg-blue-50 text-blue-700 dark:bg-slate-600 dark:text-blue-300 shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>Grid</button>
                                <button onClick={() => setViewMode('workbench')} className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'workbench' ? 'bg-blue-50 text-blue-700 dark:bg-slate-600 dark:text-blue-300 shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>Work</button>
                                <button onClick={() => setViewMode('calendar')} className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'calendar' ? 'bg-blue-50 text-blue-700 dark:bg-slate-600 dark:text-blue-300 shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>Cal</button>
                            </div>

                            {/* Auto-Pilot Toggle (Compact) */}
                            {!readOnly && (
                                <label className="flex items-center cursor-pointer group" title="Auto-Pilot Mode">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={state.isAutoReplenish || false}
                                            onChange={(e) => setters.setIsAutoReplenish(e.target.checked)}
                                        />
                                        <div className={`block w-7 h-4 rounded-full transition-colors ${state.isAutoReplenish ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-2 h-2 rounded-full transition-transform ${state.isAutoReplenish ? 'transform translate-x-3' : ''}`}></div>
                                    </div>
                                </label>
                            )}

                            {/* Export Button */}
                            <button
                                onClick={handleExportMonth}
                                className={`p-1.5 rounded-lg border transition-all ${copied
                                    ? 'bg-green-50 border-green-200 text-green-600'
                                    : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 hover:text-gray-700'
                                    }`}
                                title="Export 30-Day Plan"
                            >
                                {copied ? <CheckCircleIcon className="w-5 h-5" /> : <ClipboardDocumentListIcon className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden relative bg-slate-200 dark:bg-slate-900 rounded-xl shadow-lg border border-slate-300 dark:border-slate-800">
                        {viewMode === 'calendar' ? (
                            <div className="h-full p-4 overflow-auto">
                                <CalendarDemand
                                    monthlyDemand={state.monthlyDemand || {}}
                                    updateDateDemand={setters.updateDateDemand}
                                    updateDateDemandBulk={setters.updateDateDemandBulk}
                                    monthlyInbound={state.monthlyInbound || {}}
                                    updateDateInbound={setters.updateDateInbound}
                                    monthlyProductionActuals={state.monthlyProductionActuals || {}}
                                    updateDateActual={setters.updateDateActual}
                                    specs={results?.specs}
                                    trucksToCancel={results?.trucksToCancel}
                                    dailyLedger={results?.dailyLedger}
                                    safetyTarget={results?.safetyTarget}
                                    poManifest={poManifest}
                                    readOnly={readOnly}
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
                                readOnly={readOnly}
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
                                readOnly={readOnly}
                            />
                        )}
                    </div>
                </div>

                {/* CHARTS SECTION (Full Width) */}
                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <BurnDownChart
                        dailyLedger={results.dailyLedger}
                        safetyTargetBottles={results.safetyTarget}
                        specs={results.specs}
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
