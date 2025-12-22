import React from 'react';
import { getHoursFromISO } from '../../utils/schedulerLogic';
import { useProducts } from '../../context/ProductsContext';

export default function TimelineBoard({ runs, lines, onRunClick }) {
    const { productMap } = useProducts();

    // Helper to get color for a SKU from ProductsContext
    const getColorForSKU = (sku) => {
        return productMap[sku]?.colorTag || '#3B82F6'; // Default blue
    };

    // 24 Hour Grid
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const hourWidth = 60; // px per hour

    const getLeftPos = (startTime) => {
        const h = getHoursFromISO(startTime);
        return h * hourWidth;
    };

    const getWidth = (duration) => {
        return duration * hourWidth;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
                <div className="min-w-[1500px] relative">

                    {/* Header: Hours */}
                    <div className="flex border-b text-xs text-gray-400">
                        <div className="w-32 flex-shrink-0 p-2 border-r bg-gray-50 dark:bg-gray-900 sticky left-0 z-10">
                            Lines
                        </div>
                        <div className="flex-1 flex relative h-8 items-center bg-gray-50 dark:bg-gray-900">
                            {hours.map(h => (
                                <div key={h} className="absolute border-l border-gray-200 dark:border-gray-700 h-full flex items-center pl-1" style={{ left: h * hourWidth }}>
                                    {h}:00
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rows */}
                    {lines.map(line => (
                        <div key={line.id} className="flex border-b border-gray-100 dark:border-gray-800 h-24 relative hover:bg-gray-50/50 transition-colors">
                            {/* Row Header */}
                            <div className="w-32 flex-shrink-0 p-3 border-r bg-white dark:bg-gray-800 sticky left-0 z-10 font-bold text-sm text-gray-700 dark:text-gray-200 flex flex-col justify-center shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)]">
                                {line.name}
                            </div>

                            {/* Grid Lines */}
                            <div className="absolute inset-0 pointer-events-none">
                                {hours.map(h => (
                                    <div key={h} className="absolute border-l border-dashed border-gray-100 dark:border-gray-700 h-full" style={{ left: h * hourWidth }}></div>
                                ))}
                            </div>

                            {/* Blocks */}
                            <div className="flex-1 relative mt-2">
                                {runs.filter(r => r.lineId === line.id).map(run => (
                                    <div
                                        key={run.id}
                                        onClick={() => onRunClick(run)}
                                        className="absolute top-1 h-16 rounded-lg shadow-sm cursor-pointer hover:brightness-110 transition-all border border-black/10 text-white p-2 overflow-hidden"
                                        style={{
                                            left: getLeftPos(run.startTime),
                                            width: getWidth(run.durationHours),
                                            backgroundColor: getColorForSKU(run.sku)
                                        }}
                                    >
                                        <div className="font-bold text-sm leading-tight">{run.sku}</div>
                                        <div className="text-[10px] opacity-90">{run.targetCases?.toLocaleString()} cases</div>
                                        {run.status === 'running' && (
                                            <div className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-sm"></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

