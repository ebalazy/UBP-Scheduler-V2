import { ArrowDownIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function ProductionInputs({
    productionRate,
    setProductionRate,
    downtimeHours,
    setDowntimeHours,
    lostProductionCases
}) {
    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-100 dark:border-gray-700 transition-colors">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase mb-4 flex items-center gap-2">
                <span>⚡ Production Reality</span>
            </h3>

            <div className="space-y-4">
                {/* Run Rate */}
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Actual Run Rate (Cases/Hr)
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={productionRate || ''}
                            onChange={(e) => setProductionRate(e.target.value)}
                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm"
                            placeholder="e.g. 1000"
                        />
                        <span className="absolute right-3 top-2 text-xs text-gray-400">cph</span>
                    </div>
                </div>

                {/* Downtime */}
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Est. Downtime / CIP (Hours)
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={downtimeHours || ''}
                            onChange={(e) => setDowntimeHours(e.target.value)}
                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 text-sm"
                            placeholder="e.g. 4"
                        />
                        <span className="absolute right-3 top-2 text-xs text-gray-400">hrs</span>
                    </div>
                </div>

                {/* Impact Calculation */}
                {lostProductionCases > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-100 dark:border-red-900 flex items-start gap-2 animate-pulse-slow">
                        <ArrowDownIcon className="h-5 w-5 text-red-500 mt-0.5" />
                        <div>
                            <p className="text-xs text-red-600 font-bold">Production Impact</p>
                            <p className="text-sm font-bold text-red-800">-{lostProductionCases.toLocaleString()} cases</p>
                            <p className="text-[10px] text-red-500 mt-1">Effective Demand Reduced</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
