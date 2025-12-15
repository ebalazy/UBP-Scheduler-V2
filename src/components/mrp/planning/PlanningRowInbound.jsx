import React from 'react';
import { formatLocalDate } from '../../../utils/dateUtils';

export default function PlanningRowInbound({ dates, poManifest, monthlyInbound, updateDateInbound, openManager }) {
    return (
        <tr>
            <th className="sticky left-0 bg-white dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 p-2 text-left text-xs font-bold text-green-600 dark:text-green-500 z-10 shadow-md">
                Inbound Trucks
            </th>
            {dates.map(date => {
                const dateStr = formatLocalDate(date);
                const manifestItems = poManifest[dateStr]?.items || [];
                const hasManifest = manifestItems.length > 0;
                const val = hasManifest ? manifestItems.length : (monthlyInbound[dateStr] || 0);

                return (
                    <td key={dateStr} className="p-0 border-r border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 relative group">
                        {hasManifest ? (
                            /* PO MODE: Clickable Number */
                            <button
                                className="w-full h-full p-1 flex items-center justify-center"
                                onClick={() => openManager(dateStr)}
                                title={`${manifestItems.length} Confirmed POs`}
                            >
                                <span className="bg-green-600 text-white dark:bg-green-500 rounded px-2 py-0.5 text-xs font-bold shadow-sm whitespace-nowrap">
                                    {val} PO
                                </span>
                            </button>
                        ) : (
                            /* MANUAL MODE: Input */
                            <input
                                className={`w-full h-full p-2 text-center text-xs bg-transparent focus:bg-green-50 dark:focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500 font-bold
                                    ${val > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-300'}
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
