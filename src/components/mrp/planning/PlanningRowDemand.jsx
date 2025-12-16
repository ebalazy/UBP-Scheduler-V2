import React, { useRef, useEffect, useMemo, useState, useCallback, memo } from 'react';
import { formatLocalDate, addDays } from '../../../utils/dateUtils';
import { createPortal } from 'react-dom';
import { CalendarDaysIcon, CalendarIcon, ArrowRightIcon } from '@heroicons/react/24/outline'; // Need to ensure these exist or use basic text

const PlanningRowDemand = memo(({ dates, monthlyDemand, updateDateDemand, updateDateDemandBulk, readOnly = false, todayStr }) => {
    const updateRef = useRef(updateDateDemand);
    useEffect(() => { updateRef.current = updateDateDemand; }, [updateDateDemand]);

    return (
        <tr className="group/row">
            <th className="sticky left-0 min-w-[140px] w-[140px] h-8 bg-slate-300 dark:bg-slate-800 border-r border-slate-400 dark:border-slate-600 pl-2 pr-2 text-left text-xs font-bold text-slate-800 dark:text-slate-300 z-10 shadow-md relative">
                <div className="w-full h-full flex items-center">
                    Production (Plan)
                </div>
            </th>
            {dates.map((date) => {
                const dateStr = formatLocalDate(date);
                const val = monthlyDemand[dateStr];

                return (
                    <DemandCell
                        key={dateStr}
                        date={date}
                        dateStr={dateStr}
                        initialValue={val}
                        updateDateDemand={updateDateDemand}
                        updateDateDemandBulk={updateDateDemandBulk}
                        readOnly={readOnly}
                        isToday={dateStr === todayStr}
                    />
                );
            })}
        </tr>
    );
});

export default PlanningRowDemand;

const DemandCell = memo(({ date, dateStr, initialValue, updateDateDemand, updateDateDemandBulk, readOnly, isToday }) => {
    const inputRef = useRef(null);
    const [contextMenu, setContextMenu] = useState(null); // { x, y }

    // Sync from Global State
    useEffect(() => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
            inputRef.current.value = initialValue || '';
        }
    }, [initialValue]);

    const parseValue = (raw) => {
        if (!raw) return '';
        const s = raw.toString().toLowerCase().trim().replace(/,/g, '');
        let multiplier = 1;
        if (s.endsWith('k')) multiplier = 1000;
        else if (s.endsWith('m')) multiplier = 1000000;
        const num = parseFloat(s.replace(/[km]/g, ''));
        if (isNaN(num)) return raw;
        return (num * multiplier).toString();
    };

    const handleBlur = () => {
        if (readOnly) return;
        if (inputRef.current) {
            const finalVal = parseValue(inputRef.current.value);
            // Only update if changed (optional optimization, but good safer bet)
            if (finalVal !== initialValue) {
                updateDateDemand(dateStr, finalVal);
            }
        }
    };

    const handleKeyDown = (e) => {
        if (readOnly) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            const rawVal = e.target.value.replace(/,/g, '');
            const finalVal = parseValue(rawVal);
            updateDateDemand(dateStr, finalVal);

            // Move focus to next cell
            const nextDateStr = addDays(dateStr, 1);
            const nextId = `demand-${nextDateStr}`;
            setTimeout(() => {
                const nextEl = document.getElementById(nextId);
                if (nextEl) {
                    nextEl.focus();
                    nextEl.select();
                }
            }, 0);
        }
    };

    // --- Context Menu Logic ---
    const handleContextMenu = (e) => {
        if (readOnly) return;
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const closeContextMenu = () => setContextMenu(null);

    // Bulk Actions
    const performBulkFill = (mode) => {
        const val = inputRef.current ? parseValue(inputRef.current.value) : initialValue;
        if (!val) return;

        const updates = {};
        // Include self? Usually user implies "fill forward FROM here" including here if they just typed it
        updates[dateStr] = val;

        // 1. Next 7 Days
        if (mode === 'week') {
            for (let i = 1; i < 7; i++) {
                updates[addDays(dateStr, i)] = val;
            }
        }

        // 2. Remainder of Month
        if (mode === 'month') {
            const currentMonth = new Date(date).getMonth();
            let i = 1;
            while (true) {
                const nextDS = addDays(dateStr, i);
                const nextD = new Date(nextDS);
                if (nextD.getMonth() !== currentMonth) break;
                updates[nextDS] = val;
                i++;
                if (i > 31) break; // Safety break
            }
        }

        // 3. Remainder of Week (Until Sunday)
        if (mode === 'restOfWeek') {
            const currentDay = new Date(date).getDay(); // 0 = Sun, 6 = Sat
            // If Sun(0), nothing to fill if we consider Sun end of week? 
            // Or if we consider Sun start? Usually ISO: Mon(1)-Sun(7). 
            // JS getDay: Sun=0, Mon=1...Sat=6.
            // Let's assume standard "Fill until Sunday" meaning fill days until getDay() == 0 again.

            let i = 1;
            while (true) {
                const nextDS = addDays(dateStr, i);
                const nextD = new Date(nextDS);
                updates[nextDS] = val;
                if (nextD.getDay() === 0) break; // Stop ON Sunday
                i++;
                if (i > 7) break;
            }
        }

        if (updateDateDemandBulk) updateDateDemandBulk(updates);
        closeContextMenu();
    };

    return (
        <td
            className={`min-w-[100px] w-[100px] h-8 p-0 border-r border-slate-300 dark:border-slate-700 transition-colors 
            ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/10 border-x-2 border-x-blue-300' : 'bg-slate-200 dark:bg-slate-800/50'}`}
        >
            <div
                className={`w-full h-full relative group/cell`}
                onContextMenu={handleContextMenu}
            >
                <input
                    ref={inputRef}
                    id={`demand-${dateStr}`}
                    type="text" // Keep text to allow flexibility, process as number
                    inputMode="decimal"
                    className={`
                        w-full h-full text-center outline-none transition-all font-bold text-sm m-0 p-0
                        ${readOnly
                            ? 'cursor-not-allowed text-slate-500 bg-transparent'
                            : 'cursor-text text-slate-800 dark:text-slate-100 bg-transparent focus:bg-white dark:focus:bg-slate-700 hover:ring-1 hover:ring-slate-300 dark:hover:ring-slate-600 focus:ring-2 focus:ring-inset focus:ring-blue-500 focus:z-10 focus:shadow-sm'}
                        placeholder:text-slate-300 dark:placeholder:text-slate-600
                    `}
                    placeholder={readOnly ? '' : '-'}
                    disabled={readOnly}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    autoComplete="off"
                />
            </div>
            {contextMenu && (
                <PortalContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={closeContextMenu}
                    onAction={performBulkFill}
                />
            )}
        </td>
    );
});

// Portal for Context Menu to escape overflow:hidden
const PortalContextMenu = ({ x, y, onClose, onAction }) => {
    // Click outside handler
    useEffect(() => {
        const handleClick = () => onClose();
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [onClose]);

    // Prevent menu itself from closing when clicked (except buttons)
    const stopProp = (e) => e.stopPropagation();

    return createPortal(
        <div
            className="fixed z-[100] min-w-[180px] bg-white dark:bg-slate-800 rounded-lg shadow-xl ring-1 ring-black/5 dark:ring-white/10 py-1 origin-top-left transform transition-all animate-in fade-in zoom-in-95 duration-100"
            style={{ top: y, left: x }}
            onClick={stopProp}
            onContextMenu={(e) => e.preventDefault()} // No native menu on our menu
        >
            <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 mb-1">
                Quick Fill
            </div>

            <button
                onClick={() => onAction('week')}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 group"
            >
                <div className="p-1 rounded-md bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {/* Icon Placeholder or SVG */}
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                </div>
                <span>Next 7 Days</span>
            </button>

            <button
                onClick={() => onAction('restOfWeek')}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 group"
            >
                <div className="p-1 rounded-md bg-blue-50 text-blue-600 group-hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0h9m3.102-1.296a4.5 4.5 0 016.3 6.3m0-6.3a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                </div>
                <span>Rest of Week</span>
            </button>

            <button
                onClick={() => onAction('month')}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 group"
            >
                <div className="p-1 rounded-md bg-purple-50 text-purple-600 group-hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0h9m3.102-1.296a4.5 4.5 0 016.3 6.3m0-6.3a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                </div>
                <span>Rest of Month</span>
            </button>
        </div>,
        document.body
    );
};
