import React, { memo, useState, useEffect, useRef } from 'react';
import { TruckIcon } from '@heroicons/react/24/outline';

const getInventoryColor = (day) => {
    if (day.isSafetyRisk) return 'bg-red-500';
    if (day.isOverflow) return 'bg-amber-400';
    return 'bg-emerald-400'; // Healthy
};

const CalendarDay = memo(({
    day,
    isToday,
    updateDateDemand,
    updateDateActual,
    updateDateInbound,
    onContextMenu,
    performBulkFill,
    readOnly
}) => {
    // Local state for inputs to support "Edit-on-Blur"
    const [localDemand, setLocalDemand] = useState(day?.val || 0);
    const [localActual, setLocalActual] = useState(day?.actual || '');
    const [localInbound, setLocalInbound] = useState(day?.trucks || 0);

    // Sync local state when props change (e.g. from bulk fill or socket update)
    useEffect(() => {
        setLocalDemand(day?.val || 0);
    }, [day?.val]);

    useEffect(() => {
        setLocalActual(day?.actual || '');
    }, [day?.actual]);

    useEffect(() => {
        setLocalInbound(day?.trucks || 0);
    }, [day?.trucks]);

    if (!day) return <div className="bg-transparent" />;

    const hasTrucks = Number(localInbound) > 0;
    const hasDemand = Number(localDemand) > 0;
    const hasActual = localActual !== '' && localActual !== null && localActual !== undefined;

    // --- Handlers ---
    // --- Handlers ---
    const handleDemandCommit = () => {
        let cleanVal = String(localDemand).replace(/,/g, '').trim();
        if (cleanVal === '') cleanVal = '0'; // treat empty as 0

        if (!isNaN(cleanVal) && Number(cleanVal) !== Number(day.val)) {
            updateDateDemand(day.dateStr, cleanVal);
        }
    };

    const handleActualCommit = () => {
        let cleanVal = String(localActual).replace(/,/g, '').trim();

        // Ensure we can clear actuals if needed
        if (cleanVal === '') {
            if (day.actual !== null && day.actual !== '') {
                updateDateActual(day.dateStr, null); // or '' depending on backend
            }
        } else if (!isNaN(cleanVal) && Number(cleanVal) !== Number(day.actual)) {
            updateDateActual(day.dateStr, cleanVal);
        }
    };

    // Inbound is read-only in this view usually, or pure display? 
    // In CalendarDemand.jsx previously:
    // It had an input for Trucks but logic says "Inbound Trucks Input".
    // Let's implement commit for Trucks too if it was editable.
    // Checking previous file content... yes, lines 448-460 had an input for inbound trucks.

    const handleInboundCommit = () => {
        const cleanVal = String(localInbound).replace(/,/g, '');
        if (!isNaN(cleanVal) && Number(cleanVal) !== Number(day.trucks)) {
            updateDateInbound(day.dateStr, cleanVal);
        }
    };

    const handleKeyDown = (e, commitFn) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur(); // Triggers onBlur which triggers commitFn
        }
    };

    return (
        <div
            onContextMenu={(e) => onContextMenu(e, day.dateStr, localDemand)}
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
            <div className="flex justify-between items-center mb-1">
                <span className={`
                    text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full
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

            {/* Inputs Container */}
            <div className="flex-1 flex flex-col items-center justify-center gap-1.5 py-1 min-h-0">

                {/* Demand Input (Hero) */}
                <div className="w-full relative group/demand">
                    <div className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest text-center mb-0.5 group-hover/demand:text-blue-400 transition-colors">
                        Demand
                    </div>
                    <input
                        className={`
                            w-full text-center outline-none bg-transparent transition-all
                            ${readOnly ? 'cursor-not-allowed' : 'cursor-text'}
                            ${hasDemand
                                ? 'text-2xl font-black text-slate-700 dark:text-white'
                                : 'text-xl font-bold text-slate-300 dark:text-slate-600'
                            }
                            focus:scale-110 focus:text-blue-600 dark:focus:text-blue-400
                        `}
                        value={localDemand || ''}
                        placeholder="-"
                        disabled={readOnly}
                        onChange={(e) => setLocalDemand(e.target.value)}
                        onBlur={handleDemandCommit}
                        onKeyDown={(e) => handleKeyDown(e, handleDemandCommit)}
                    />
                </div>

                {/* Actual Input (Secondary Pill) */}
                <div className="flex items-center justify-center w-full">
                    <div className={`
                        flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-all
                        ${hasActual
                            ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-100 dark:ring-blue-800'
                            : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }
                     `}>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider select-none">Act</span>
                        <input
                            className={`
                                w-12 text-center text-xs font-bold bg-transparent outline-none
                                ${hasActual ? 'text-blue-700 dark:text-blue-300' : 'text-slate-400'}
                                focus:text-blue-600 dark:focus:text-blue-400
                            `}
                            value={localActual}
                            placeholder="-"
                            disabled={readOnly}
                            onChange={(e) => setLocalActual(e.target.value)}
                            onBlur={handleActualCommit}
                            onKeyDown={(e) => handleKeyDown(e, handleActualCommit)}
                        />
                    </div>
                </div>
            </div>

            {/* Inbound / Trucks Section */}
            <div className="mt-2 flex items-center justify-end">
                <div className={`
                    flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors
                    ${hasTrucks ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50' : 'text-slate-300'}
                `}>
                    <TruckIcon className="w-3 h-3" />
                    <input
                        className="w-4 text-center text-[10px] font-bold bg-transparent outline-none"
                        value={localInbound || ''}
                        placeholder="0"
                        disabled={readOnly}
                        onChange={(e) => setLocalInbound(e.target.value)}
                        onBlur={handleInboundCommit}
                        onKeyDown={(e) => handleKeyDown(e, handleInboundCommit)}
                    />
                </div>
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
}, (prevProps, nextProps) => {
    // Custom Comparison for Memoization
    // Only re-render if:
    // 1. day.dateStr changed (component reuse)
    // 2. day.val/actual/trucks changed (external update)
    // 3. day.isSafetyRisk/isOverflow changed (inventory status update)
    // 4. isToday changed (time passed)
    // 5. isConfirmed changed (PO updates)

    if (prevProps.day?.dateStr !== nextProps.day?.dateStr) return false;
    if (prevProps.day?.val !== nextProps.day?.val) return false;
    if (prevProps.day?.actual !== nextProps.day?.actual) return false;
    if (prevProps.day?.trucks !== nextProps.day?.trucks) return false;
    if (prevProps.day?.isSafetyRisk !== nextProps.day?.isSafetyRisk) return false;
    if (prevProps.day?.isOverflow !== nextProps.day?.isOverflow) return false;
    if (prevProps.day?.isConfirmed !== nextProps.day?.isConfirmed) return false;
    if (prevProps.isToday !== nextProps.isToday) return false;
    if (prevProps.readOnly !== nextProps.readOnly) return false;

    return true; // Props are equal enough to skip re-render
});

export default CalendarDay;
