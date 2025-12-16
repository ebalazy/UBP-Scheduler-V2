import React, { memo } from 'react';
import { formatLocalDate } from '../../../utils/dateUtils';

import { TruckIcon } from '@heroicons/react/24/outline';

const PlanningRowInbound = memo(({ dates, poManifest, monthlyInbound, updateDateInbound, openManager, readOnly = false, todayStr }) => {
    return (
        <tr>
            <th className="sticky left-0 min-w-[140px] w-[140px] h-8 bg-white dark:bg-slate-800 border-r border-slate-300 dark:border-slate-600 pl-2 pr-2 text-left text-xs font-bold text-emerald-700 dark:text-emerald-400 z-10 shadow-md">
                <div className="w-full h-full flex items-center">
                    Inbound Trucks
                </div>
            </th>
            {dates.map(date => {
                const dateStr = formatLocalDate(date);
                const manifestItems = poManifest[dateStr]?.items || [];
                const hasManifest = manifestItems.length > 0;
                const val = hasManifest ? manifestItems.length : (monthlyInbound[dateStr] || 0);
                const isToday = dateStr === todayStr;

                return (
                    <td key={dateStr} className={`min-w-[100px] w-[100px] h-8 p-0 border-r border-slate-200 dark:border-slate-700 relative group transition-colors 
                        ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/10 border-x-2 border-x-blue-300' : ''}
                        ${readOnly ? '' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}
                    `}>
                        {hasManifest ? (
                            /* PO MODE: Clickable Number */
                            <button
                                className={`w-full h-full p-1 flex items-center justify-center ${readOnly ? 'cursor-default' : ''}`}
                                onClick={() => !readOnly && openManager(dateStr)}
                                title={`${manifestItems.length} Confirmed POs${readOnly ? ' (Read Only)' : ''}`}
                                disabled={readOnly}
                            >
                                <span className={`flex items-center gap-1 rounded px-2 py-0.5 text-sm font-bold shadow-sm whitespace-nowrap transition-colors ${readOnly ? 'bg-emerald-600/70 text-white/90' : 'bg-emerald-600 text-white dark:bg-emerald-500 hover:bg-emerald-700'}`}>
                                    <TruckIcon className="w-3 h-3" />
                                    {val} PO
                                </span>
                            </button>
                        ) : (
                            /* MANUAL MODE: Input with Icon Overlay */
                            <div className="relative w-full h-full flex items-center justify-center">
                                {Number(val) > 0 && (
                                    <TruckIcon className="w-3 h-3 text-emerald-500 absolute left-2 pointer-events-none opacity-50" />
                                )}
                                <input
                                    className={`w-full h-full text-center text-sm bg-transparent font-bold rounded-sm outline-none
                                        ${val > 0 ? 'text-emerald-600 dark:text-emerald-400 pl-4' : 'text-slate-300'}
                                        ${readOnly ? 'cursor-default' : 'focus:bg-emerald-50 dark:focus:bg-slate-700 focus:ring-2 focus:ring-inset focus:ring-emerald-400'}
                                    `}
                                    value={val || ''}
                                    placeholder={readOnly ? '' : '0'}
                                    disabled={readOnly}
                                    onChange={e => {
                                        const v = e.target.value.replace(/,/g, '');
                                        if (!isNaN(v)) updateDateInbound(dateStr, v);
                                    }}
                                    onDoubleClick={() => !readOnly && openManager(dateStr)}
                                />
                            </div>
                        )}
                    </td>
                );
            })}
        </tr>
    );
});

export default PlanningRowInbound;
