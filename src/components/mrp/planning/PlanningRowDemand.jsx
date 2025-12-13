import React from 'react';
import { formatLocalDate } from '../../../utils/dateUtils';

export default function PlanningRowDemand({ dates, monthlyDemand, updateDateDemand, updateDateDemandBulk }) {
    const updateRef = React.useRef(updateDateDemand);
    React.useEffect(() => { updateRef.current = updateDateDemand; }, [updateDateDemand]);

    return (
        <tr>
            <th className="sticky left-0 bg-white dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 p-2 text-left text-xs font-bold text-gray-700 dark:text-gray-300 z-10 shadow-md group relative">
                Production (Plan)
                {/* Tooltip Trick */}
                <div className="hidden group-hover:block absolute left-full top-0 ml-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-lg z-50 pointer-events-none">
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
    const [localVal, setLocalVal] = React.useState(initialValue || '');

    React.useEffect(() => {
        setLocalVal(initialValue || '');
    }, [initialValue]);

    // Debounce the Global Update to prevent typing lag
    const debouncedUpdate = React.useMemo(() => {
        let timer;
        return (d, v) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                updateDateDemand(d, v);
            }, 300);
        };
    }, [updateDateDemand]);

    return (
        <td className="p-0 border-r border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
            <input
                id={`demand-${dateStr}`}
                className="w-full h-full p-2 text-center text-xs bg-transparent focus:bg-blue-50 dark:focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:text-gray-200"
                value={localVal}
                placeholder="-"
                onChange={(e) => {
                    const v = e.target.value;
                    setLocalVal(v);
                    debouncedUpdate(dateStr, v);
                }}
                onBlur={() => {
                    // Ensure final value is caught if debounce pending? 
                    // Actually updateDateDemand handles it.
                    // Optionally force-flush here, but React 18 handles batching well.
                    updateDateDemand(dateStr, localVal);
                }}
                onKeyDown={(e) => {
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

                        // Normal Enter: Save Immediately & Move Focus
                        updateDateDemand(dateStr, localVal); // Force sync

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
            />
        </td>
    );
});
