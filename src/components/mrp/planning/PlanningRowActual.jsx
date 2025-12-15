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

const ActualCell = React.memo(({ initialValue }) => {
    return (
        <td className="p-0 border-r border-gray-100 dark:border-gray-700 bg-blue-50/10 dark:bg-blue-900/5">
            <div className={`w-full h-full p-2 text-center text-xs flex items-center justify-center font-bold ${initialValue ? 'text-blue-700 dark:text-blue-300' : 'text-gray-300'}`}>
                {initialValue || '-'}
            </div>
        </td>
    );
});
