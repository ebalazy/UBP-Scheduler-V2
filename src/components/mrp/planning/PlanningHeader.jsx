import React, { memo } from 'react';
import { formatLocalDate } from '../../../utils/dateUtils';

const PlanningHeader = memo(({ dates, todayStr }) => {
    return (
        <thead className="sticky top-0 z-20">
            <tr>
                <th className="sticky left-0 min-w-[140px] w-[140px] h-10 bg-slate-800 dark:bg-slate-950 border-b border-r border-slate-600 dark:border-slate-700 pl-2 pr-2 text-left text-xs font-bold text-white dark:text-slate-200 uppercase tracking-wider z-30 shadow-md">
                    <div className="flex items-center h-full"><span>Metric</span></div>
                </th>
                {dates.map(date => {
                    const dateStr = formatLocalDate(date); // Assuming formatLocalDate is equivalent to getLocalISOString for this context
                    const dObj = new Date(dateStr + 'T00:00:00'); // Local
                    const isToday = dateStr === todayStr;
                    const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;
                    return (
                        <th key={dateStr} className={`
                            min-w-[100px] w-[100px] h-10 p-0 border-b border-r border-slate-600 dark:border-slate-700 transition-colors
                            ${isToday
                                ? 'bg-blue-600 text-white font-extrabold shadow-md'
                                : 'bg-slate-800 dark:bg-slate-950 text-slate-200 dark:text-slate-400'}
                            ${isWeekend && !isToday ? 'bg-slate-700/50 dark:bg-slate-900/50 text-slate-400' : ''}
                        `}>
                            <div className="w-full h-full flex flex-col items-center justify-center">
                                {/* Day Name */}
                                <div className={`uppercase text-[9px] leading-tight font-semibold ${isToday ? 'opacity-90' : 'opacity-60'}`}>
                                    {(() => {
                                        const [y, m, d] = dateStr.split('-').map(Number);
                                        const localDate = new Date(y, m - 1, d);
                                        return localDate.toLocaleDateString('en-US', { weekday: 'short' });
                                    })()}
                                </div>
                                {/* Day Number */}
                                <div className="text-sm leading-none mt-0.5">
                                    {dateStr.split('-')[2].replace(/^0/, '')}
                                </div>
                            </div>
                        </th>
                    );
                })}
            </tr>
        </thead>
    );
});

export default PlanningHeader;
