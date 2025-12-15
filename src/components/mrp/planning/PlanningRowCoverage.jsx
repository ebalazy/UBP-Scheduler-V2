import React from 'react';
import { formatLocalDate } from '../../../utils/dateUtils';

function PlanningRowCoverage({ dates, ledgerMap, monthlyDemand, specs }) {
    return (
        <tr className="border-t border-gray-300 dark:border-gray-600">
            <th className="sticky left-0 min-w-[140px] w-[140px] bg-white dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 p-2 text-left text-xs font-bold text-gray-500 uppercase z-10 shadow-md">
                Coverage (DOS)
            </th>
            {dates.map((date) => {
                const dateStr = formatLocalDate(date);
                const ledgerItem = ledgerMap[dateStr];
                const balance = ledgerItem ? ledgerItem.balance : 0;
                const specsScrap = 1 + ((specs?.scrapPercentage || 0) / 100);

                let coverage = 0;
                let remaining = balance;
                let isInfinite = false;

                // Look ahead up to 30 days
                for (let i = 1; i <= 30; i++) {
                    const nextDate = new Date(date);
                    nextDate.setDate(nextDate.getDate() + i);
                    const nextDateStr = formatLocalDate(nextDate);

                    const demand = (monthlyDemand[nextDateStr] || 0) * specs.bottlesPerCase * specsScrap;

                    if (demand === 0) {
                        coverage += 1;
                        if (i === 30) isInfinite = true;
                        continue;
                    }

                    if (remaining >= demand) {
                        remaining -= demand;
                        coverage += 1;
                    } else {
                        coverage += remaining / demand;
                        remaining = 0;
                        break;
                    }
                }

                const val = coverage.toFixed(1);
                const numericVal = parseFloat(val);

                let colorClass = 'text-gray-400';
                if (balance > 0) {
                    if (numericVal < 2.0) colorClass = 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-bold';
                    else if (numericVal < 4.0) colorClass = 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 font-bold';
                    else colorClass = 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-bold';
                }

                return (
                    <td key={dateStr} className={`p-2 text-center text-xs border-r border-gray-200 dark:border-gray-700 ${colorClass}`}>
                        {isInfinite ? '>30' : val}
                    </td>
                );
            })}
        </tr>
    );
}

export default React.memo(PlanningRowCoverage);
