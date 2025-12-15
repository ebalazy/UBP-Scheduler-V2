import React from 'react';
import { formatLocalDate } from '../../../utils/dateUtils';

export default function PlanningHeader({ dates, todayStr }) {
    return (
        <thead className="sticky top-0 z-10">
            <tr>
                <th className="sticky left-0 min-w-[140px] bg-slate-100 dark:bg-slate-800 border-b border-r border-slate-300 dark:border-slate-600 p-2 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider z-20 shadow-md">
                    <span>Metric</span>
                </th>
                {dates.map(date => {
                    const dateStr = formatLocalDate(date);
                    const isToday = dateStr === todayStr;
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    return (
                        <th key={dateStr} className={`
                            min-w-[80px] w-[80px] p-2 text-center border-b border-r border-slate-200 dark:border-slate-700 text-xs transition-colors
                            ${isToday
                                ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 font-extrabold border-b-2 border-b-blue-600 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)]'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}
                            ${isWeekend && !isToday ? 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-500' : ''}
                        `}>
                            <div className="uppercase text-[9px] opacity-60 font-semibold">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                            <div className="text-sm mt-0.5">{date.getDate()}</div>
                        </th>
                    );
                })}
            </tr>
        </thead>
    );
}
