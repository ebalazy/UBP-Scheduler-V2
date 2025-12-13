import { useState, useRef, useEffect } from 'react';
import { formatLocalDate } from '../../utils/dateUtils';

import { useProcurement } from '../../context/ProcurementContext';
import ScheduleManagerModal from '../procurement/ScheduleManagerModal';

export default function PlanningGrid({
    monthlyDemand, updateDateDemand, updateDateDemandBulk,
    monthlyInbound, updateDateInbound,
    monthlyProductionActuals, updateDateActual,
    specs, safetyTarget, dailyLedger
}) {
    // We display 35 days (5 weeks) from today or selected start date
    const [startDate, setStartDate] = useState(new Date());
    const { poManifest } = useProcurement();

    // Schedule Manager State
    const [managerDate, setManagerDate] = useState(null); // '2023-10-25'
    const [isManagerOpen, setIsManagerOpen] = useState(false);

    const openManager = (dateStr) => {
        setManagerDate(dateStr);
        setIsManagerOpen(true);
    };

    // Generate Date Range
    const dates = [];
    const _d = new Date(startDate);
    _d.setDate(_d.getDate() - 2); // Start 2 days back for context
    const numDays = 45; // Show lots of days

    for (let i = 0; i < numDays; i++) {
        dates.push(new Date(_d));
        _d.setDate(_d.getDate() + 1);
    }

    const todayStr = formatLocalDate(new Date());

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
                                <span>Metric</span>
                            </th>
                            {dates.map(date => {
                                const dateStr = formatLocalDate(date);
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
                            <th className="sticky left-0 bg-white dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 p-2 text-left text-xs font-bold text-gray-700 dark:text-gray-300 z-10 shadow-md group relative">
                                Production (Plan)
                                {/* Tooltip Trick */}
                                <div className="hidden group-hover:block absolute left-full top-0 ml-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-lg z-50 pointer-events-none">
                                    <strong>⚡ Power Tip:</strong><br />
                                    Type <code>60000*5</code> and hit Enter to fill 5 days at once!
                                </div>
                            </th>
                            {dates.map((date, idx) => {
                                const dateStr = formatLocalDate(date);
                                const val = monthlyDemand[dateStr];

                                return (
                                    <td key={dateStr} className="p-0 border-r border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <input
                                            id={`demand-${dateStr}`}
                                            className="w-full h-full p-2 text-center text-xs bg-transparent focus:bg-blue-50 dark:focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:text-gray-200"
                                            value={val || ''} // Allow raw chars during typing if needed, but usually controlled. using simple value prop.
                                            placeholder="-"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const rawVal = e.target.value.replace(/,/g, '');

                                                    // Check for Smart Batch Syntax: "Number*Days" (e.g. 60000*5)
                                                    const match = rawVal.match(/^(\d+)\*(\d+)$/);

                                                    if (match) {
                                                        const value = match[1];
                                                        const count = parseInt(match[2], 10);

                                                        // Generate Bulk Update Map
                                                        const updates = {};
                                                        let nextDate = new Date(date); // Start with current day

                                                        // Current Day
                                                        updates[dateStr] = value;

                                                        // Next (count-1) days
                                                        for (let i = 1; i < count; i++) {
                                                            nextDate.setDate(nextDate.getDate() + 1);
                                                            updates[formatLocalDate(nextDate)] = value;
                                                        }

                                                        // Execute Bulk Update
                                                        if (updateDateDemandBulk) {
                                                            updateDateDemandBulk(updates);
                                                        } else {
                                                            // Fallback (shouldn't happen)
                                                            updateDateDemand(dateStr, value);
                                                        }

                                                        // Move Focus to the day AFTER the batch
                                                        const jumpDate = new Date(date);
                                                        jumpDate.setDate(jumpDate.getDate() + count);
                                                        const jumpId = `demand-${formatLocalDate(jumpDate)}`;
                                                        const jumpEl = document.getElementById(jumpId);
                                                        if (jumpEl) {
                                                            jumpEl.focus();
                                                            jumpEl.select();
                                                        }

                                                        return; // Done
                                                    }

                                                    // Standard Move (Next Day)
                                                    const nextDate = new Date(date);
                                                    nextDate.setDate(nextDate.getDate() + 1);
                                                    const nextId = `demand-${formatLocalDate(nextDate)}`;
                                                    const nextEl = document.getElementById(nextId);
                                                    if (nextEl) {
                                                        nextEl.focus();
                                                        nextEl.select();
                                                    }
                                                }
                                            }}
                                            onChange={e => {
                                                // Allow typing numbers AND '*'
                                                const v = e.target.value;
                                                // If it contains only digits, commas, or *, allow it. 
                                                // Actually, we just want to update state. 
                                                // But monthlyDemand usually expects just numbers?
                                                // If we pass '60000*5' to updateDateDemand, it might get saved to state as a string.
                                                // That's fine for temporary typing, as long as calculation logic downstream handles NaN gracefully.
                                                // (PlanningGrid calculations use `Number(val)` which becomes NaN).
                                                // Let's ensure we allow it.
                                                updateDateDemand(dateStr, v);
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
                            {dates.map((date, idx) => {
                                const dateStr = formatLocalDate(date);
                                const val = monthlyProductionActuals[dateStr];
                                const hasVal = val !== undefined;
                                return (
                                    <td key={dateStr} className="p-0 border-r border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <input
                                            id={`actual-${dateStr}`}
                                            className={`w-full h-full p-2 text-center text-xs bg-transparent focus:bg-blue-50 dark:focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 font-bold
                                                ${hasVal ? 'text-blue-700 dark:text-blue-300' : 'text-gray-400'}
                                            `}
                                            value={hasVal ? Number(val).toLocaleString() : ''}
                                            placeholder="-"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    // Move to next day
                                                    const nextDate = new Date(date);
                                                    nextDate.setDate(nextDate.getDate() + 1);
                                                    const nextId = `actual-${formatLocalDate(nextDate)}`;
                                                    const nextEl = document.getElementById(nextId);
                                                    if (nextEl) {
                                                        nextEl.focus();
                                                        nextEl.select();
                                                    }
                                                }
                                            }}
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
                                const dateStr = formatLocalDate(date);
                                // Logic: If we have POs, count them. Rule: 1 PO = 1 Truck.
                                // If not, fallback to manual 'monthlyInbound' value.
                                const manifestItems = poManifest[dateStr]?.items || [];
                                const hasManifest = manifestItems.length > 0;
                                const val = hasManifest ? manifestItems.length : (monthlyInbound[dateStr] || 0);

                                return (
                                    <td key={dateStr} className="p-0 border-r border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 relative group">
                                        {hasManifest ? (
                                            /* PO MODE: Clickable Number */
                                            <button
                                                className="w-full h-full p-2 text-center text-xs font-bold text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors flex items-center justify-center gap-1"
                                                onClick={() => openManager(dateStr)}
                                                title={`${manifestItems.length} POs - Click to Manage`}
                                            >
                                                {val}
                                                {/* Subtle Dot to indicate this is a Manifest value */}
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                            </button>
                                        ) : (
                                            /* MANUAL MODE: Input */
                                            <input
                                                className={`w-full h-full p-2 text-center text-xs bg-transparent focus:bg-green-50 dark:focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500 font-bold
                                                    ${val > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-300'}
                                                `}
                                                value={val || ''}
                                                placeholder="0"
                                                onChange={e => {
                                                    const v = e.target.value.replace(/,/g, '');
                                                    if (!isNaN(v)) updateDateInbound(dateStr, v);
                                                }}
                                                onDoubleClick={() => openManager(dateStr)}
                                            />
                                        )}
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
                                const dateStr = formatLocalDate(date);
                                const ledgerItem = ledgerMap[dateStr];
                                const balance = ledgerItem ? ledgerItem.balance : null;

                                // Conversion Config
                                const casesPerPallet = specs?.casesPerPallet || 100;
                                const bottlesPerCase = specs?.bottlesPerCase || 1;
                                const bottlesPerTruck = specs?.bottlesPerTruck || 20000;
                                const totalPallets = balance !== null ? Math.round(balance / bottlesPerCase / casesPerPallet) : null;

                                // Smart Label Logic
                                let label = '-';
                                if (totalPallets !== null) {
                                    const palletsPerTruck = Math.floor(bottlesPerTruck / bottlesPerCase / casesPerPallet) || 22;
                                    if (Math.abs(totalPallets) >= palletsPerTruck) {
                                        // Show Trucks + Remainder Pallets (e.g. "2T 5P")
                                        const trucks = Math.floor(totalPallets / palletsPerTruck);
                                        const remainder = totalPallets % palletsPerTruck;
                                        label = `${trucks}T ${remainder}P`;
                                    } else {
                                        // Just Pallets (e.g. "15P")
                                        label = `${totalPallets}`;
                                    }
                                }

                                // Colors
                                let bgClass = '';
                                if (balance !== null && safetyTarget) {
                                    if (balance < safetyTarget) bgClass = 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-bold';
                                    else if (balance > safetyTarget + (bottlesPerTruck * 2)) bgClass = 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300';
                                    else bgClass = 'text-gray-600 dark:text-gray-300';
                                }

                                return (
                                    <td key={dateStr} className={`p-2 text-center text-xs border-r border-gray-200 dark:border-gray-700 ${bgClass}`}>
                                        {label}
                                    </td>
                                );
                            })}
                        </tr>

                        {/* 5. COVERAGE (Days of Supply) */}
                        <tr className="border-t border-gray-300 dark:border-gray-600">
                            <th className="sticky left-0 bg-white dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 p-2 text-left text-xs font-bold text-gray-500 uppercase z-10 shadow-md">
                                Coverage (DOS)
                            </th>
                            {dates.map((date, idx) => {
                                const dateStr = formatLocalDate(date);
                                const ledgerItem = ledgerMap[dateStr];
                                const balance = ledgerItem ? ledgerItem.balance : 0;
                                const specsScrap = 1 + ((specs?.scrapPercentage || 0) / 100);

                                // Calculate Coverage
                                let coverage = 0;
                                let remaining = balance;
                                let isInfinite = false;

                                // Look ahead up to 14 days
                                for (let i = 1; i <= 30; i++) {
                                    // We need future dates. dates[] array has 45 days. 
                                    // We can use the array index for speed if aligned, but date math is safer.
                                    // Let's use the `dates` array since it maps perfectly? 
                                    // Actually, we need to look beyond the rendered grid if possible, 
                                    // but looking at `monthlyDemand` map is safer.
                                    const nextDate = new Date(date);
                                    nextDate.setDate(nextDate.getDate() + i);
                                    const nextDateStr = formatLocalDate(nextDate);

                                    const demand = (monthlyDemand[nextDateStr] || 0) * specs.bottlesPerCase * specsScrap;

                                    if (demand === 0) {
                                        // If no demand, we survive this day "for free"
                                        // But if demand is 0 forever, coverage is infinite.
                                        // Let's count it as 1 day of coverage.
                                        coverage += 1;
                                        if (i === 30) isInfinite = true; // Cap at 30
                                        continue;
                                    }

                                    if (remaining >= demand) {
                                        remaining -= demand;
                                        coverage += 1;
                                    } else {
                                        // Partial Day
                                        coverage += remaining / demand;
                                        remaining = 0;
                                        break;
                                    }
                                }

                                const val = coverage.toFixed(1);
                                const numericVal = parseFloat(val);

                                // Color Logic
                                let colorClass = 'text-gray-400';
                                if (balance > 0) {
                                    if (numericVal < 2.0) colorClass = 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-bold';
                                    else if (numericVal < 4.0) colorClass = 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 font-bold';
                                    else colorClass = 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-bold';
                                }

                                return (
                                    <td key={dateStr} className={`p-2 text-center text-xs border-r border-gray-200 dark:border-gray-700 ${colorClass}`}>
                                        {isInfinite ? '>30' : val}
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

            {/* Schedule Manager */}
            {managerDate && (
                <ScheduleManagerModal
                    isOpen={isManagerOpen}
                    onClose={() => setIsManagerOpen(false)}
                    date={managerDate}
                    orders={poManifest[managerDate]?.items || []}
                    monthlyInbound={monthlyInbound}
                    updateDateInbound={updateDateInbound}
                />
            )}
        </div>
    );
}
