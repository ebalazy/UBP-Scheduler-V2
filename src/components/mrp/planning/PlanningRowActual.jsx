import React from 'react';
import { formatLocalDate } from '../../../utils/dateUtils';

export default function PlanningRowActual({ dates, monthlyProductionActuals, updateDateActual }) {
    return (
        <tr className="bg-blue-50/20 dark:bg-blue-900/10">
            <th className="sticky left-0 bg-white dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 p-2 text-left text-xs font-bold text-blue-600 dark:text-blue-400 z-10 shadow-md">
                Actual / Prod
            </th>
            {dates.map((date) => {
                const dateStr = formatLocalDate(date);
                const val = monthlyProductionActuals[dateStr];
                return (
                    <ActualCell
                        key={dateStr}
                        date={date}
                        dateStr={dateStr}
                        initialValue={val}
                        updateDateActual={updateDateActual}
                    />
                );
            })}
        </tr>
    );
}

const ActualCell = React.memo(({ date, dateStr, initialValue, updateDateActual }) => {
    const inputRef = React.useRef(null);

    React.useEffect(() => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
            inputRef.current.value = initialValue !== undefined && initialValue !== null ? initialValue : '';
        }
    }, [initialValue]);

    const debouncedUpdate = React.useMemo(() => {
        return (d, v) => {
            updateDateActual(d, v);
        };
    }, [updateDateActual]);

    const handleBlur = () => {
        if (inputRef.current) {
            updateDateActual(dateStr, inputRef.current.value);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const rawVal = e.target.value.replace(/,/g, '');
            updateDateActual(dateStr, rawVal); // Force sync

            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            const nextId = `actual-${formatLocalDate(nextDate)}`;
            const nextEl = document.getElementById(nextId);
            if (nextEl) {
                nextEl.focus();
                nextEl.select();
            }
        }
    };

    return (
        <td className="p-0 border-r border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
            <input
                ref={inputRef}
                id={`actual-${dateStr}`}
                className="w-full h-full p-2 text-center text-xs bg-transparent focus:bg-blue-50 dark:focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 font-bold text-blue-700 dark:text-blue-300 placeholder-shown:text-gray-400"
                defaultValue={initialValue !== undefined && initialValue !== null ? initialValue : ''}
                placeholder="-"
                onChange={(e) => {
                    const v = e.target.value.replace(/,/g, '');
                    // Allow empty string to clear
                    if (v === '' || !isNaN(v)) {
                        debouncedUpdate(dateStr, v);
                    }
                }}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
            />
        </td>
    );
});
