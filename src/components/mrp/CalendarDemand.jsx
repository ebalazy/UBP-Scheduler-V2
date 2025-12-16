import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { createPortal } from 'react-dom';
import { addDays, formatLocalDate } from '../../utils/dateUtils';

export default function CalendarDemand({
    monthlyDemand,
    updateDateDemand,
    updateDateDemandBulk, // New Prop
    monthlyInbound,
    updateDateInbound,
    monthlyProductionActuals,
    updateDateActual,
    specs,
    trucksToCancel,
    dailyLedger,
    safetyTarget,
    poManifest = {},
    readOnly = false
}) {
    // Start with strictly local date (no time component issues)
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
        // Use local date string comparison
        const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

        let nextTruckDate = null;
        if (trucksToCancel > 0) {
            const allDates = Object.keys(monthlyInbound || {}).sort();
            nextTruckDate = allDates.find(d => d >= todayStr && monthlyInbound[d] > 0);
        }

        // Map dailyLedger to a dictionary for fast lookup
        const ledgerMap = (dailyLedger || []).reduce((acc, item) => {
            acc[item.date] = item.balance;
            return acc;
        }, {});

        // Array of days
        const dateArray = Array.from({ length: daysInMonth }, (_, i) => {
            // Safe Local Date Construction
            const d = new Date(year, month, i + 1);

            // Format to YYYY-MM-DD strictly local
            const yStr = d.getFullYear();
            const mStr = String(d.getMonth() + 1).padStart(2, '0');
            const dStr = String(d.getDate()).padStart(2, '0');
            const dateStr = `${yStr}-${mStr}-${dStr}`;

            // Get Ending Inventory (Balance) for this date
            const endInvBottles = ledgerMap[dateStr];
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
                isOverflow: endInvBottles !== undefined && endInvBottles > ((safetyTarget || 0) + (specs?.bottlesPerTruck || 0) * 2),
                isConfirmed: poManifest[dateStr]?.items?.length > 0
            };
        });

        const totalMonthlyDemand = dateArray.reduce((sum, d) => {
            const usage = (d.actual !== undefined && d.actual !== null) ? Number(d.actual) : Number(d.val || 0);
            return sum + usage;
        }, 0);

        // Est Trucks Calculation
        let totalEstTrucks = 0;
        if (specs && specs.bottlesPerTruck && specs.bottlesPerCase) {
            const casesPerTruck = specs.bottlesPerTruck / specs.bottlesPerCase;
            totalEstTrucks = Math.ceil(totalMonthlyDemand / casesPerTruck);
        }

        return {
            days: [...padding, ...dateArray],
            monthLabel: firstDay.toLocaleString('default', { month: 'long', year: 'numeric' }),
            totalMonthlyDemand,
            totalEstTrucks
        };
    }, [viewDate, monthlyDemand, monthlyInbound, monthlyProductionActuals, specs, trucksToCancel, poManifest, dailyLedger, safetyTarget]); // Added missing deps

    const changeMonth = (offset) => {
        setViewDate(prev => {
            const d = new Date(prev);
            d.setMonth(d.getMonth() + offset);
            return d;
        });
    };

    // --- Context Menu Logic for Calendar ---
    const [contextMenu, setContextMenu] = useState(null); // { x, y, dateStr, currentVal }

    const closeContextMenu = () => setContextMenu(null);

    const handleContextMenu = (e, dateStr, currentVal) => {
        if (readOnly) return;
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            dateStr,
            currentVal
        });
    };

    const performBulkFill = (mode) => {
        if (!contextMenu) return;
        const { dateStr, currentVal } = contextMenu;

        // Parse value cleanly
        const valStr = String(currentVal || '').replace(/,/g, '');
        const val = parseInt(valStr, 10);

        if (!val && val !== 0) { // Allow 0? Usually we explicitly set numbers. If empty/NaN skip.
            closeContextMenu();
            return;
        }

        const updates = {};
        updates[dateStr] = val.toString();

        if (mode === 'week') {
            for (let i = 1; i < 7; i++) {
                updates[addDays(dateStr, i)] = val.toString();
            }
        }

        if (mode === 'month') {
            const [y, m] = dateStr.split('-').map(Number);
            const currentMonth = m - 1; // 0-indexed for comparison
            let i = 1;
            while (true) {
                const nextDS = addDays(dateStr, i);
                const [ny, nm] = nextDS.split('-').map(Number);
                if ((nm - 1) !== currentMonth) break;
                updates[nextDS] = val.toString();
                i++;
                if (i > 31) break;
            }
        }

        if (mode === 'restOfWeek') {
            // For calendar, rest of week means until the row ends (Saturday)
            // Calendar is visual.
            // Standard: Sun(0) ... Sat(6).
            // If today is Wed(3), fill Thu(4), Fri(5), Sat(6).
            const d = new Date(dateStr.replace(/-/g, '/')); // Split/Map safer usually but this logic needs Day Index
            // Actually, safely parse y,m,d
            const [y, m, day] = dateStr.split('-').map(Number);
            const dateObj = new Date(y, m - 1, day);

            let i = 1;
            while (true) {
                const nextDS = addDays(dateStr, i);
                const [ny, nm, nd] = nextDS.split('-').map(Number);
                const nextD = new Date(ny, nm - 1, nd);

                // If we wrap week? Calendar rows usually end Saturday.
                // If nextD is Sunday (0), we stopped Saturday.
                if (nextD.getDay() === 0) break;

                updates[nextDS] = val.toString();
                i++;
                if (i > 7) break;
            }
        }

        if (updateDateDemandBulk) updateDateDemandBulk(updates);
        closeContextMenu();
    };


    // --- RENDER HELPERS ---
    const getInventoryColor = (day) => {
        if (day.isSafetyRisk) return 'bg-red-500';
        if (day.isOverflow) return 'bg-amber-400';
        return 'bg-emerald-400'; // Healthy
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl">
            {/* Header Navigation */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full shadow-sm transition-all text-slate-500 hover:text-blue-600">
                        <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                        {monthLabel}
                        <span className="text-sm font-medium text-slate-400 font-mono tracking-normal bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            {viewDate.getFullYear()}
                        </span>
                    </h2>
                    <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full shadow-sm transition-all text-slate-500 hover:text-blue-600">
                        <ChevronRightIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex gap-4 text-xs font-bold text-slate-500">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>{totalEstTrucks} Trucks Est.</span>
                    </div>
                </div>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-4 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                    <div key={d} className={`text-center text-xs font-bold uppercase tracking-wider py-1
                        ${i === 0 || i === 6 ? 'text-slate-400' : 'text-slate-600 dark:text-slate-300'}
                    `}>
                        {d}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-3 min-h-0">
                {days.map((day, i) => {
                    if (!day) return <div key={`pad-${i}`} className="bg-transparent" />; // Empty slot

                    const isToday = day.dateStr === new Date().toLocaleDateString('en-CA');
                    const hasTrucks = day.trucks > 0;
                    const hasDemand = day.val > 0;

                    return (
                        <div
                            key={day.dateStr}
                            onContextMenu={(e) => handleContextMenu(e, day.dateStr, day.val)}
                            className={`
                                relative group flex flex-col justify-between p-2 rounded-xl transition-all duration-200 border
                                ${isToday
                                    ? 'bg-white dark:bg-slate-800 ring-2 ring-blue-500 border-blue-500 shadow-blue-500/10 z-10 scale-[1.02]'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md hover:-translate-y-0.5'
                                }
                                ${day.isSafetyRisk ? 'ring-1 ring-red-500/20 bg-red-50/10' : ''}
                            `}
                        >
                            {/* Date Header */}
                            <div className="flex justify-between items-start">
                                <span className={`
                                    text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full
                                    ${isToday
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-700 dark:text-slate-300 group-hover:bg-slate-100 dark:group-hover:bg-slate-700'
                                    }
                                `}>
                                    {day.dayNum}
                                </span>
                                {day.isConfirmed && (
                                    <span title="Confirmed POs" className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800">
                                        PO
                                    </span>
                                )}
                            </div>

                            {/* Main Metrics */}
                            <div className="flex flex-col gap-1 mt-1">
                                {hasTrucks && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-md border border-emerald-100 dark:border-emerald-800/50">
                                        <span className="text-xs">🚛</span>
                                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                                            {Number(day.trucks)}
                                        </span>
                                    </div>
                                )}
                                {hasDemand && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5">
                                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Dem</span>
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                            {Number(day.val).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Inventory Health Bar (Footer) */}
                            <div className="mt-2 h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                                <div
                                    className={`h-full ${getInventoryColor(day)}`}
                                    style={{ width: '100%' }}
                                    title={`Inventory Health: ${day.isSafetyRisk ? 'Critical' : 'Healthy'}`}
                                />
                            </div>

                        </div>
                    );
                })}
            </div>

            {/* Context Menu Portal */}
            {contextMenu && createPortal(
                <div
                    className="fixed z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-2 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quick Fill</p>
                    </div>
                    <button onClick={() => performBulkFill('week')} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 flex items-center gap-2">
                        <span>📅</span> Fill Next 7 Days
                    </button>
                    <button onClick={() => performBulkFill('restOfWeek')} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 flex items-center gap-2">
                        <span>➡️</span> Rest of Week
                    </button>
                    <button onClick={() => performBulkFill('month')} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 flex items-center gap-2">
                        <span>🗓️</span> Fill Rest of Month
                    </button>
                    <div className="border-t dark:border-slate-700 my-1"></div>
                    <button onClick={closeContextMenu} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                        Cancel
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
}

