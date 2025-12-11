import { useState, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'; // Falling back to text if icons issue, but package.json has heroicons

export default function CalendarDemand({ monthlyDemand, updateDateDemand, monthlyInbound, updateDateInbound, monthlyProductionActuals, updateDateActual, specs, trucksToCancel, dailyLedger, safetyTarget }) {
    const [viewDate, setViewDate] = useState(new Date());

    // Generate calendar grid
    const { days, monthLabel, totalMonthlyDemand, totalEstTrucks } = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay(); // 0 = Sun

        // Array of empty slots for padding start
        const padding = Array(startDayOfWeek).fill(null);

        // Find next truck date (for Push Alert)
        const today = new Date().toISOString().split('T')[0];
        let nextTruckDate = null;
        if (trucksToCancel > 0) {
            const allDates = Object.keys(monthlyInbound || {}).sort();
            nextTruckDate = allDates.find(d => d >= today && monthlyInbound[d] > 0);
        }

        // Map dailyLedger to a dictionary for fast lookup
        const ledgerMap = (dailyLedger || []).reduce((acc, item) => {
            acc[item.date] = item.balance;
            return acc;
        }, {});

        // Array of days
        const dateArray = Array.from({ length: daysInMonth }, (_, i) => {
            const d = new Date(year, month, i + 1);
            const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD

            // Get Ending Inventory (Balance) for this date
            const endInvBottles = ledgerMap[dateStr];
            // Format to Load Equivalent (more readable?) or just bottles. 
            // Planners often think in "Weeks of Supply" or "Trucks". 
            // Let's show "Trucks" or "Pallets"? Or raw bottles?
            // "Cases" is usually best denominator.
            // Let's us "Cases" (balance / bottlesPerCase).
            let endInvCases = null;
            if (endInvBottles !== undefined && specs?.bottlesPerCase) {
                endInvCases = Math.round(endInvBottles / specs.bottlesPerCase);
            }

            return {
                date: d,
                dateStr,
                dayNum: i + 1,
                val: monthlyDemand[dateStr] || 0,
                trucks: monthlyInbound?.[dateStr] || 0,
                actual: monthlyProductionActuals?.[dateStr],
                isPushCandidate: nextTruckDate === dateStr,
                endInvCases: endInvCases,
                isSafetyRisk: endInvBottles !== undefined && endInvBottles < (safetyTarget || 0),
                isOverflow: endInvBottles !== undefined && endInvBottles > ((safetyTarget || 0) + (specs?.bottlesPerTruck || 0) * 2)
            };
        });

        const totalMonthlyDemand = dateArray.reduce((sum, d) => {
            const usage = (d.actual !== undefined && d.actual !== null) ? Number(d.actual) : (d.val || 0);
            return sum + usage;
        }, 0);

        // Est Trucks Calculation
        let totalEstTrucks = 0;
        if (specs && specs.bottlesPerTruck && specs.bottlesPerCase) {
            // Cases per truck = bottlesPerTruck / bottlesPerCase
            const casesPerTruck = specs.bottlesPerTruck / specs.bottlesPerCase;
            totalEstTrucks = Math.ceil(totalMonthlyDemand / casesPerTruck);
        }

        return {
            days: [...padding, ...dateArray],
            monthLabel: firstDay.toLocaleString('default', { month: 'long', year: 'numeric' }),
            totalMonthlyDemand,
            totalEstTrucks
        };
    }, [viewDate, monthlyDemand, monthlyInbound, monthlyProductionActuals, specs, trucksToCancel]);

    const changeMonth = (offset) => {
        setViewDate(prev => {
            const d = new Date(prev);
            d.setMonth(d.getMonth() + offset);
            return d;
        });
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow h-full flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
                <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded text-gray-600">
                    &lt; Prev
                </button>
                <div className="text-center">
                    <h3 className="font-bold text-gray-800">{monthLabel}</h3>
                    <p className="text-xs text-blue-600 font-medium">
                        {totalMonthlyDemand.toLocaleString()} Cases
                        {totalEstTrucks > 0 && <span className="text-gray-400 ml-1">(~{totalEstTrucks} Trucks)</span>}
                    </p>
                </div>
                <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded text-gray-600">
                    Next &gt;
                </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-500 mb-2">
                <div>SUN</div>
                <div>MON</div>
                <div>TUE</div>
                <div>WED</div>
                <div>THU</div>
                <div>FRI</div>
                <div>SAT</div>
            </div>

            <div className="grid grid-cols-7 gap-1 flex-1">
                {days.map((day, idx) => {
                    if (!day) return <div key={`pad-${idx}`} className="bg-gray-50/50 rounded" />;

                    const isToday = new Date().toISOString().split('T')[0] === day.dateStr;
                    const hasDemand = day.val > 0;
                    const hasActual = day.actual !== undefined;
                    const hasTrucks = day.trucks > 0;
                    const isPush = day.isPushCandidate;

                    return (
                        <div
                            key={day.dateStr}
                            className={`
                                relative p-1 rounded border min-h-[90px] flex flex-col justify-between
                                ${isToday ? 'border-blue-400 bg-blue-50' : 'border-gray-100'}
                                ${hasDemand || hasTrucks || hasActual ? 'bg-white' : 'bg-gray-50'}
                                ${isPush ? 'ring-2 ring-red-400 ring-opacity-50' : ''}
                            `}
                        >
                            <span className={`text-[10px] items-start mb-1 ${isToday ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                                {day.dayNum}
                            </span>

                            <div className="flex flex-col space-y-1">
                                {/* Plan Input */}
                                <div className="flex items-center">
                                    <span className="text-[8px] text-gray-400 w-3">P:</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        className={`
                                            w-full text-center text-xs p-0 border-0 bg-transparent focus:ring-0 font-medium
                                            ${hasDemand ? 'text-gray-900 border-b border-gray-100' : 'text-gray-300'}
                                        `}
                                        placeholder="-"
                                        value={day.val ? day.val.toLocaleString() : ''}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/,/g, '');
                                            if (!isNaN(raw)) {
                                                updateDateDemand(day.dateStr, raw);
                                            }
                                        }}
                                    />
                                </div>

                                {/* Actual Input */}
                                <div className="flex items-center">
                                    <span className="text-[8px] text-blue-400 w-3 font-bold">A:</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        className={`
                                            w-full text-center text-xs p-0 border-0 bg-transparent focus:ring-0 font-bold
                                            ${hasActual ? 'text-blue-700 bg-blue-50/50 rounded' : 'text-gray-300'}
                                        `}
                                        placeholder="-"
                                        value={hasActual ? day.actual.toLocaleString() : ''}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/,/g, '');
                                            if (!isNaN(raw)) {
                                                updateDateActual(day.dateStr, raw);
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Inbound Trucks Input - With Alert Pulsing */}
                            <div className={`
                                flex items-center justify-center mt-1 border-t border-gray-100 pt-1 transition-all duration-500
                                ${hasTrucks ? (isPush ? 'bg-red-100 animate-pulse rounded' : 'bg-green-50 animate-pulse rounded') : ''}
                            `}>
                                <span className="text-[9px] mr-1 text-gray-400">🚛</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    className={`
                                        w-6 text-center text-[10px] p-0 border-0 bg-transparent focus:ring-0 font-bold
                                        ${hasTrucks ? (isPush ? 'text-red-600' : 'text-green-600') : 'text-gray-300'}
                                    `}
                                    placeholder="0"
                                    value={day.trucks > 0 ? day.trucks : ''}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/,/g, '');
                                        if (!isNaN(raw)) {
                                            updateDateInbound(day.dateStr, raw);
                                        }
                                    }}
                                />
                            </div>

                            {/* Ending Inventory Row */}
                            {day.endInvCases !== null && (
                                <div className={`
                                    text-[9px] text-center mt-auto pt-1 font-mono
                                    ${day.isSafetyRisk ? 'text-red-500 font-bold' :
                                        day.isOverflow ? 'text-orange-500 font-bold' : 'text-gray-400'}
                                `}>
                                    {day.endInvCases.toLocaleString()} cs
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
