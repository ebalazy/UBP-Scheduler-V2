import React from 'react';
import { formatLocalDate } from '../../../utils/dateUtils';

function PlanningRowInventory({ dates, ledgerMap, specs, safetyTarget }) {
    return (
        <tr className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
            <th className="sticky left-0 bg-gray-100 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 p-2 text-left text-xs font-bold text-gray-800 dark:text-white z-10 shadow-md">
                End Inventory
            </th>
            {dates.map(date => {
                const dateStr = formatLocalDate(date);
                const ledgerItem = ledgerMap[dateStr];
                const balance = ledgerItem ? ledgerItem.balance : null;

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
                    if (balance < safetyTarget) bgClass = 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-bold';
                    else if (balance > safetyTarget + (bottlesPerTruck * 2)) bgClass = 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300';
                    else bgClass = 'text-gray-600 dark:text-gray-300';
                }

                return (
                    <td key={dateStr} className={`p-2 text-center text-xs border-r border-gray-200 dark:border-gray-700 ${bgClass}`}>
                        {label}
                    </td>
                );
            })}
        </tr>
    );
}

export default React.memo(PlanningRowInventory);
