import React from 'react';
import { formatLocalDate } from '../../../utils/dateUtils';

export default function PlanningRowInbound({ dates, poManifest, monthlyInbound, updateDateInbound, openManager }) {
    return (
        <tr>
            <th className="sticky left-0 bg-white dark:bg-slate-800 border-r border-slate-300 dark:border-slate-600 p-2 text-left text-xs font-bold text-emerald-700 dark:text-emerald-400 z-10 shadow-md">
                Inbound Trucks
            </th>
            {dates.map(date => {
                const dateStr = formatLocalDate(date);
                const manifestItems = poManifest[dateStr]?.items || [];
                const hasManifest = manifestItems.length > 0;
                const val = hasManifest ? manifestItems.length : (monthlyInbound[dateStr] || 0);

                return (
                    <td key={dateStr} className="p-0 border-r border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 relative group transition-colors">
                        {hasManifest ? (
                            /* PO MODE: Clickable Number */
                            <button
                                className="w-full h-full p-1 flex items-center justify-center"
                                onClick={() => openManager(dateStr)}
                                title={`${manifestItems.length} Confirmed POs`}
                            >
                                <span className="bg-emerald-600 text-white dark:bg-emerald-500 rounded px-2 py-0.5 text-sm font-bold shadow-sm whitespace-nowrap hover:bg-emerald-700 transition-colors">
                                    {val} PO
                                </span>
                            </button>
                        ) : (
                            /* MANUAL MODE: Input */
                            <input
                                className={`w-full h-full p-2 text-center text-sm bg-transparent focus:bg-emerald-50 dark:focus:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-400 font-bold rounded-sm
                                    ${val > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300'}
                                `}
                                value={val || ''}
                                placeholder="0"
                                onChange={e => {
                                    const v = e.target.value.replace(/,/g, '');
                                    if (!isNaN(v)) updateDateInbound(dateStr, v);
                                }}
                                onDoubleClick={() => openManager(dateStr)}
                            />
                        )}
                    </td>
                );
            })}
        </tr>
    );
}
