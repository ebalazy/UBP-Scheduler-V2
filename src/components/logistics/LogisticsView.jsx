import { useState, useEffect, useMemo } from 'react';
import { getLocalISOString, addDays } from '../../utils/dateUtils';
import { useSettings } from '../../context/SettingsContext';
import {
    TruckIcon,
    ClipboardDocumentCheckIcon,
    CubeIcon,
    CalendarDaysIcon
} from '@heroicons/react/24/outline';
import MorningReconciliationModal from '../mrp/MorningReconciliationModal';
import DockManifestParams from './DockManifestParams';
import { useProcurement } from '../../context/ProcurementContext';

export default function LogisticsView({ state, setters, results }) {
    const [isRecModalOpen, setIsRecModalOpen] = useState(false);
    const { bottleSizes } = useSettings();
    const [aggregatedSchedule, setAggregatedSchedule] = useState({ today: [], tomorrow: [] });
    const [filterSku, setFilterSku] = useState('ALL');

    if (!results) return <div className="p-8 text-center text-gray-500">Loading Logistics Data...</div>;

    const { specs, yardInventory } = results;
    const { poManifest, updateDailyManifest, bulkUpdateOrders } = useProcurement(); // Access Global POs
    const todayStr = getLocalISOString();

    // Calculate Tomorrow's Date (Local)
    const tomorrowStr = addDays(todayStr, 1);
    const tomorrowDateObj = new Date(tomorrowStr + 'T00:00:00'); // For display purposes

    // --- AGGREGATION LOGIC ---
    // --- AGGREGATION LOGIC ---
    useEffect(() => {
        try {
            // We need to read from LocalStorage directly because 'state' (useMRP) is scoped to ONE SKU.
            // This is a special "Executive Read" across all SKUs.

            const agg = { today: [], tomorrow: [] };

            bottleSizes.forEach(sku => {
                // 1. Read Inbound Count (Legacy Manual)
                const inboundKey = `mrp_${sku}_monthlyInbound`;
                let inboundMap = {};
                try {
                    const raw = localStorage.getItem(inboundKey);
                    if (raw) inboundMap = JSON.parse(raw);
                } catch (e) { }

                // 2. Read Local Dock Manifest (Detailed Schedule)
                const manifestKey = `mrp_${sku}_truckManifest`;
                let manifestMap = {};
                try {
                    const raw = localStorage.getItem(manifestKey);
                    if (raw) manifestMap = JSON.parse(raw);
                } catch (e) { }

                // 3. Get Global POs for this SKU (New!)
                const getGlobalPOs = (date) => {
                    try {
                        const dayData = poManifest[date];
                        if (!dayData || !dayData.items) return [];
                        // Filter items that match this SKU
                        return dayData.items.filter(item => item.sku === sku);
                    } catch (err) {
                        console.warn("Error reading global POs for date:", date, err);
                        return [];
                    }
                };

                const globalToday = getGlobalPOs(todayStr);
                const globalTomorrow = getGlobalPOs(tomorrowStr);

                // 4. Check Today
                const savedTodayCount = Number(inboundMap[todayStr]) || 0;
                const todayLocalManifest = manifestMap[todayStr] || [];

                const mappedGlobalToday = globalToday.map(po => ({
                    id: po.id,
                    time: po.time,
                    carrier: po.carrier || po.supplier,
                    type: 'PO',
                    po: po.po,
                    details: `PO#${po.po} (${po.qty})`,
                    isGlobal: true
                }));

                const combinedTodayManifest = [...todayLocalManifest, ...mappedGlobalToday];
                const effectiveTodayCount = Math.max(savedTodayCount, combinedTodayManifest.length);

                if (effectiveTodayCount > 0 || combinedTodayManifest.length > 0) {
                    agg.today.push({
                        sku,
                        count: effectiveTodayCount,
                        manifest: combinedTodayManifest
                    });
                }

                // 5. Check Tomorrow
                const savedTmrCount = Number(inboundMap[tomorrowStr]) || 0;
                const tmrLocalManifest = manifestMap[tomorrowStr] || [];

                const mappedGlobalTmr = globalTomorrow.map(po => ({
                    id: po.id,
                    time: po.time,
                    carrier: po.carrier || po.supplier,
                    type: 'PO',
                    po: po.po,
                    details: `PO#${po.po} (${po.qty})`,
                    isGlobal: true
                }));

                const combinedTmrManifest = [...tmrLocalManifest, ...mappedGlobalTmr];
                const effectiveTmrCount = Math.max(savedTmrCount, combinedTmrManifest.length);

                if (effectiveTmrCount > 0 || combinedTmrManifest.length > 0) {
                    agg.tomorrow.push({
                        sku,
                        count: effectiveTmrCount,
                        manifest: combinedTmrManifest
                    });
                }
            });

            setAggregatedSchedule(agg);
        } catch (error) {
            console.error("Critical Error in LogisticsView Aggregation:", error);
            // Optionally set safe empty state?
            // setAggregatedSchedule({ today: [], tomorrow: [] }); 
        }
    }, [bottleSizes, state.monthlyInbound, state.stateVersion, poManifest]); // Added poManifest dependency

    // Filter Logic
    const filteredToday = filterSku === 'ALL'
        ? aggregatedSchedule.today
        : aggregatedSchedule.today.filter(i => i.sku === filterSku);

    const filteredTomorrow = filterSku === 'ALL'
        ? aggregatedSchedule.tomorrow
        : aggregatedSchedule.tomorrow.filter(i => i.sku === filterSku);

    const totalTodayTrucks = filteredToday.reduce((acc, i) => acc + i.count, 0);
    const totalTomorrowTrucks = filteredTomorrow.reduce((acc, i) => acc + i.count, 0);

    // Helper for large numbers
    const fmt = (n) => n ? n.toLocaleString() : '0';

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header & Main Action */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
                <div>
                    <h1 className="text-3xl font-black tracking-tight uppercase">Floor Operations</h1>
                    <div className="flex items-center space-x-2 mt-2 opacity-80">
                        <span className="bg-slate-700 px-3 py-1 rounded text-sm font-mono">
                            ACTIVE: {state.selectedSize}
                        </span>
                        <span className="text-sm">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-4 md:mt-0 w-full md:w-auto">
                    <button
                        onClick={async () => {
                            if (!confirm("This will upload ALL old local schedule data to the cloud database and remove it from this device. Continue?")) return;
                            // ... existing sync logic ...
                            try {
                                const allLegacyItems = [];
                                const keysToRemove = [];
                                const safeUUID = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}-${Math.random()}`;
                                const specs = results.specs;
                                const qtyPerTruck = specs?.bottlesPerTruck || 20000;

                                bottleSizes.forEach(sku => {
                                    const key = `mrp_${sku}_truckManifest`;
                                    const raw = localStorage.getItem(key);
                                    if (raw) {
                                        try {
                                            const data = JSON.parse(raw);
                                            Object.entries(data).forEach(([date, items]) => {
                                                if (Array.isArray(items)) {
                                                    items.forEach(item => {
                                                        allLegacyItems.push({
                                                            id: item.id || safeUUID(),
                                                            date: date,
                                                            po: item.po || `LEGACY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                                                            sku: sku,
                                                            qty: qtyPerTruck,
                                                            supplier: item.carrier || 'Unknown',
                                                            carrier: item.carrier,
                                                            time: item.time,
                                                            status: 'scheduled',
                                                            isGlobal: true
                                                        });
                                                    });
                                                }
                                            });
                                            keysToRemove.push(key);
                                        } catch (e) {
                                            console.warn("Failed to parse legacy key", key, e);
                                        }
                                    }
                                });

                                if (allLegacyItems.length > 0) {
                                    bulkUpdateOrders(allLegacyItems);
                                    keysToRemove.forEach(k => localStorage.removeItem(k));
                                    alert(`Successfully migrated ${allLegacyItems.length} local records to the cloud! Local storage cleared.`);
                                    window.location.reload();
                                } else {
                                    alert("No local legacy data found to migrate.");
                                }

                            } catch (err) {
                                console.error("Migration Error", err);
                                alert("Migration Failed check console");
                            }
                        }}
                        className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-bold text-sm shadow-lg border border-blue-400 w-full sm:w-auto"
                    >
                        <TruckIcon className="w-5 h-5 mr-2" />
                        SYNC LOCAL DB
                    </button>

                    <button
                        onClick={() => setIsRecModalOpen(true)}
                        className="flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-6 py-3 rounded-xl font-bold text-base md:text-lg transition-transform hover:scale-105 shadow-xl w-full sm:w-auto"
                    >
                        <ClipboardDocumentCheckIcon className="w-6 h-6 md:w-8 md:h-8 mr-2" />
                        START DAY
                    </button>
                </div>
            </div>

            {/* Inventory Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Floor Inventory */}
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border-2 border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-sm">Floor Inventory</p>
                        <div className="flex items-baseline mt-2">
                            <span className="text-6xl font-black text-slate-800 dark:text-white">
                                {fmt(Math.round(results.calculatedPallets))}
                            </span>
                            <span className="ml-2 text-xl font-medium text-gray-400">Pallets</span>
                        </div>
                    </div>
                    <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center">
                        <CubeIcon className="w-8 h-8 text-blue-600" />
                    </div>
                </div>

                {/* Yard Inventory */}
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border-2 border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-sm">Yard Inventory</p>
                        <div className="flex items-baseline mt-2">
                            <span className="text-6xl font-black text-slate-800 dark:text-white">
                                {yardInventory.effectiveCount}
                            </span>
                            <span className="ml-2 text-xl font-medium text-gray-400">Loads</span>
                        </div>
                        {yardInventory.isOverridden && (
                            <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded">
                                MANUAL OVERRIDE
                            </span>
                        )}
                    </div>
                    <div className="h-16 w-16 bg-orange-50 rounded-full flex items-center justify-center">
                        <TruckIcon className="w-8 h-8 text-orange-600" />
                    </div>
                </div>
            </div>

            {/* Dock Schedule / Inbound Manifest */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center">
                        <CalendarDaysIcon className="w-5 h-5 mr-2 text-gray-500" />
                        Master Dock Schedule
                    </h2>

                    {/* SKU Filter Pill */}
                    <div className="flex space-x-1 bg-white dark:bg-gray-800 rounded-lg p-1 border dark:border-gray-600">
                        <button
                            onClick={() => setFilterSku('ALL')}
                            className={`px-3 py-1 text-[10px] uppercase font-bold rounded ${filterSku === 'ALL' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            All
                        </button>
                        {bottleSizes.map(sku => (
                            <button
                                key={sku}
                                onClick={() => setFilterSku(sku)}
                                className={`px-3 py-1 text-[10px] uppercase font-bold rounded ${filterSku === sku ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {sku}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {/* Today */}
                    <div className="p-6 transition-colors">
                        <div className="flex items-center mb-4">
                            <div className={`w-3 h-12 rounded-full mr-4 ${totalTodayTrucks > 0 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">TODAY</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {new Date().toLocaleDateString()}
                                </p>
                            </div>
                            <div className="ml-auto text-right">
                                {totalTodayTrucks > 0 ? (
                                    <span className="text-sm font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full uppercase">
                                        {totalTodayTrucks} Total Trucks
                                    </span>
                                ) : null}
                            </div>
                        </div>

                        {/* Render List of Active SKUs */}
                        <div className="pl-7 space-y-6">
                            {filteredToday.length === 0 && (
                                <p className="text-sm text-gray-400 italic">No scheduled deliveries.</p>
                            )}
                            {filteredToday.map(item => (
                                <div key={item.sku} className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <h4 className="flex items-center text-xs font-bold text-gray-500 uppercase mb-3">
                                        <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                                        {item.sku} Production Supply ({item.count} Trucks)
                                    </h4>
                                    <DockManifestParams
                                        date={todayStr}
                                        totalRequired={item.count}
                                        manifest={item.manifest}
                                        onUpdate={(d, list) => {
                                            // LogisticsView onUpdate (Today) Called
                                            try {
                                                const specs = results.specs;
                                                const qtyPerTruck = specs?.bottlesPerTruck || 20000;
                                                const safeUUID = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}-${Math.random()}`;

                                                const newOpsItems = list.map(uiItem => ({
                                                    id: uiItem.id || safeUUID(),
                                                    date: d,
                                                    po: uiItem.po || `TEMP-${Date.now()}`,
                                                    sku: item.sku,
                                                    qty: qtyPerTruck,
                                                    supplier: uiItem.carrier || 'Unknown',
                                                    carrier: uiItem.carrier,
                                                    time: uiItem.time,
                                                    status: 'scheduled',
                                                    isGlobal: true
                                                }));

                                                const currentDayManifest = poManifest[d]?.items || [];
                                                const otherSkuItems = Array.isArray(currentDayManifest)
                                                    ? currentDayManifest.filter(i => i.sku !== item.sku)
                                                    : [];

                                                const combinedItems = [...otherSkuItems, ...newOpsItems];


                                                updateDailyManifest(d, combinedItems);
                                            } catch (err) {
                                                console.error("Failed to update manifest (Today) in LogicsticsView:", err);
                                                alert("Error saving manifest. See console.");
                                            }

                                            // --- CLEANUP LEGACY LOCAL STORAGE (Today) ---
                                            try {
                                                const legacyKey = `mrp_${item.sku}_truckManifest`;
                                                const raw = localStorage.getItem(legacyKey);
                                                if (raw) {
                                                    const data = JSON.parse(raw);
                                                    if (data[d]) {
                                                        delete data[d];
                                                        localStorage.setItem(legacyKey, JSON.stringify(data));

                                                    }
                                                }
                                            } catch (e) {
                                                console.warn("Legacy cleanup failed (Today)", e);
                                            }
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tomorrow */}
                    <div className="p-6 transition-colors opacity-95">
                        <div className="flex items-center mb-4">
                            <div className={`w-3 h-12 rounded-full mr-4 ${totalTomorrowTrucks > 0 ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                            <div>
                                <p className="text-xl font-bold text-gray-700 dark:text-gray-300">TOMORROW</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {tomorrowDateObj.toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        <div className="pl-7 space-y-6">
                            {filteredTomorrow.length === 0 && (
                                <p className="text-sm text-gray-400 italic">No scheduled deliveries.</p>
                            )}
                            {filteredTomorrow.map(item => (
                                <div key={item.sku} className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <h4 className="flex items-center text-xs font-bold text-gray-500 uppercase mb-3">
                                        <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                                        {item.sku} Production Supply ({item.count} Trucks)
                                    </h4>
                                    <DockManifestParams
                                        date={tomorrowStr}
                                        totalRequired={item.count}
                                        manifest={item.manifest}
                                        onUpdate={(d, list) => {
                                            // LogisticsView onUpdate Called
                                            try {
                                                const specs = results.specs;
                                                const qtyPerTruck = specs?.bottlesPerTruck || 20000;
                                                const safeUUID = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}-${Math.random()}`;

                                                const newOpsItems = list.map(uiItem => ({
                                                    id: uiItem.id || safeUUID(),
                                                    date: d,
                                                    po: uiItem.po || 'TBD',
                                                    sku: item.sku,
                                                    qty: qtyPerTruck,
                                                    supplier: uiItem.carrier || 'Unknown',
                                                    carrier: uiItem.carrier,
                                                    time: uiItem.time,
                                                    status: 'scheduled',
                                                    isGlobal: true
                                                }));

                                                const currentDayManifest = poManifest[d]?.items || [];
                                                // Robust filter
                                                const otherSkuItems = Array.isArray(currentDayManifest)
                                                    ? currentDayManifest.filter(i => i.sku !== item.sku)
                                                    : [];

                                                const combinedItems = [...otherSkuItems, ...newOpsItems];


                                                updateDailyManifest(d, combinedItems);
                                            } catch (err) {
                                                console.error("Failed to update manifest in LogicsticsView:", err);
                                                alert("Error saving manifest. See console.");
                                            }

                                            // --- CLEANUP LEGACY LOCAL STORAGE (Tomorrow) ---
                                            try {
                                                const legacyKey = `mrp_${item.sku}_truckManifest`;
                                                const raw = localStorage.getItem(legacyKey);
                                                if (raw) {
                                                    const data = JSON.parse(raw);
                                                    if (data[d]) {
                                                        delete data[d];
                                                        localStorage.setItem(legacyKey, JSON.stringify(data));

                                                    }
                                                }
                                            } catch (e) {
                                                console.warn("Legacy cleanup failed (tomorrow)", e);
                                            }
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Extended Lookahead Link (Planner View hint) */}
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 text-center">
                    <p className="text-xs text-gray-500">
                        For the full 30-day schedule, ask a Planner or switch to the Planning View.
                    </p>
                </div>
            </div>

            <MorningReconciliationModal
                isOpen={isRecModalOpen}
                onClose={() => setIsRecModalOpen(false)}
                state={state} // Pass full state
                setters={setters} // Pass all setters
            />
        </div>
    );
}
