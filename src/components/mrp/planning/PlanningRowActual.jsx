import React from 'react';
import { formatLocalDate } from '../../../utils/dateUtils';

export default function PlanningRowActual({ dates, monthlyProductionActuals, updateDateActual, readOnly = false }) {
    return (
        <tr className="bg-sky-50/20 dark:bg-sky-900/10">
            <th className="sticky left-0 min-w-[140px] w-[140px] bg-sky-50 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-600 p-2 text-left text-xs font-bold text-sky-700 dark:text-sky-400 z-10 shadow-md">
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
                        readOnly={readOnly}
                    />
                );
            })}
        </tr>
    );
}

const ActualCell = React.memo(({ dateStr, initialValue, updateDateActual, readOnly }) => {
    const [val, setVal] = React.useState(initialValue || '');

    React.useEffect(() => {
        setVal(initialValue || '');
    }, [initialValue]);

    const handleBlur = () => {
        if (readOnly) return;
        let valStr = val.toString().toLowerCase().trim().replace(/,/g, '');
        let multiplier = 1;
        if (valStr.endsWith('k')) multiplier = 1000;
        else if (valStr.endsWith('m')) multiplier = 1000000;

        const clean = parseFloat(valStr.replace(/[km]/g, ''));
        const num = isNaN(clean) ? null : clean * multiplier;

        // Only update if changed
        if (num !== initialValue) {
            updateDateActual(dateStr, num);
            if (num !== null) setVal(num.toString()); // Clean up display
        }
    };

    return (
        <td className={`p-0 border-r border-slate-200 dark:border-slate-700 bg-sky-50/10 dark:bg-sky-900/5 min-w-[60px] ${readOnly ? '' : 'hover:bg-sky-50/30'}`}>
            <input
                type="text"
                className={`w-full h-full text-center text-sm bg-transparent outline-none p-1 font-bold text-sky-700 dark:text-sky-300 rounded-sm ${readOnly ? 'cursor-default opacity-80' : 'focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-inset focus:ring-sky-400'}`}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onBlur={handleBlur}
                placeholder={readOnly ? '' : '-'}
                disabled={readOnly}
            />
        </td>
    );
});
