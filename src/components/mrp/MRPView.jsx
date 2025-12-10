import { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import CsvDropZone from './CsvDropZone';
import BurnDownChart from './BurnDownChart';
import { PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function MRPView({ state, setters, results }) {
    const { bottleSizes } = useSettings();
    const [isEditingYard, setIsEditingYard] = useState(false);

    if (!results) return <div>Loading...</div>;

    const { netInventory, safetyTarget, trucksToOrder, specs, yardInventory } = results;
    // Calculate total scheduled bottles for chart burn rate calculation
    const weeklyDemandBottles = state.totalScheduledCases * specs.bottlesPerCase;

    // Helpers for formatting
    const fmt = (n) => n ? n.toLocaleString() : '0';

    return (
        <div className="space-y-6">
            {/* Top Zone: Integration Check & Drop Status */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
                <CsvDropZone
                    onUpdateInventory={setters.setYardInventory}
                    currentSku={state.selectedSize}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Zone A: Visualization & Critical Metrics (Takes up 2/3 on large screens) */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Burn Down Chart */}
                    <BurnDownChart
                        currentInventoryBottles={results.netInventory + weeklyDemandBottles}
                        weeklyDemandBottles={weeklyDemandBottles}
                        safetyStockBottles={safetyTarget}
                    />

                    {/* Key Results High Level */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-800 text-white p-6 rounded-lg shadow-md flex flex-col justify-between">
                            <div>
                                <p className="text-gray-400 text-sm uppercase font-bold">Projected End-of-Week Status</p>
                                <p className={`text-4xl font-mono font-bold mt-2 ${netInventory < safetyTarget ? 'text-red-400' : 'text-green-400'}`}>
                                    {fmt(netInventory)}
                                </p>
                                <p className="text-sm text-gray-400 mt-1">Bottles Net</p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 flex flex-col justify-between">
                            <div>
                                <p className="text-gray-500 text-sm uppercase font-bold">Safety Stock Target</p>
                                <p className="text-4xl font-mono font-bold mt-2 text-gray-700">{fmt(safetyTarget)}</p>
                                <p className="text-sm text-gray-400 mt-1">Bottles ({state.selectedSize})</p>
                            </div>
                        </div>

                        <div className={`p-6 rounded-lg shadow-md border-2 flex flex-col justify-between ${trucksToOrder > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                            <div>
                                <p className={`${trucksToOrder > 0 ? 'text-red-600' : 'text-green-600'} text-sm uppercase font-bold`}> replenishment Action</p>
                                <div className="text-4xl font-extrabold mt-2">
                                    {trucksToOrder > 0 ? (
                                        <span className="text-red-600">{trucksToOrder} TRUCKS</span>
                                    ) : (
                                        <span className="text-green-600">✅ OK</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Zone B: Inputs & Manual Overrides (Side Panel) */}
                <div className="space-y-6">
                    {/* Controls Panel */}
                    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                        <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">🎛️ Inventory Controls</h2>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Active SKU</label>
                                <select
                                    value={state.selectedSize}
                                    onChange={(e) => setters.setSelectedSize(e.target.value)}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-lg py-2"
                                >
                                    {bottleSizes.map(size => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Floor (Pallets)</label>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        min="0"
                                        value={state.currentInventoryPallets === 0 ? '' : state.currentInventoryPallets}
                                        onChange={(e) => setters.setCurrentInventoryPallets(e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-lg"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Inbound (Trucks)</label>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        min="0"
                                        value={state.incomingTrucks === 0 ? '' : state.incomingTrucks}
                                        onChange={(e) => setters.setIncomingTrucks(e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-lg"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Yard Inventory Section */}
                            <div className="bg-blue-50 p-4 rounded-md border border-blue-100 relative">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-bold text-blue-900">Yard Inventory</label>
                                    {state.yardInventory.timestamp && !isEditingYard && (
                                        <span className="text-xs text-blue-600">
                                            Last sync: {new Date(state.yardInventory.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>

                                {isEditingYard ? (
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="number"
                                            autoFocus
                                            value={state.manualYardOverride ?? state.yardInventory.count}
                                            onChange={(e) => setters.setManualYardOverride(e.target.value)}
                                            className="block w-full rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-lg"
                                        />
                                        <button
                                            onClick={() => setIsEditingYard(false)}
                                            className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                                        >
                                            <XMarkIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-baseline space-x-2">
                                            <span className="text-2xl font-bold text-blue-800">
                                                {yardInventory.effectiveCount}
                                            </span>
                                            <span className="text-sm text-blue-600">Full Loads</span>
                                            {yardInventory.isOverridden && (
                                                <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded border border-yellow-200">Manual</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setIsEditingYard(true)}
                                            className="flex items-center text-xs text-blue-500 hover:text-blue-700 underline"
                                        >
                                            <PencilSquareIcon className="h-3 w-3 mr-1" />
                                            Override
                                        </button>
                                    </div>
                                )}
                                {!isEditingYard && state.yardInventory.fileName && (
                                    <p className="text-xs text-gray-500 mt-1 truncate">
                                        Source: {state.yardInventory.fileName}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Weekly Demand Condensed */}
                    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                        <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">📅 Demand Schedule</h2>
                        <div className="grid grid-cols-4 gap-2 mb-2">
                            {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => (
                                <div key={day} className="text-center">
                                    <label className="block text-xs text-gray-500 uppercase font-bold mb-1">{day.charAt(0)}</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={state.weeklyDemand[day] === 0 ? '' : state.weeklyDemand[day]}
                                        onChange={(e) => setters.updateDailyDemand(day, e.target.value)}
                                        className="block w-full text-center rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-1 px-0"
                                        placeholder="-"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-200 mt-4">
                            <span className="text-sm font-medium text-gray-600">Total Wk Demand:</span>
                            <span className="text-lg font-bold text-gray-900">{fmt(state.totalScheduledCases)} <span className="text-xs font-normal text-gray-500">cs</span></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
