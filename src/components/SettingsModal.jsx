import { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useProcurement } from '../context/ProcurementContext';
import { SunIcon, MoonIcon, BoltIcon, XMarkIcon } from '@heroicons/react/24/outline'; // Replaced Trash/Plus with Bolt/XMark

export default function SettingsModal({ onClose }) {
    const {
        safetyStockLoads,
        setSafetyStockLoads,
        leadTimeDays,
        setLeadTimeDays,
        csvMapping,
        updateCsvMapping,
        resetDefaults,
        theme,
        setTheme
    } = useSettings();

    const { poManifest } = useProcurement();

    // Removed newSkuName state
    // Removed handleDeleteSku
    // Removed handleAddSku

    return (
        <div className="fixed inset-0 z-50 flex justify-center bg-black bg-opacity-50 overflow-y-auto px-4 py-6 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl relative h-fit my-auto p-6 border dark:border-gray-700 transition-colors">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Master Settings</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-bold text-xl"
                    >
                        &times;
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Appearance */}
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                        <div>
                            <h3 className="font-bold text-gray-800 dark:text-gray-200">Appearance</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Choose your interface theme.</p>
                        </div>
                        <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
                            <button
                                onClick={() => setTheme('light')}
                                className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${theme === 'light'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                            >
                                <SunIcon className="w-4 h-4" />
                                <span>Light</span>
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${theme === 'dark'
                                    ? 'bg-gray-600 text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                            >
                                <MoonIcon className="w-4 h-4" />
                                <span>Dark</span>
                            </button>
                        </div>
                    </div>

                    {/* Global Planning Rules */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-100 dark:border-blue-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                                Global Safety Stock (Full Loads)
                            </label>
                            <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={safetyStockLoads}
                                onChange={(e) => setSafetyStockLoads(Number(e.target.value))}
                                className="mt-1 block w-24 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base sm:text-lg"
                            />
                            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                                Minimum inventory target (Trucks).
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                                Inbound Lead Time (Days)
                            </label>
                            <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={leadTimeDays}
                                onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                                className="mt-1 block w-24 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base sm:text-lg"
                            />
                            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                                Days from Order to Delivery.
                            </p>
                        </div>
                    </div>

                    <hr className="border-gray-200 dark:border-gray-700" />

                    {/* CSV Mapping Settings */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">CSV Integration Mappings</h3>
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md border border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status Column Header</label>
                                <input
                                    type="text"
                                    value={csvMapping.statusColumn}
                                    onChange={(e) => updateCsvMapping('statusColumn', e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                    placeholder="e.g. Trailer State"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">"Full" Keyword</label>
                                <input
                                    type="text"
                                    value={csvMapping.fullValue}
                                    onChange={(e) => updateCsvMapping('fullValue', e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                    placeholder="e.g. Loaded"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SKU/Product Column</label>
                                <input
                                    type="text"
                                    value={csvMapping.skuColumn}
                                    onChange={(e) => updateCsvMapping('skuColumn', e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                    placeholder="e.g. Commodity"
                                />
                            </div>
                            <div className="col-span-1 md:col-span-3">
                                <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                    The importer will look for rows where <strong>{csvMapping.statusColumn}</strong> contains "<strong>{csvMapping.fullValue}</strong>"
                                    {csvMapping.skuColumn ? <span> and <strong>{csvMapping.skuColumn}</strong> contains the active bottle size (e.g. "20oz").</span> : '.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-200 dark:border-gray-700" />

                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cases / Pallet</label>
                    <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={bottleDefinitions[size].casesPerPallet || 0}
                        onChange={(e) => updateBottleDefinition(size, 'casesPerPallet', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Scrap %</label>
                    <input
                        type="number"
                        step="0.1"
                        value={bottleDefinitions[size].scrapPercentage || 0}
                        onChange={(e) => updateBottleDefinition(size, 'scrapPercentage', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base sm:text-sm"
                    />
                </div>
                </div>
            </div>

    <div className="mt-8 bg-gray-50 dark:bg-gray-800 -mx-6 -mb-6 p-4 rounded-b-lg border-t dark:border-gray-700">
        <div className="flex flex-col-reverse md:flex-row justify-between items-center gap-4">
            <button
                onClick={() => {
                    if (confirm('Are you sure you want to reset all settings to factory defaults?')) {
                        resetDefaults();
                    }
                }}
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
            >
                Reset to Factory Defaults
            </button>

            <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                <button
                    onClick={() => window.location.reload()}
                    className="w-full md:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-bold flex items-center justify-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 4.992l3.181-3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Sync Cloud Data
                </button>
                <button
                    onClick={onClose}
                    className="w-full md:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-bold shadow-sm"
                >
                    Done
                </button>
            </div>
        </div>
        <div className="text-center mt-4">
            <p className="text-[10px] text-gray-400 dark:text-gray-600">v{import.meta.env.PACKAGE_VERSION} (Smart Planner)</p>
        </div>
    </div>
            </div >
        </div >
    );
}
