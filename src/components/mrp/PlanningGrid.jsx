import { useState, useRef, useEffect } from 'react';

export default function PlanningGrid({
    monthlyDemand, updateDateDemand,
    monthlyInbound, updateDateInbound,
    monthlyProductionActuals, updateDateActual,
    specs, safetyTarget, dailyLedger
}) {
    // We display 35 days (5 weeks) from today or selected start date
    const [startDate, setStartDate] = useState(new Date());

    // Generate Date Range
    const dates = [];
    const _d = new Date(startDate);
    _d.setDate(_d.getDate() - 2); // Start 2 days back for context
    const numDays = 45; // Show lots of days

    for (let i = 0; i < numDays; i++) {
        dates.push(new Date(_d));
        _d.setDate(_d.getDate() + 1);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Ledger Map for quick lookup
    const ledgerMap = (dailyLedger || []).reduce((acc, item) => {
        acc[item.date] = item; // { balance, demand, supply }
        return acc;
    }, {});


    // Scroll Handling to center 'Today'
    const scrollRef = useRef(null);
    useEffect(() => {
        if (scrollRef.current) {
            // center approx? 100px per col.
            // Start -2 days. So today is index 2.
            scrollRef.current.scrollLeft = 0;
        }
    }, []);

    // Helper to format numbers (K format for space?)
    const fmt = (n) => {
        if (!n) return '-';
        if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
        return n.toLocaleString();
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">


            {/* Grid Container */}
            <div className="flex-1 overflow-auto relative" ref={scrollRef}>
                <table className="min-w-max border-collapse">
                    <thead className="sticky top-0 z-10">
                        <tr>
                            <th className="sticky left-0 min-w-[140px] bg-gray-100 dark:bg-gray-800 border-b border-r border-gray-300 dark:border-gray-600 p-2 text-left text-xs font-bold text-gray-500 uppercase z-20 shadow-md">
                                Metric
                            </th>
                            {dates.map(date => {
                                const dateStr = date.toISOString().split('T')[0];
                                const isToday = dateStr === todayStr;
                                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                return (
                                    <th key={dateStr} className={`
                                        min-w-[80px] w-[80px] p-2 text-center border-b border-r border-gray-200 dark:border-gray-700 text-xs 
                                        ${isToday ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold border-b-2 border-b-blue-500' : 'bg-gray-50 dark:bg-gray-800'}
                                        ${isWeekend ? 'bg-gray-100 dark:bg-gray-700/50 opacity-80' : ''}
                                    `}>
                                        <div className="uppercase text-[9px] opacity-70">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                        <div>{date.getDate()}</div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {/* 1. DEMAND ROW */}
                        <tr>
                            <th className="sticky left-0 bg-white dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 p-2 text-left text-xs font-bold text-gray-700 dark:text-gray-300 z-10 shadow-md">
                                Demand (Plan)
                            </th>
                            {dates.map(date => {
                                const dateStr = date.toISOString().split('T')[0];
                                const val = monthlyDemand[dateStr] || 0;
                                return (
                                    <td key={dateStr} className="p-0 border-r border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <input
                                            className="w-full h-full p-2 text-center text-xs bg-transparent focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                                            value={val || ''}
                                            placeholder="-"
                                            onChange={e => {
                                                const v = e.target.value.replace(/,/g, '');
                                                if (!isNaN(v)) updateDateDemand(dateStr, v);
                                            }}
                                        />
                                    </td>
                                );
                            })}
                        </tr>

                        {/* 2. ACTUAL ROW */}
                        <tr className="bg-blue-50/20 dark:bg-blue-900/10">
                            <th className="sticky left-0 bg-white dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 p-2 text-left text-xs font-bold text-blue-600 dark:text-blue-400 z-10 shadow-md">
                                Actual / Prod
                            </th>
                            {dates.map(date => {
                                const dateStr = date.toISOString().split('T')[0];
                                const val = monthlyProductionActuals[dateStr];
                                const hasVal = val !== undefined;
                                return (
                                    <td key={dateStr} className="p-0 border-r border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <input
                                            className={`w-full h-full p-2 text-center text-xs bg-transparent focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 font-bold
                                                ${hasVal ? 'text-blue-700 dark:text-blue-300' : 'text-gray-400'}
                                            `}
                                            value={hasVal ? val : ''}
                                            placeholder="-"
                                            onChange={e => {
                                                const v = e.target.value.replace(/,/g, '');
                                                if (!isNaN(v)) updateDateActual(dateStr, v);
                                            }}
                                        />
                                    </td>
                                );
                            })}
                        </tr>

                        {/* 3. INBOUND TRUCKS */}
                        <tr>
                            <th className="sticky left-0 bg-white dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 p-2 text-left text-xs font-bold text-green-600 dark:text-green-500 z-10 shadow-md">
                                Inbound Trucks
                            </th>
                            {dates.map(date => {
                                const dateStr = date.toISOString().split('T')[0];
                                const val = monthlyInbound[dateStr] || 0;
                                return (
                                    <td key={dateStr} className="p-0 border-r border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <input
                                            className={`w-full h-full p-2 text-center text-xs bg-transparent focus:bg-green-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500 font-bold
                                                ${val > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-300'}
                                            `}
                                            value={val || ''}
                                            placeholder="0"
                                            onChange={e => {
                                                const v = e.target.value.replace(/,/g, '');
                                                if (!isNaN(v)) updateDateInbound(dateStr, v);
                                            }}
                                        />
                                    </td>
                                );
                            })}
                        </tr>


                        {/* 4. NET INVENTORY (Balance) */}
                        <tr className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
                            <th className="sticky left-0 bg-gray-100 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 p-2 text-left text-xs font-bold text-gray-800 dark:text-white z-10 shadow-md">
                                End Inventory
                            </th>
                            {dates.map(date => {
                                const dateStr = date.toISOString().split('T')[0];
                                const ledgerItem = ledgerMap[dateStr];
                                const balance = ledgerItem ? ledgerItem.balance : null;
                                // Convert to Pallets? Or Cases?
                                // Let's simplify and do PALLETS for Planner View
                                const casesPerPallet = specs?.casesPerPallet || 100;
                                const bottlesPerCase = specs?.bottlesPerCase || 1;
                                const pallets = balance !== null ? Math.round(balance / bottlesPerCase / casesPerPallet) : null;

                                // Colors
                                let bgClass = '';
                                if (balance !== null && safetyTarget) {
                                    if (balance < safetyTarget) bgClass = 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-bold';
                                    else if (balance > safetyTarget + (specs?.bottlesPerTruck * 2)) bgClass = 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300';
                                    else bgClass = 'text-gray-600 dark:text-gray-300';
                                }

                                return (
                                    <td key={dateStr} className={`p-2 text-center text-xs border-r border-gray-200 dark:border-gray-700 ${bgClass}`}>
                                        {pallets !== null ? fmt(pallets) : '-'}
                                    </td>
                                );
                            })}
                        </tr>
                    </tbody>
                </table>
            </div>
            <div className="p-2 bg-gray-50 text-[10px] text-gray-400 text-center dark:bg-gray-800">
                Values in Cases/Pallets as configured. showing 45 days.
            </div>
        </div>
    );
}
