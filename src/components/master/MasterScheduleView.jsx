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
            '20oz': 'bg-blue-100 text-blue-800 border-blue-200',
            '12oz': 'bg-purple-100 text-purple-800 border-purple-200',
            '2L': 'bg-green-100 text-green-800 border-green-200',
            '1L': 'bg-orange-100 text-orange-800 border-orange-200'
        };
        return colors[sku] || 'bg-gray-100 text-gray-800 border-gray-200';
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
            <div className="text-center p-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <h3 className="text-gray-400 font-bold mb-2">No Active Production</h3>
                <p className="text-gray-400 text-sm">Add demand or trucks to individual SKU plans to see them here.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Master Schedule</h1>
                <p className="text-sm text-gray-500">Global view of all production lines and logistics.</p>
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
                            <div key={dateStr} className={`bg-white rounded-lg shadow-sm border p-4 ${isToday ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'}`}>
                                <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                                    <div className="flex flex-col">
                                        <span className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                                            {dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </span>
                                        <span className="text-xs text-gray-400 font-mono">{dateStr}</span>
                                    </div>
                                    {isToday && <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">TODAY</span>}
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
                                                <div className="flex items-center space-x-1 bg-white bg-opacity-60 px-2 py-1 rounded border border-black/5">
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
                <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Header Row */}
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 grid grid-cols-12 gap-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        <div className="col-span-3 md:col-span-2">Date</div>
                        <div className="col-span-9 md:col-span-10">Production & Logistics</div>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-gray-100">
                        {sortedDates.map(dateStr => {
                            const activities = masterLedger[dateStr] || [];
                            const dateObj = new Date(dateStr);
                            const isToday = new Date().toISOString().split('T')[0] === dateStr;

                            return (
                                <div key={dateStr} className={`group grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors ${isToday ? 'bg-blue-50/30' : ''}`}>
                                    {/* Date Column */}
                                    <div className="col-span-3 md:col-span-2 flex flex-col justify-center">
                                        <span className={`text-sm font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                                            {dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </span>
                                        <span className="text-xs text-gray-400 font-mono mt-1">{dateStr}</span>
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
                                                        <span className="text-gray-300">|</span>
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
