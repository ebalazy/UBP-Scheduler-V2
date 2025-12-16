import React, { memo } from 'react';
import { formatLocalDate } from '../../../utils/dateUtils';

const PlanningRowInventory = memo(({ dates, ledgerMap, specs, safetyTarget, todayStr }) => {
    return (
        <tr className="bg-slate-200 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600">
            <th className="sticky left-0 min-w-[140px] w-[140px] h-8 bg-slate-200 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-600 pl-2 pr-2 text-left text-xs font-bold text-slate-800 dark:text-white z-10 shadow-md">
                <div className="w-full h-full flex items-center">
                    End Inventory
                </div>
            </th>
            {dates.map(date => {
                const dateStr = formatLocalDate(date);
                const ledgerItem = ledgerMap[dateStr];
                const balance = ledgerItem ? ledgerItem.balance : null;
                const isToday = dateStr === todayStr;

                // Conversion Config
                const casesPerPallet = specs?.casesPerPallet || 100;
                const bottlesPerCase = specs?.bottlesPerCase || 1;
                const bottlesPerTruck = specs?.bottlesPerTruck || 20000;
                const totalPallets = balance !== null ? Math.round(balance / bottlesPerCase / casesPerPallet) : null;

                // Smart Label Logic
                let label = '-';
                if (totalPallets !== null) {
                    const palletsPerTruck = Math.floor(bottlesPerTruck / bottlesPerCase / casesPerPallet) || 22;
                    if (Math.abs(totalPallets) >= palletsPerTruck) {
                        const trucks = Math.floor(totalPallets / palletsPerTruck);
                        const remainder = totalPallets % palletsPerTruck;
                        label = `${trucks}T ${remainder}P`;
                    } else {
                        label = `${totalPallets}`;
                    }
                }

                // Colors
                let bgClass = '';
                if (balance !== null && safetyTarget) {
                    if (balance < safetyTarget) bgClass = 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 font-bold';
                    else if (balance > safetyTarget + (bottlesPerTruck * 2)) bgClass = 'bg-orange-100 dark:bg-orange-900/40 text-orange-900 dark:text-orange-200';
                    else bgClass = 'text-slate-700 dark:text-slate-200';
                }

                // Override for Today Highlight
                if (isToday) {
                    // Keep text color but add border/bg mix
                    bgClass += ' bg-blue-50/50 dark:bg-blue-900/10 border-x-2 border-x-blue-300';
                }

                return (
                    <td key={dateStr} className={`min-w-[100px] w-[100px] h-8 p-0 border-r border-slate-300 dark:border-slate-600 ${bgClass}`}>
                        <div className="w-full h-full flex items-center justify-center">
                            {label}
                        </div>
                    </td>
                );
            })}
        </tr>
    );
});

export default PlanningRowInventory;
