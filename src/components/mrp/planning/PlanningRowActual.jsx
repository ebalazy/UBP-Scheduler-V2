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

const ActualCell = React.memo(({ dateStr, initialValue, updateDateActual }) => {
    const [val, setVal] = React.useState(initialValue || '');

    React.useEffect(() => {
        setVal(initialValue || '');
    }, [initialValue]);

    const handleBlur = () => {
        const num = val === '' ? null : Number(val);
        // Only update if changed
        if (num !== initialValue) {
            updateDateActual(dateStr, num);
        }
    };

    return (
        <td className="p-0 border-r border-gray-100 dark:border-gray-700 bg-blue-50/10 dark:bg-blue-900/5 min-w-[60px]">
            <input
                type="number"
                className="w-full h-full text-center text-xs bg-transparent focus:bg-white dark:focus:bg-gray-700 outline-none p-1 font-bold text-blue-700 dark:text-blue-300"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onBlur={handleBlur}
                placeholder="-"
            />
        </td>
    );
});
