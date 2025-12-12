import { useState } from 'react';
import {
    TruckIcon,
    ClipboardDocumentCheckIcon,
    CubeIcon,
    ClockIcon,
    CalendarDaysIcon
} from '@heroicons/react/24/outline';
import MorningReconciliationModal from '../mrp/MorningReconciliationModal';

export default function LogisticsView({ state, setters, results }) {
    const [isRecModalOpen, setIsRecModalOpen] = useState(false);

    if (!results) return <div className="p-8 text-center text-gray-500">Loading Logistics Data...</div>;

    const { specs, yardInventory } = results;
    const todayStr = new Date().toISOString().split('T')[0];

    // Calculate Tomorrow's Date for "Upcoming"
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Filter Inbound Trucks for Today and Tomorrow
    const todayTrucks = state.monthlyInbound[todayStr] || 0;
    const tomorrowTrucks = state.monthlyInbound[tomorrowStr] || 0;

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
                        Dock Schedule
                    </h2>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Inbound Deliveries
                    </span>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {/* Today */}
                    <div className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="flex items-center">
                            <div className={`w-3 h-12 rounded-full mr-4 ${todayTrucks > 0 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">TODAY</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {new Date().toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            {todayTrucks > 0 ? (
                                <>
                                    <span className="block text-4xl font-black text-slate-800 dark:text-white">
                                        {todayTrucks}
                                    </span>
                                    <span className="text-xs font-bold text-green-600 uppercase">Trucks Arriving</span>
                                </>
                            ) : (
                                <span className="text-gray-400 font-medium">No Deliveries Scheduled</span>
                            )}
                        </div>
                    </div>

                    {/* Tomorrow */}
                    <div className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors opacity-90">
                        <div className="flex items-center">
                            <div className={`w-3 h-12 rounded-full mr-4 ${tomorrowTrucks > 0 ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                            <div>
                                <p className="text-xl font-bold text-gray-700 dark:text-gray-300">TOMORROW</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {tomorrow.toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            {tomorrowTrucks > 0 ? (
                                <>
                                    <span className="block text-3xl font-bold text-slate-700 dark:text-gray-300">
                                        {tomorrowTrucks}
                                    </span>
                                    <span className="text-xs font-bold text-blue-600 uppercase">Trucks Planned</span>
                                </>
                            ) : (
                                <span className="text-gray-400 font-medium">No Deliveries Scheduled</span>
                            )}
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
