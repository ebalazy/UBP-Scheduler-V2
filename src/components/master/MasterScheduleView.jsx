import { useMemo } from 'react';

export default function MasterScheduleView({ masterLedger, loading }) {

    // Sort keys (dates)
    const sortedDates = useMemo(() => {
        if (!masterLedger) return [];
        return Object.keys(masterLedger).sort();
    }, [masterLedger]);

    const getSkuColor = (sku) => {
        // Simple hash to color or manual map
        const colors = {
            '20oz': 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700',
            '12oz': 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-700',
            '2L': 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700',
            '1L': 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700'
        };
        return colors[sku] || 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700';
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center p-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-500">Aggregating Master Plan...</span>
            </div>
        );
    }

    if (sortedDates.length === 0) {
        return (
            <div className="text-center p-10 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
                <h3 className="text-gray-400 dark:text-gray-500 font-bold mb-2">No Active Production</h3>
                <p className="text-gray-400 dark:text-gray-500 text-sm">Add demand or trucks to individual SKU plans to see them here.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Master Schedule</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Global view of all production lines and logistics.</p>
            </div>

            <div className="space-y-4">
                {/* Mobile View: Cards */}
                <div className="md:hidden space-y-4">
                    {sortedDates.map(dateStr => {
                        const activities = masterLedger[dateStr] || [];
                        const dateObj = new Date(dateStr);
                        const isToday = new Date().toISOString().split('T')[0] === dateStr;
                        if (activities.length === 0) return null;

                        return (
                            <div key={dateStr} className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4 ${isToday ? 'border-blue-300 ring-1 ring-blue-100 dark:ring-blue-900' : 'border-gray-200 dark:border-gray-700'}`}>
                                <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                                    <div className="flex flex-col">
                                        <span className={`text-lg font-bold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                                            {dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{dateStr}</span>
                                    </div>
                                    {isToday && <span className="text-xs font-bold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">TODAY</span>}
                                </div>

                                <div className="space-y-2">
                                    {activities.map((act) => (
                                        <div key={`${dateStr}-${act.sku}-mobile`} className={`flex items-center justify-between p-2 rounded border ${getSkuColor(act.sku)}`}>
                                            <div className="flex items-center">
                                                <span className="font-bold text-sm mr-3 w-12">{act.sku}</span>
                                                {/* Production */}
                                                {(act.demand > 0 || (act.actual !== null && act.actual > 0)) && (
                                                    <span className="font-mono font-bold text-sm">
                                                        {act.actual !== null ? act.actual.toLocaleString() : act.demand.toLocaleString()} cases
                                                    </span>
                                                )}
                                            </div>

                                            {/* Truck Badge */}
                                            {act.trucks > 0 && (
                                                <div className="flex items-center space-x-1 bg-white dark:bg-gray-800 bg-opacity-60 px-2 py-1 rounded border border-black/5 dark:border-white/10">
                                                    <span className="text-base">🚛</span>
                                                    <span className="font-bold text-sm">{act.trucks}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>


                {/* Desktop View: Table */}
                <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {/* Header Row */}
                    <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 border-b border-gray-200 dark:border-gray-700 grid grid-cols-12 gap-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <div className="col-span-3 md:col-span-2">Date</div>
                        <div className="col-span-9 md:col-span-10">Production & Logistics</div>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {sortedDates.map(dateStr => {
                            const activities = masterLedger[dateStr] || [];
                            const dateObj = new Date(dateStr);
                            const isToday = new Date().toISOString().split('T')[0] === dateStr;

                            return (
                                <div key={dateStr} className={`group grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                                    {/* Date Column */}
                                    <div className="col-span-3 md:col-span-2 flex flex-col justify-center">
                                        <span className={`text-sm font-bold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                                            {dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-1">{dateStr}</span>
                                    </div>

                                    {/* Activity Column */}
                                    <div className="col-span-9 md:col-span-10 flex flex-col space-y-2 justify-center">
                                        {activities.map((act, idx) => (
                                            <div key={`${dateStr}-${act.sku}`} className={`flex items-center p-2 rounded border ${getSkuColor(act.sku)}`}>
                                                <span className="font-bold text-xs uppercase w-16 tracking-wide">{act.sku}</span>

                                                <div className="flex-1 flex items-center space-x-4">
                                                    {/* Production */}
                                                    {(act.demand > 0 || (act.actual !== null && act.actual > 0)) && (
                                                        <div className="flex items-baseline space-x-1">
                                                            <span className="text-xs opacity-70">Run:</span>
                                                            <span className="font-mono font-bold text-sm">
                                                                {act.actual !== null ? act.actual.toLocaleString() : act.demand.toLocaleString()}
                                                            </span>
                                                            {act.actual !== null && <span className="text-[10px] bg-white bg-opacity-50 px-1 rounded ml-1">ACT</span>}
                                                        </div>
                                                    )}

                                                    {/* Separator if both exist */}
                                                    {((act.demand > 0 || act.actual > 0) && act.trucks > 0) && (
                                                        <span className="text-gray-300 dark:text-gray-600">|</span>
                                                    )}

                                                    {/* Logistics */}
                                                    {act.trucks > 0 && (
                                                        <div className="flex items-center space-x-1">
                                                            <span className="text-lg">🚛</span>
                                                            <span className="font-bold text-sm">{act.trucks}</span>
                                                            <span className="text-xs opacity-70">Trucks</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
