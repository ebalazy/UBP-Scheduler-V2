import React from 'react';
import { formatLocalDate } from '../../../utils/dateUtils';

export default function PlanningHeader({ dates, todayStr }) {
    return (
        <thead className="sticky top-0 z-10">
            <tr>
                <th className="sticky left-0 min-w-[140px] bg-gray-100 dark:bg-gray-800 border-b border-r border-gray-300 dark:border-gray-600 p-2 text-left text-xs font-bold text-gray-500 uppercase z-20 shadow-md">
                    <span>Metric</span>
                </th>
                {dates.map(date => {
                    const dateStr = formatLocalDate(date);
                    const isToday = dateStr === todayStr;
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    return (
                        <th key={dateStr} className={`
                            min-w-[80px] w-[80px] p-2 text-center border-b border-r border-gray-200 dark:border-gray-700 text-xs 
                            ${isToday ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold border-b-2 border-b-blue-500' : 'bg-gray-50 dark:bg-gray-800'}
                            ${isWeekend ? 'bg-gray-100 dark:bg-gray-700/50 opacity-80' : ''}
                        `}>
                            <div className="uppercase text-[9px] opacity-70">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                            <div>{date.getDate()}</div>
                        </th>
                    );
                })}
            </tr>
        </thead>
    );
}
