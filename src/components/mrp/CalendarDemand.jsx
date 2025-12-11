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

            {/* Day Header (Desktop Only) */}
            <div className="hidden md:grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-500 mb-2">
                <div>SUN</div>
                <div>MON</div>
                <div>TUE</div>
                <div>WED</div>
                <div>THU</div>
                <div>FRI</div>
                <div>SAT</div>
            </div>

            {/* Calendar Grid / List */}
            <div className="flex flex-col space-y-2 md:space-y-0 md:grid md:grid-cols-7 md:gap-1 flex-1">
                {days.map((day, idx) => {
                    // Padding slots (Desktop only)
                    if (!day) return <div key={`pad-${idx}`} className="hidden md:block bg-gray-50/50 rounded" />;

                    const isToday = new Date().toISOString().split('T')[0] === day.dateStr;
                    const hasDemand = day.val > 0;
                    const hasActual = day.actual !== undefined;
                    const hasTrucks = day.trucks > 0;
                    const isPush = day.isPushCandidate;

                    return (
                        <div
                            key={day.dateStr}
                            className={`
                                relative rounded border transition-all
                                ${isToday ? 'border-blue-400 bg-blue-50' : 'border-gray-100'}
                                ${hasDemand || hasTrucks || hasActual ? 'bg-white' : 'bg-gray-50'}
                                ${isPush ? 'ring-2 ring-red-400 ring-opacity-50' : ''}
                                
                                /* Desktop Styles */
                                md:p-1 md:min-h-[90px] md:flex-col md:justify-between
                                
                                /* Mobile Styles (List Row) */
                                flex flex-row items-center p-3 justify-between shadow-sm md:shadow-none
                            `}
                        >
                            {/* Date Label */}
                            <div className="flex flex-col md:items-start w-16 md:w-auto">
                                <span className={`text-sm md:text-[10px] ${isToday ? 'text-blue-600 font-bold' : 'text-gray-500 font-medium'}`}>
                                    {day.date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
                                </span>
                                {/* Mobile-only Month label on first of month? Optional */}
                            </div>

                            {/* Inputs Container */}
                            <div className="flex flex-row md:flex-col space-x-4 md:space-x-0 md:space-y-1 items-center md:items-stretch flex-1 md:flex-none justify-center">

                                {/* Plan Input */}
                                <div className="flex items-center space-x-1">
                                    <span className="text-[10px] text-gray-400 w-3 md:inline hidden">P:</span>
                                    <span className="text-[10px] text-gray-400 md:hidden font-bold">Plan</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        className={`
                                            w-12 md:w-full text-center text-sm md:text-xs p-1 md:p-0 border rounded md:border-0 bg-white md:bg-transparent focus:ring-1 focus:ring-blue-200 font-medium
                                            ${hasDemand ? 'text-gray-900 border-gray-300' : 'text-gray-300 border-gray-200'}
                                        `}
                                        placeholder="-"
                                        value={day.val ? day.val.toLocaleString() : ''}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/,/g, '');
                                            if (!isNaN(raw)) updateDateDemand(day.dateStr, raw);
                                        }}
                                    />
                                </div>

                                {/* Actual Input */}
                                <div className="flex items-center space-x-1">
                                    <span className="text-[10px] text-blue-400 w-3 font-bold md:inline hidden">A:</span>
                                    <span className="text-[10px] text-blue-400 md:hidden font-bold">Act</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        className={`
                                            w-12 md:w-full text-center text-sm md:text-xs p-1 md:p-0 border rounded md:border-0 bg-white md:bg-transparent focus:ring-1 focus:ring-blue-200 font-bold
                                            ${hasActual ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-gray-300 border-gray-200'}
                                        `}
                                        placeholder="-"
                                        value={hasActual ? day.actual.toLocaleString() : ''}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/,/g, '');
                                            if (!isNaN(raw)) updateDateActual(day.dateStr, raw);
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Right Side Actions (Trucks + End Inv) */}
                            <div className="flex flex-row md:flex-col items-center space-x-3 md:space-x-0 md:space-y-1 justify-end w-24 md:w-auto">

                                {/* Inbound Trucks Input */}
                                <div className={`
                                    flex items-center justify-center transition-all duration-500
                                    md:mt-1 md:border-t md:border-gray-100 md:pt-1 md:w-full
                                    ${hasTrucks ? (isPush ? 'bg-red-50 animate-pulse rounded p-1 md:p-0' : 'bg-green-50 animate-pulse rounded p-1 md:p-0') : ''}
                                `}>
                                    <span className="text-xs md:text-[9px] mr-1 text-gray-400">🚛</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        className={`
                                            w-6 text-center text-sm md:text-[10px] p-0 border-0 bg-transparent focus:ring-0 font-bold
                                            ${hasTrucks ? (isPush ? 'text-red-600' : 'text-green-600') : 'text-gray-300'}
                                        `}
                                        placeholder="0"
                                        value={day.trucks > 0 ? day.trucks : ''}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/,/g, '');
                                            if (!isNaN(raw)) updateDateInbound(day.dateStr, raw);
                                        }}
                                    />
                                </div>

                                {/* Ending Inventory Row */}
                                {day.endInvCases !== null && (
                                    <div className={`
                                        text-[10px] md:text-[9px] text-center md:mt-auto md:pt-1 font-mono
                                        ${day.isSafetyRisk ? 'text-red-500 font-bold' :
                                            day.isOverflow ? 'text-orange-500 font-bold' : 'text-gray-400'}
                                    `}>
                                        {day.endInvCases.toLocaleString()}
                                        <span className="md:hidden ml-1">cs</span>
                                        <span className="hidden md:inline"> cs</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
