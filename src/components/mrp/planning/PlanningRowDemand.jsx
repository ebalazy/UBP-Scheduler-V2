import React from 'react';
import { formatLocalDate } from '../../../utils/dateUtils';

export default function PlanningRowDemand({ dates, monthlyDemand, updateDateDemand, updateDateDemandBulk }) {
    const updateRef = React.useRef(updateDateDemand);
    React.useEffect(() => { updateRef.current = updateDateDemand; }, [updateDateDemand]);

    return (
        <tr className="group/row">
            <th className="sticky left-0 bg-white dark:bg-slate-800 border-r border-slate-300 dark:border-slate-600 p-2 text-left text-xs font-bold text-slate-700 dark:text-slate-300 z-10 shadow-md relative">
                Production (Plan)
                {/* Tooltip Trick */}
                <div className="hidden group-hover/row:block absolute left-full top-0 ml-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg z-50 pointer-events-none transform translate-y-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                    <strong>⚡ Power Tip:</strong><br />
                    Type <code>60000*5</code> and hit Enter to fill 5 days at once!
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
                    />
                );
            })}
        </tr>
    );
}

const DemandCell = React.memo(({ date, dateStr, initialValue, updateDateDemand, updateDateDemandBulk }) => {
    const inputRef = React.useRef(null);

    // Sync from Global State (only if not focused to avoid fighting cursor)
    React.useEffect(() => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
            inputRef.current.value = initialValue || '';
        }
    }, [initialValue]);

    // Simple Debounce for Global Update (Removed for Instant Feedback)
    const debouncedUpdate = React.useMemo(() => {
        return (d, v) => {
            updateDateDemand(d, v);
        };
    }, [updateDateDemand]);

    const handleBlur = () => {
        if (inputRef.current) {
            updateDateDemand(dateStr, inputRef.current.value);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const rawVal = e.target.value.replace(/,/g, '');
            // Check for Bulk Syntax: 1000*5
            const match = rawVal.match(/^(\d+)\*(\d+)$/);

            if (match) {
                const value = match[1];
                const count = parseInt(match[2], 10);
                const updates = {};
                let nextDate = new Date(date);
                updates[dateStr] = value; // Include self

                for (let i = 1; i < count; i++) {
                    nextDate.setDate(nextDate.getDate() + 1);
                    updates[formatLocalDate(nextDate)] = value;
                }

                if (updateDateDemandBulk) updateDateDemandBulk(updates);
                else updateDateDemand(dateStr, value);

                // Jump Focus after bulk
                const jumpDate = new Date(date);
                jumpDate.setDate(jumpDate.getDate() + count);
                const jumpId = `demand-${formatLocalDate(jumpDate)}`;
                const jumpEl = document.getElementById(jumpId);
                if (jumpEl) {
                    jumpEl.focus();
                    jumpEl.select();
                }
                return;
            }

            // Normal Enter: Save and Move Focus
            updateDateDemand(dateStr, rawVal);

            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            const nextId = `demand-${formatLocalDate(nextDate)}`;
            const nextEl = document.getElementById(nextId);
            if (nextEl) {
                nextEl.focus();
                nextEl.select();
            }
        }
    };

    return (
        <td className="p-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <input
                ref={inputRef}
                id={`demand-${dateStr}`}
                className="w-full h-full p-2 text-center text-sm font-bold bg-transparent font-medium text-slate-800 dark:text-slate-200 placeholder-slate-300 focus:bg-blue-50/50 dark:focus:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 rounded-sm"
                defaultValue={initialValue || ''}
                placeholder="-"
                onChange={(e) => {
                    // debouncedUpdate(dateStr, e.target.value); // Disabled Live Update
                }}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
            />
        </td>
    );
});
