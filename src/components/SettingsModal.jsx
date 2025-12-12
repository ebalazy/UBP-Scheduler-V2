import { useSettings } from '../context/SettingsContext';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

export default function SettingsModal({ onClose }) {
    const {
        bottleSizes,
        bottleDefinitions,
        updateBottleDefinition,
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

    return (
        <div className="fixed inset-0 z-50 flex justify-center bg-black bg-opacity-50 overflow-y-auto px-4 py-6">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl relative h-fit my-auto p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Master Settings</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 font-bold text-xl"
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
                    <div className="bg-blue-50 p-4 rounded-md border border-blue-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-blue-900 mb-2">
                                Global Safety Stock (Full Loads)
                            </label>
                            <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={safetyStockLoads}
                                onChange={(e) => setSafetyStockLoads(Number(e.target.value))}
                                className="mt-1 block w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base sm:text-lg"
                            />
                            <p className="text-xs text-blue-700 mt-1">
                                Minimum inventory target (Trucks).
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-blue-900 mb-2">
                                Inbound Lead Time (Days)
                            </label>
                            <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={leadTimeDays}
                                onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                                className="mt-1 block w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base sm:text-lg"
                            />
                            <p className="text-xs text-blue-700 mt-1">
                                Days from Order to Delivery.
                            </p>
                        </div>
                    </div>

                    <hr className="border-gray-200" />

                    {/* CSV Mapping Settings */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-4">CSV Integration Mappings</h3>
                        <div className="bg-gray-50 p-4 rounded-md border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase">Status Column Header</label>
                                <input
                                    type="text"
                                    value={csvMapping.statusColumn}
                                    onChange={(e) => updateCsvMapping('statusColumn', e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                    placeholder="e.g. Trailer State"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase">"Full" Keyword</label>
                                <input
                                    type="text"
                                    value={csvMapping.fullValue}
                                    onChange={(e) => updateCsvMapping('fullValue', e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                    placeholder="e.g. Loaded"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase">SKU/Product Column</label>
                                <input
                                    type="text"
                                    value={csvMapping.skuColumn}
                                    onChange={(e) => updateCsvMapping('skuColumn', e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                    placeholder="e.g. Commodity"
                                />
                            </div>
                            <div className="col-span-1 md:col-span-3">
                                <p className="text-xs text-gray-500 italic">
                                    The importer will look for rows where <strong>{csvMapping.statusColumn}</strong> contains "<strong>{csvMapping.fullValue}</strong>"
                                    {csvMapping.skuColumn ? <span> and <strong>{csvMapping.skuColumn}</strong> contains the active bottle size (e.g. "20oz").</span> : '.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-200" />

                    {/* Bottle Definitions */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-4">Bottle Definitions</h3>
                        <div className="space-y-6">
                            {bottleSizes.map(size => (
                                <div key={size} className="bg-gray-50 p-4 rounded-md border border-gray-200">
                                    <h4 className="font-bold text-md text-gray-800 mb-3 border-b pb-2">{size} Configuration</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 uppercase">Bottles / Case</label>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={bottleDefinitions[size].bottlesPerCase}
                                                onChange={(e) => updateBottleDefinition(size, 'bottlesPerCase', e.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base sm:text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 uppercase">Bottles / Truck</label>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={bottleDefinitions[size].bottlesPerTruck}
                                                onChange={(e) => updateBottleDefinition(size, 'bottlesPerTruck', e.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base sm:text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 uppercase">Cases / Truck</label>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={bottleDefinitions[size].casesPerTruck}
                                                onChange={(e) => updateBottleDefinition(size, 'casesPerTruck', e.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base sm:text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 uppercase">Cases / Pallet</label>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={bottleDefinitions[size].casesPerPallet || 0}
                                                onChange={(e) => updateBottleDefinition(size, 'casesPerPallet', e.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base sm:text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-between items-center bg-gray-50 -mx-6 -mb-6 p-4 rounded-b-lg border-t">
                    <button
                        onClick={() => {
                            if (confirm('Are you sure you want to reset all settings to factory defaults?')) {
                                resetDefaults();
                            }
                        }}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                        Reset to Factory Defaults
                    </button>
                    <button
                        onClick={onClose}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
