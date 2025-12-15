import React from 'react';
import { formatLocalDate } from '../../../utils/dateUtils';

export default function PlanningRowInbound({ dates, poManifest, monthlyInbound, updateDateInbound, openManager, readOnly = false }) {
    return (
        <tr>
            <th className="sticky left-0 min-w-[140px] w-[140px] bg-white dark:bg-slate-800 border-r border-slate-300 dark:border-slate-600 p-2 text-left text-xs font-bold text-emerald-700 dark:text-emerald-400 z-10 shadow-md">
                Inbound Trucks
            </th>
            {dates.map(date => {
                const dateStr = formatLocalDate(date);
                const manifestItems = poManifest[dateStr]?.items || [];
                const hasManifest = manifestItems.length > 0;
                const val = hasManifest ? manifestItems.length : (monthlyInbound[dateStr] || 0);

                return (
                    <td key={dateStr} className={`p-0 border-r border-slate-200 dark:border-slate-700 relative group transition-colors ${readOnly ? '' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                        {hasManifest ? (
                            /* PO MODE: Clickable Number */
                            <button
                                className={`w-full h-full p-1 flex items-center justify-center ${readOnly ? 'cursor-default' : ''}`}
                                onClick={() => !readOnly && openManager(dateStr)}
                                title={`${manifestItems.length} Confirmed POs${readOnly ? ' (Read Only)' : ''}`}
                                disabled={readOnly}
                            >
                                <span className={`rounded px-2 py-0.5 text-sm font-bold shadow-sm whitespace-nowrap transition-colors ${readOnly ? 'bg-emerald-600/70 text-white/90' : 'bg-emerald-600 text-white dark:bg-emerald-500 hover:bg-emerald-700'}`}>
                                    {val} PO
                                </span>
                            </button>
                        ) : (
                            /* MANUAL MODE: Input */
                            <input
                                className={`w-full h-full p-2 text-center text-sm bg-transparent font-bold rounded-sm
                                    ${val > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300'}
                                    ${readOnly ? 'cursor-default' : 'focus:bg-emerald-50 dark:focus:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-400'}
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
                        )}
                    </td>
                );
            })}
        </tr>
    );
}
