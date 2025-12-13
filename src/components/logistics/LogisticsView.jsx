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
    const { poManifest, updateDailyManifest } = useProcurement(); // Access Global POs
    const todayStr = getLocalISOString();

    // Calculate Tomorrow's Date (Local)
    const tomorrowStr = addDays(todayStr, 1);
    const tomorrowDateObj = new Date(tomorrowStr + 'T00:00:00'); // For display purposes

    // --- AGGREGATION LOGIC ---
    useEffect(() => {
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
                const dayData = poManifest[date];
                if (!dayData || !dayData.items) return [];
                // Filter items that match this SKU (case insensitive just in case, though usually exact)
                return dayData.items.filter(item => item.sku === sku);
            };

            const globalToday = getGlobalPOs(todayStr);
            const globalTomorrow = getGlobalPOs(tomorrowStr);

            // 4. Check Today
            const savedTodayCount = Number(inboundMap[todayStr]) || 0;
            const todayLocalManifest = manifestMap[todayStr] || [];

            // Merge Global POs into Manifest for display (Simple concatenation for now)
            // We map Global POs to the manifest format if needed, but DockManifestParams handles generic objects well?
            // Let's standardise the Global PO to look like a manifest item { id, time, carrier, type... }
            const mappedGlobalToday = globalToday.map(po => ({
                id: po.id,
                time: po.time, // Add time
                carrier: po.carrier || po.supplier,
                type: 'PO',
                po: po.po,
                details: `PO#${po.po} (${po.qty})`,
                isGlobal: true
            }));

            // Combine Manifests (Local + Global)
            // deduplication? Global POs are separate from local manual entries usually.
            const combinedTodayManifest = [...todayLocalManifest, ...mappedGlobalToday];

            // Effective Count: Max of Manual, LocalCount, GlobalCount. 
            // Actually, Global Count should probably ADD to Local if distinct?
            // But usually the Manual Count was a crude estimate.
            // Let's say: Effective = Max(Manual, CombinedManifest.length)
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
                time: po.time, // Add time
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

                <button
                    onClick={() => setIsRecModalOpen(true)}
                    className="mt-4 md:mt-0 flex items-center bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-6 py-4 rounded-xl font-bold text-lg transition-transform hover:scale-105 shadow-xl"
                >
                    <ClipboardDocumentCheckIcon className="w-8 h-8 mr-2" />
                    START DAY / TRUE-UP
                </button>
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
                                            // Convert to Global POs
                                            const specs = results.specs;
                                            const qtyPerTruck = specs?.bottlesPerTruck || 20000;

                                            // 1. Map UI items to PO Objects
                                            const newOpsItems = list.map(uiItem => ({
                                                id: uiItem.id || crypto.randomUUID(),
                                                date: d,
                                                po: uiItem.po || `TEMP-${Date.now()}`, // Fallback if empty, though user should enter it
                                                sku: item.sku,
                                                qty: qtyPerTruck, // Assume 1 Full Truck
                                                supplier: uiItem.carrier || 'Unknown', // Map Carrier to Supplier for now, or just leave generic
                                                carrier: uiItem.carrier,
                                                time: uiItem.time,
                                                status: 'scheduled',
                                                isGlobal: true
                                            }));

                                            // 2. Merge with EXISTING Global Order (Preserve other SKUs)
                                            const currentDayManifest = poManifest[d]?.items || [];
                                            const otherSkuItems = currentDayManifest.filter(i => i.sku !== item.sku);

                                            const combinedItems = [...otherSkuItems, ...newOpsItems];

                                            // 3. Update Context (Syncs to Cloud + State)
                                            // We need to access updateDailyManifest from context
                                            // But we only have 'poManifest' destructured. 
                                            // We need to destructure 'updateDailyManifest' at top of component.
                                            // See Step 2158 for context export.
                                            setters.updateGlobalManifest(d, combinedItems);
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
                                            const specs = results.specs;
                                            const qtyPerTruck = specs?.bottlesPerTruck || 20000;

                                            const newOpsItems = list.map(uiItem => ({
                                                id: uiItem.id || crypto.randomUUID(),
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
                                            const otherSkuItems = currentDayManifest.filter(i => i.sku !== item.sku);

                                            const combinedItems = [...otherSkuItems, ...newOpsItems];

                                            updateDailyManifest(d, combinedItems);
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

            {/* Modal */}
            <MorningReconciliationModal
                isOpen={isRecModalOpen}
                onClose={() => setIsRecModalOpen(false)}
                state={state} // Pass full state
                setters={setters} // Pass all setters
            />
        </div>
    );
}
