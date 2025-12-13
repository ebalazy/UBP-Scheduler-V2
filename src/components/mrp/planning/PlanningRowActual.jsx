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
    );
}
