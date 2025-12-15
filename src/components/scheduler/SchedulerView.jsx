import { useSettings } from '../../context/SettingsContext';
import DeliveryTable from './DeliveryTable';

export default function SchedulerView({ state, setters, results }) {
    const { bottleSizes } = useSettings();

    if (!results) return <div>Loading...</div>;

    const { requiredDailyLoads, weeklyLoads, schedule } = results;

    return (
        <div className="space-y-8">
            {/* ... (Existing Settings Inputs) ... */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors">
                {/* ... kept as is ... */}
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 border-b dark:border-gray-700 pb-2">🚚 Logistics Settings</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">

                    <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bottle Size Reference</label>
                        <select
                            value={state.selectedSize}
                            onChange={(e) => setters.setSelectedSize(e.target.value)}
                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2"
                        >
                            {bottleSizes.map(size => (
                                <option key={size} value={size}>{size}</option>
                            ))}
                        </select>
                    </div>

                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Daily Production (Cases)</label>
                        <div className="relative rounded-md shadow-sm">
                            <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                min="0"
                                value={state.targetDailyProduction || ''}
                                onChange={(e) => setters.setTargetDailyProduction(e.target.value)}
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:border-blue-500 focus:ring-blue-500 text-2xl p-2 pl-4"
                                placeholder="60000"
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 sm:text-sm">cases/day</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Production Start Time</label>
                    <input
                        type="time"
                        value={state.shiftStartTime}
                        onChange={(e) => setters.setShiftStartTime(e.target.value)}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3"
                    />
                </div>
            </div>

            {/* Logistics Metrics */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-t dark:border-gray-700 pt-6">
                <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded border border-gray-200 dark:border-gray-700">
                    <span className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Production Burn Rate</span>
                    <span className="block text-xl font-bold text-gray-800 dark:text-white">
                        {Math.round(results.burnRate).toLocaleString()} cases/hr
                    </span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded border border-gray-200 dark:border-gray-700">
                    <span className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Truck Interval</span>
                    <span className="block text-xl font-bold text-indigo-600 dark:text-indigo-400">
                        Every {Math.floor(results.hoursPerTruck)}h {Math.round((results.hoursPerTruck % 1) * 60)}m
                    </span>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded border border-blue-100 dark:border-blue-800 flex flex-col justify-center">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200 uppercase">Daily Truck Requirement</span>
                    <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{results.requiredDailyLoads}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Helper Stat */}
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-md flex justify-between items-center text-sm text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-700">
                    <span>Total Weekly Volume: <strong className="text-gray-900 dark:text-white">{weeklyLoads.toLocaleString()} Loads</strong></span>
                    <span>Based on 24/7 Production schedule</span>
                </div>



                {/* Visual Schedule Board (Replaces Table) */}
                <DeliveryTable
                    schedule={results.schedule}
                    truckSchedule={results.truckSchedule}
                    onUpdatePO={setters.updatePO}
                    onDelete={setters.toggleCancelled}
                    specs={results.specs}
                />
            </div>
        </div>
    );
}
